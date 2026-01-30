import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { InputManager } from './InputManager'
import { Player } from './Player'
import { Box, createBoxPiles } from './Box'
import type { BulletSpawn } from './Player'
import { isBulletOutOfBounds, syncBulletMesh, disposeBullet } from './Bullet'
import { ARENA_HALF_X, ARENA_HALF_Z, FLOOR_Y } from './types'

const PHYSICS_DT = 1 / 60
const WALL_THICKNESS = 1
const WALL_HEIGHT = 4
/** Isometric camera: distance and vertical angle (rad). Offset from player. */
const CAMERA_DIST = 28
const CAMERA_ANGLE = Math.PI / 4
const CAMERA_OFFSET_Y = CAMERA_DIST * Math.sin(CAMERA_ANGLE)
const CAMERA_OFFSET_H = CAMERA_DIST * Math.cos(CAMERA_ANGLE)
const CAMERA_OFFSET_X = CAMERA_OFFSET_H * 0.7
const CAMERA_OFFSET_Z = CAMERA_OFFSET_H * 0.7

export class TheMaskEngine {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private world: CANNON.World
  private input: InputManager
  private player: Player
  private boxes: Box[] = []
  private bullets: BulletSpawn[] = []
  private animationId: number | null = null
  private isDisposed = false
  private container: HTMLElement

