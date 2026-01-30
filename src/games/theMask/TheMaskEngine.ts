import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { InputManager } from './InputManager'
import { Player, PLAYER_HEIGHT, PLAYER_RADIUS } from './Player'
import { Box, createBoxPiles } from './Box'
import { Turret } from './Turret'
import { LEVELS } from './levels'
import type { BulletSpawn } from './Player'
import { isBulletOutOfBounds, syncBulletMesh, disposeBullet } from './Bullet'
import { ARENA_HALF_X, ARENA_HALF_Z, FLOOR_Y, DEFAULT_TOUCH_INPUT_STATE } from './types'
import type { TouchInputState } from './types'

const PHYSICS_DT = 1 / 60
const PHYSICS_SUBSTEPS = 3
const BULLET_RADIUS_SWEEP = 0.15
const WALL_THICKNESS = 1
const WALL_HEIGHT = 4
const CAMERA_ANGLE = Math.PI / 4
const CAMERA_DIST_DESKTOP = 16
const CAMERA_DIST_MOBILE = 10
const MOBILE_SHOOT_COOLDOWN = 0.45
const SOUND_SHOT = '/hoot-sounds/Shoot.wav'
const SOUND_BOX_HIT = '/theMask/sound/bang_box.wav'
/** Skip this many seconds at the start of bang_box (trim leading silence in the file). */
const SOUND_BOX_HIT_START_OFFSET = 0.20
const SOUND_PLAYER_HIT = '/theMask/sound/ouch.mp3'
const SOUND_LEVEL_VICTORY = '/theMask/sound/victory.wav'
const SOUND_URLS = [SOUND_SHOT, SOUND_BOX_HIT, SOUND_PLAYER_HIT, SOUND_LEVEL_VICTORY] as const
const COLLIDE_EVENT = 'collide'

export interface TheMaskEngineOptions {
  mobile?: boolean
}

export class TheMaskEngine {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private world: CANNON.World
  private input: InputManager
  private player: Player
  private boxes: Box[] = []
  private turrets: Turret[] = []
  private bullets: BulletSpawn[] = []
  private touchState: TouchInputState = DEFAULT_TOUCH_INPUT_STATE
  private currentLevelIndex = 0
  private bulletsToRemove = new Set<BulletSpawn>()
  private animationId: number | null = null
  private isDisposed = false
  private container: HTMLElement
  private lastAnimationTime: number = 0
  private cameraDist: number
  /** Preloaded audio elements so first play is not truncated. */
  private soundCache: Record<string, HTMLAudioElement> = {}

