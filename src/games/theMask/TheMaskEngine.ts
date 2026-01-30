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
    this.scene.background = new THREE.Color(0x1a1a2e)

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 500)
    this.setCameraIsometric()
    this.camera.lookAt(0, 0, 0)

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

  private setCameraIsometric() {
    const dist = 28
    const angle = Math.PI / 4
    const y = dist * Math.sin(angle)
    const h = dist * Math.cos(angle)
    this.camera.position.set(h * 0.7, y, h * 0.7)
    this.camera.lookAt(0, 0, 0)
  }

  private setupLights() {
    const ambient = new THREE.AmbientLight(0x404060, 0.5)
    this.scene.add(ambient)

    const dir = new THREE.DirectionalLight(0xffffff, 0.9)
    dir.position.set(10, 20, 10)
    dir.castShadow = true
    dir.shadow.mapSize.width = 2048
    dir.shadow.mapSize.height = 2048
    dir.shadow.camera.near = 0.5
    dir.shadow.camera.far = 50
    dir.shadow.camera.left = -20
    dir.shadow.camera.right = 20
    dir.shadow.camera.top = 20
    dir.shadow.camera.bottom = -20
    dir.shadow.bias = -0.0001
    this.scene.add(dir)
  }

  private setupFloor() {
    const size = 60
    const floorShape = new CANNON.Plane()
    const floorBody = new CANNON.Body({ mass: 0, shape: floorShape })
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    floorBody.position.set(0, FLOOR_Y, 0)
    this.world.addBody(floorBody)

    const floorGeo = new THREE.PlaneGeometry(size, size)
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x2d2d44 })
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
      })
      this.world.addBody(body)
    })
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