  constructor(container: HTMLElement) {
    this.container = container
    const width = Math.max(container.clientWidth || window.innerWidth, 1)
    const height = Math.max(container.clientHeight || window.innerHeight, 1)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0xb8c4d0)

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 500)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(width, height, false)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    container.style.overflow = 'hidden'
    container.appendChild(this.renderer.domElement)

    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0),
    })

    this.setupLights()
    this.setupFloor()
    this.setupWalls()
    this.setupBoundaryVisual()
    this.input = new InputManager()
    this.player = new Player(this.world, this.scene, { x: 0, y: FLOOR_Y, z: 0 })
    this.player.setOnShoot((spawn) => {
      this.bullets.push(spawn)
      this.scene.add(spawn.mesh)
    })
    this.boxes = createBoxPiles(this.world, this.scene)

    const handleResize = () => {
      requestAnimationFrame(() => {
        const w = Math.max(this.container.clientWidth || window.innerWidth, 1)
        const h = Math.max(this.container.clientHeight || window.innerHeight, 1)
        this.camera.aspect = w / h
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(w, h, false)
      })
    }
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 100))

    this.animate()
  }

  /** Update camera to follow player with fixed isometric offset (margins). */
  private updateCameraFollow() {
    const p = this.player.body.position
    this.camera.position.set(
      p.x + CAMERA_OFFSET_X,
      p.y + CAMERA_OFFSET_Y,
      p.z + CAMERA_OFFSET_Z
    )
    this.camera.lookAt(p.x, p.y, p.z)
  }

  private setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.65)
    this.scene.add(ambient)

    const hemisphere = new THREE.HemisphereLight(0xc8d4e0, 0x8a9ba8, 0.4)
    this.scene.add(hemisphere)

    const dir = new THREE.DirectionalLight(0xffffff, 1.2)
    dir.position.set(15, 25, 15)
    dir.castShadow = true
    dir.shadow.mapSize.width = 2048
    dir.shadow.mapSize.height = 2048
    dir.shadow.camera.near = 0.5
    dir.shadow.camera.far = 50
    dir.shadow.camera.left = -55
    dir.shadow.camera.right = 55
    dir.shadow.camera.top = 55
    dir.shadow.camera.bottom = -55
    dir.shadow.bias = -0.0001
    this.scene.add(dir)
  }

  private setupFloor() {
    const size = 120
    const floorShape = new CANNON.Plane()
    const floorBody = new CANNON.Body({
      mass: 0,
      shape: floorShape,
      collisionFilterGroup: 1,
      collisionFilterMask: 1 | 2, // so bullets hit the floor
    })
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    floorBody.position.set(0, FLOOR_Y, 0)
    this.world.addBody(floorBody)

    const floorGeo = new THREE.PlaneGeometry(size, size)
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x9a9f92 })
    const floorMesh = new THREE.Mesh(floorGeo, floorMat)
    floorMesh.rotation.x = -Math.PI / 2
    floorMesh.receiveShadow = true
    this.scene.add(floorMesh)
  }

  private setupWalls() {
    const h = WALL_HEIGHT / 2
    const positions: [number, number, number][] = [
      [-ARENA_HALF_X - WALL_THICKNESS / 2, h + FLOOR_Y, 0],
      [ARENA_HALF_X + WALL_THICKNESS / 2, h + FLOOR_Y, 0],
      [0, h + FLOOR_Y, -ARENA_HALF_Z - WALL_THICKNESS / 2],
      [0, h + FLOOR_Y, ARENA_HALF_Z + WALL_THICKNESS / 2],
    ]
    const halfExtents = [
      new CANNON.Vec3(WALL_THICKNESS / 2, WALL_HEIGHT / 2, ARENA_HALF_Z + WALL_THICKNESS),
      new CANNON.Vec3(WALL_THICKNESS / 2, WALL_HEIGHT / 2, ARENA_HALF_Z + WALL_THICKNESS),
      new CANNON.Vec3(ARENA_HALF_X + WALL_THICKNESS, WALL_HEIGHT / 2, WALL_THICKNESS / 2),
      new CANNON.Vec3(ARENA_HALF_X + WALL_THICKNESS, WALL_HEIGHT / 2, WALL_THICKNESS / 2),
    ]
    positions.forEach((pos, i) => {
      const body = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(halfExtents[i]),
        position: new CANNON.Vec3(...pos),
        collisionFilterGroup: 1,
        collisionFilterMask: 1 | 2, // so bullets hit the walls
      })
      this.world.addBody(body)
    })
  }

  /** Visible low walls at the play area edges so the user sees the level boundary. */
  private setupBoundaryVisual() {
    const curbHeight = 0.5
    const curbThickness = 0.4
    const color = 0xb71c1c // dark red / boundary color
    const material = new THREE.MeshStandardMaterial({ color })

    // Left (x = -ARENA_HALF_X)
    const leftCurb = new THREE.Mesh(
      new THREE.BoxGeometry(curbThickness, curbHeight, 2 * ARENA_HALF_Z),
      material
    )
    leftCurb.position.set(-ARENA_HALF_X + curbThickness / 2, FLOOR_Y + curbHeight / 2, 0)
    leftCurb.receiveShadow = true
    leftCurb.castShadow = true
    this.scene.add(leftCurb)

    // Right (x = +ARENA_HALF_X)
    const rightCurb = new THREE.Mesh(
      new THREE.BoxGeometry(curbThickness, curbHeight, 2 * ARENA_HALF_Z),
      material
    )
    rightCurb.position.set(ARENA_HALF_X - curbThickness / 2, FLOOR_Y + curbHeight / 2, 0)
    rightCurb.receiveShadow = true
    rightCurb.castShadow = true
    this.scene.add(rightCurb)

    // Back (z = -ARENA_HALF_Z)
    const backCurb = new THREE.Mesh(
      new THREE.BoxGeometry(2 * ARENA_HALF_X, curbHeight, curbThickness),
      material
    )
    backCurb.position.set(0, FLOOR_Y + curbHeight / 2, -ARENA_HALF_Z + curbThickness / 2)
    backCurb.receiveShadow = true
    backCurb.castShadow = true
    this.scene.add(backCurb)

    // Front (z = +ARENA_HALF_Z)
    const frontCurb = new THREE.Mesh(
      new THREE.BoxGeometry(2 * ARENA_HALF_X, curbHeight, curbThickness),
      material
    )
    frontCurb.position.set(0, FLOOR_Y + curbHeight / 2, ARENA_HALF_Z - curbThickness / 2)
    frontCurb.receiveShadow = true
    frontCurb.castShadow = true
    this.scene.add(frontCurb)
  }

  private animate = () => {
    if (this.isDisposed) return
    this.animationId = requestAnimationFrame(this.animate)

    this.player.updateInput(this.input.getState(), PHYSICS_DT)
    this.world.step(PHYSICS_DT)
    this.player.clampToArena()
    this.player.syncMesh()
    this.boxes.forEach((b) => b.syncMesh())
    this.bullets.forEach(syncBulletMesh)
    this.updateCameraFollow()

    const toRemove: number[] = []
    this.bullets.forEach((spawn, i) => {
      if (isBulletOutOfBounds(spawn.body, spawn.createdAt)) {
        toRemove.push(i)
      }
    })
    toRemove.reverse().forEach((i) => {
      const spawn = this.bullets[i]
      disposeBullet(spawn, this.scene, this.world)
      this.bullets.splice(i, 1)
    })

    this.renderer.render(this.scene, this.camera)
  }

  setTouchControls(state: { up: boolean; down: boolean; left: boolean; right: boolean; shoot?: boolean }) {
    this.input.setState(state)
  }

  dispose() {
    this.isDisposed = true
    if (this.animationId != null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    this.input.dispose()
    this.player.dispose(this.scene, this.world)
    this.boxes.forEach((b) => b.dispose(this.scene, this.world))
    this.boxes = []
    this.bullets.forEach((s) => disposeBullet(s, this.scene, this.world))
    this.bullets = []
    this.scene.clear()
    this.world.bodies.forEach((b) => this.world.removeBody(b))
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement)
    }
    this.renderer.dispose()
  }
}