  constructor(container: HTMLElement, options?: TheMaskEngineOptions) {
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
    this.preloadSounds()
    this.input = new InputManager()
    this.cameraDist = options?.mobile ? CAMERA_DIST_MOBILE : CAMERA_DIST_DESKTOP
    const playerOptions = options?.mobile ? { shootCooldown: MOBILE_SHOOT_COOLDOWN } : undefined
    this.player = new Player(this.world, this.scene, { x: 21, y: FLOOR_Y, z: 19 }, playerOptions)
    this.player.setOnShoot((spawn) => {
      this.bullets.push(spawn)
      this.scene.add(spawn.mesh)
      this.playShotSound()
      const handler = (e: { body: CANNON.Body }) => {
        const hitBox = this.boxes.some((b) => b.body === e.body)
        if (hitBox) this.playBoxHitSound()
        const other = e.body
        const turretRef = (other as unknown as { turretRef?: Turret }).turretRef
        if (spawn.fromPlayer && turretRef) {
          turretRef.takeDamage(1)
          this.bulletsToRemove.add(spawn)
        }
      }
      spawn.collisionHandler = handler
      spawn.body.addEventListener(COLLIDE_EVENT, handler as (e: unknown) => void)
    })
    this.loadPlayerModel()
    this.loadLevel(0)

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

  private async loadPlayerModel() {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const loader = new GLTFLoader()
    loader.load(
      '/theMask/models/Astronaut.glb',
      (gltf) => {
        const model = gltf.scene
        const box = new THREE.Box3().setFromObject(model)
        const size = new THREE.Vector3()
        box.getSize(size)
        const center = new THREE.Vector3()
        box.getCenter(center)
        model.position.sub(center)
        const scale = PLAYER_HEIGHT / Math.max(size.y, 0.001)
        model.scale.setScalar(scale)
        model.position.y = PLAYER_HEIGHT / 2
        const names = gltf.animations?.map((a) => a.name) ?? []
        console.log('Astronaut animations available:', names)
        this.player.replaceVisual(model, gltf.animations)
      },
      undefined,
      (err) => console.warn('Failed to load Astronaut.glb', err)
    )
  }

  private preloadSounds() {
    SOUND_URLS.forEach((url) => {
      const a = new Audio(url)
      a.preload = 'auto'
      a.load()
      this.soundCache[url] = a
    })
  }

  private getCachedSound(url: string): HTMLAudioElement {
    let a = this.soundCache[url]
    if (!a) {
      a = new Audio(url)
      a.preload = 'auto'
      a.load()
      this.soundCache[url] = a
    }
    return a
  }

  private playShotSound() {
    const a = this.getCachedSound(SOUND_SHOT)
    a.volume = 0.5
    a.currentTime = 0
    a.play().catch(() => { })
  }

  private playBoxHitSound() {
    const a = this.getCachedSound(SOUND_BOX_HIT)
    a.volume = 0.5
    a.currentTime = SOUND_BOX_HIT_START_OFFSET
    a.play().catch(() => { })
  }

  private playPlayerHitSound() {
    const a = this.getCachedSound(SOUND_PLAYER_HIT)
    a.volume = 0.5
    a.currentTime = 0
    a.play().catch(() => { })
  }

  private playLevelVictorySound() {
    const a = this.getCachedSound(SOUND_LEVEL_VICTORY)
    a.currentTime = 0
    a.play().catch(() => { })
  }

  /** True if segment A->B intersects sphere at C with radius r (catches fast bullets that tunnel). */
  private segmentIntersectsSphere(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    r: number
  ): boolean {
    const dx = bx - ax
    const dy = by - ay
    const dz = bz - az
    const lenSq = dx * dx + dy * dy + dz * dz
    if (lenSq < 1e-10) {
      const d = Math.sqrt((cx - ax) ** 2 + (cy - ay) ** 2 + (cz - az) ** 2)
      return d <= r
    }
    let t = ((cx - ax) * dx + (cy - ay) * dy + (cz - az) * dz) / lenSq
    t = Math.max(0, Math.min(1, t))
    const px = ax + t * dx
    const py = ay + t * dy
    const pz = az + t * dz
    const distSq = (cx - px) ** 2 + (cy - py) ** 2 + (cz - pz) ** 2
    return distSq <= r * r
  }

  /** Load level by index: clear boxes/turrets, spawn from LEVELS[index], reset player. */
  private loadLevel(index: number) {
    this.boxes.forEach((b) => b.dispose(this.scene, this.world))
    this.boxes = []
    this.turrets.forEach((t) => t.dispose(this.scene, this.world))
    this.turrets = []
    const level = LEVELS[Math.min(index, LEVELS.length - 1)]
    this.boxes = createBoxPiles(this.world, this.scene, level.boxes)
    level.turrets.forEach(({ x, z }) => {
      const turret = new Turret(this.world, this.scene, { x, z }, {
        onShoot: (spawn) => {
          this.bullets.push(spawn)
          this.scene.add(spawn.mesh)
          const handler = (e: { body: CANNON.Body }) => {
            if (e.body === this.player.body) {
              this.player.playHitReact()
              this.playPlayerHitSound()
              this.bulletsToRemove.add(spawn)
            }
          }
          spawn.collisionHandler = handler
          spawn.body.addEventListener(COLLIDE_EVENT, handler as (e: unknown) => void)
        },
      })
      this.turrets.push(turret)
    })
    this.player.body.position.set(21, FLOOR_Y + PLAYER_HEIGHT / 2, 18)
    this.player.body.velocity.set(0, 0, 0)
  }

  /** Update camera to follow player with fixed isometric offset (margins). */
  private updateCameraFollow() {
    const p = this.player.body.position
    const dist = this.cameraDist
    const offsetY = dist * Math.sin(CAMERA_ANGLE)
    const offsetH = dist * Math.cos(CAMERA_ANGLE)
    const offsetX = offsetH * 0.7
    const offsetZ = offsetH * 0.7
    this.camera.position.set(p.x + offsetX, p.y + offsetY, p.z + offsetZ)
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

    const keyboardState = this.input.getState()
    const joy = this.touchState.joystick
    const aim = this.touchState.aim
    const joyLen = Math.sqrt(joy.x * joy.x + joy.y * joy.y)
    const aimLen = Math.sqrt(aim.x * aim.x + aim.y * aim.y)
    const offsetH = this.cameraDist * Math.cos(CAMERA_ANGLE)
    const fwdX = offsetH * 0.7
    const fwdZ = offsetH * 0.7
    const fwdLen = Math.sqrt(fwdX * fwdX + fwdZ * fwdZ) || 1
    const forwardX = fwdX / fwdLen
    const forwardZ = fwdZ / fwdLen
    const rightX = -forwardZ
    const rightZ = forwardX
    const aimWorldX = aimLen > 0.05 ? -aim.y * forwardX - aim.x * rightX : 0
    const aimWorldZ = aimLen > 0.05 ? -aim.y * forwardZ - aim.x * rightZ : 0
    const shootFromAim = aimLen > 0.05
    const shoot = keyboardState.shoot || shootFromAim

    if (joyLen > 0.05) {
      const worldX = -joy.y * forwardX - joy.x * rightX
      const worldZ = -joy.y * forwardZ - joy.x * rightZ
      this.player.updateInputFromTouch(worldX, worldZ, aimWorldX, aimWorldZ, shoot, PHYSICS_DT)
    } else {
      this.player.updateInput({ ...keyboardState, shoot }, PHYSICS_DT)
      if (shootFromAim && (aimWorldX !== 0 || aimWorldZ !== 0)) {
        const aimLen = Math.sqrt(aimWorldX * aimWorldX + aimWorldZ * aimWorldZ)
        if (aimLen > 0.01) {
          this.player.shootInDirection(aimWorldX / aimLen, aimWorldZ / aimLen)
        }
      }
    }
    const enemyBulletPrevPos = new Map<BulletSpawn, { x: number; y: number; z: number }>()
    this.bullets.forEach((spawn) => {
      if (!spawn.fromPlayer) {
        const p = spawn.body.position
        enemyBulletPrevPos.set(spawn, { x: p.x, y: p.y, z: p.z })
      }
    })
    const subDt = PHYSICS_DT / PHYSICS_SUBSTEPS
    for (let i = 0; i < PHYSICS_SUBSTEPS; i++) {
      this.world.step(subDt)
    }
    const playerBodyPos = this.player.body.position
    const playerSphereR = PLAYER_RADIUS + BULLET_RADIUS_SWEEP
    this.bullets.forEach((spawn) => {
      if (!spawn.fromPlayer) {
        const prev = enemyBulletPrevPos.get(spawn)
        if (prev) {
          const curr = spawn.body.position
          if (this.segmentIntersectsSphere(
            prev.x, prev.y, prev.z,
            curr.x, curr.y, curr.z,
            playerBodyPos.x, playerBodyPos.y, playerBodyPos.z,
            playerSphereR
          )) {
            this.player.playHitReact()
            this.playPlayerHitSound()
            this.bulletsToRemove.add(spawn)
          }
        }
      }
    })
    this.player.clampToArena()
    this.player.syncMesh()
    const now = performance.now() / 1000
    const animDt = this.lastAnimationTime > 0 ? now - this.lastAnimationTime : PHYSICS_DT
    this.lastAnimationTime = now
    this.player.updateAnimation(animDt)
    this.boxes.forEach((b) => b.syncMesh())
    const playerPos = { x: this.player.body.position.x, z: this.player.body.position.z }
    this.turrets.forEach((t) => t.update(PHYSICS_DT, playerPos))
    this.bullets.forEach(syncBulletMesh)
    this.updateCameraFollow()

    this.bulletsToRemove.forEach((spawn) => {
      disposeBullet(spawn, this.scene, this.world)
      const i = this.bullets.indexOf(spawn)
      if (i !== -1) this.bullets.splice(i, 1)
    })
    this.bulletsToRemove.clear()

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

    const deadTurrets = this.turrets.filter((t) => !t.isAlive())
    deadTurrets.forEach((t) => t.dispose(this.scene, this.world))
    this.turrets = this.turrets.filter((t) => t.isAlive())
    if (this.turrets.length === 0 && LEVELS[this.currentLevelIndex].turrets.length > 0) {
      this.playLevelVictorySound()
      this.currentLevelIndex = Math.min(this.currentLevelIndex + 1, LEVELS.length - 1)
      this.loadLevel(this.currentLevelIndex)
    }

    this.renderer.render(this.scene, this.camera)
  }

  setTouchControls(state: TouchInputState) {
    this.touchState = state
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
    this.turrets.forEach((t) => t.dispose(this.scene, this.world))
    this.turrets = []
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
