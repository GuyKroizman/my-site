import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { InputManager } from './InputManager'
import { Player, PLAYER_HEIGHT, PLAYER_RADIUS, PLAYER_DAMAGE_PER_HIT } from './Player'
import { Box, createBoxPiles } from './Box'
import { Turret } from './Turret'
import { Rolie, ROLIE_BODY_RADIUS } from './Rolie'
import { LEVELS, START_LEVEL } from './levels'
import type { BulletSpawn } from './Player'
import { isBulletOutOfBounds, syncBulletMesh, disposeBullet } from './Bullet'
import { FLOOR_Y, DEFAULT_TOUCH_INPUT_STATE } from './types'
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
const SOUND_MUSIC = '/theMask/sound/game_music.mp3'
/** Skip this many seconds at the start of bang_box (trim leading silence in the file). */
const SOUND_BOX_HIT_START_OFFSET = 0.20
const SOUND_PLAYER_HIT = '/theMask/sound/ouch.mp3'
const SOUND_LEVEL_VICTORY = '/theMask/sound/victory.wav'
const SOUND_EXPLOSION = '/theMask/sound/explosion.wav'
const SOUND_URLS = [SOUND_SHOT, SOUND_BOX_HIT, SOUND_PLAYER_HIT, SOUND_LEVEL_VICTORY, SOUND_EXPLOSION] as const
const COLLIDE_EVENT = 'collide'

const EXPLOSION_DURATION = 1.2
const EXPLOSION_PARTICLE_COUNT = 28
const EXPLOSION_SPREAD = 2.2
const EXPLOSION_PARTICLE_SIZE_MIN = 0.2
const EXPLOSION_PARTICLE_SIZE_MAX = 0.5
const EXPLOSION_FLASH_DURATION = 0.35
const EXPLOSION_FLASH_MAX_SCALE = 2.5

/** Rolie explosion: radius for damaging player and boxes. */
const ROLIE_EXPLOSION_RADIUS = 4
/** Max player damage at explosion center. */
const ROLIE_EXPLOSION_MAX_DAMAGE = 40
/** Min player damage at edge of radius. */
const ROLIE_EXPLOSION_MIN_DAMAGE = 5
/** If Rolie is this close to player (XZ distance), it detonates. */
const ROLIE_EXPLODE_ON_PLAYER_DIST = 1.8
/** Rolie GLB is scaled to this height; offset mesh so feet sit on floor (body center is 0.6). */
const ROLIE_MESH_HEIGHT = 1.5
const ROLIE_MESH_Y_OFFSET = (ROLIE_MESH_HEIGHT - 1.2) / 2

const INTRO_CLOSEUP_DURATION = 1.5
const INTRO_SWOOP_DURATION = 1.5
const INTRO_CLOSEUP_DIST = 2.5
const INTRO_CLOSEUP_HEIGHT = 0.5

/** Health pickup configuration */
const HEALTH_PICKUP_MODEL = '/theMask/models/pickup_health.glb'
const HEALTH_PICKUP_AMOUNT = 20
const HEALTH_PICKUP_RADIUS = 1.2
const HEALTH_PICKUP_Y = FLOOR_Y + 0.5
const HEALTH_PICKUP_ROTATION_SPEED = 2 // radians per second

/** Bullet pickup configuration */
const BULLET_PICKUP_MODEL = '/theMask/models/pickup_bullets.glb'
const BULLET_PICKUP_RADIUS = 1.2
const BULLET_PICKUP_Y = FLOOR_Y + 0.5

export interface TheMaskEngineOptions {
  mobile?: boolean
  onGameOver?: () => void
  onVictory?: () => void
  onHealthChange?: (health: number, maxHealth: number) => void
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
  private rolies: Rolie[] = []
  /** Rolie visuals: created in engine (box + MeshBasicMaterial). */
  private rolieMeshes: THREE.Object3D[] = []
  private bullets: BulletSpawn[] = []
  private touchState: TouchInputState = DEFAULT_TOUCH_INPUT_STATE
  private currentLevelIndex = Math.min(Math.max(0, START_LEVEL), LEVELS.length - 1)
  private bulletsToRemove = new Set<BulletSpawn>()
  /** Bullets that already applied damage this frame (avoid double damage from collision + sweep). */
  private bulletsHitPlayerThisFrame = new Set<BulletSpawn>()
  private animationId: number | null = null
  private isDisposed = false
  private isPaused = false
  private container: HTMLElement
  private lastAnimationTime: number = 0
  private cameraDist: number
  /** Preloaded audio elements so first play is not truncated. */
  private soundCache: Record<string, HTMLAudioElement> = {}
  /** Level intro: close-up camera, Wave animation, then swoop to normal. */
  private levelIntro: {
    phase: 'closeup' | 'swoop' | 'done'
    closeupEndTime: number
    swoopEndTime: number
    startPos: { x: number; y: number; z: number }
    startLookAt: { x: number; y: number; z: number }
  } | null = null

  /** Active turret explosions; level transition waits until this is empty. */
  private explosions: {
    group: THREE.Group
    particles: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; sizeMul: number }[]
    elapsed: number
    sharedGeo: THREE.BufferGeometry
    flashMesh: THREE.Mesh | null
  }[] = []

  /** Current arena half-extents; set when loading a level (each level has its own dimensions). */
  private currentArenaHalfX = 0
  private currentArenaHalfZ = 0
  private wallBodies: CANNON.Body[] = []
  private curbMeshes: THREE.Mesh[] = []
  private floorMesh: THREE.Mesh | null = null
  private floorGrid: THREE.GridHelper | null = null
  private floorBody: CANNON.Body | null = null
  private onGameOver: (() => void) | undefined
  private onVictory: (() => void) | undefined
  private onHealthChange: ((health: number, maxHealth: number) => void) | undefined
  private gameOverTimer: ReturnType<typeof setTimeout> | null = null

  /** Background music */
  private musicAudio: HTMLAudioElement | null = null

  /** Generated siren when any Rolie is chasing the player. */
  private rolieSirenCtx: AudioContext | null = null
  private rolieSirenOsc: OscillatorNode | null = null
  private rolieSirenPlaying = false

  /** Health pickup */
  private healthPickupMesh: THREE.Object3D | null = null
  private healthPickupTemplate: THREE.Object3D | null = null

  /** Bullet pickup */
  private bulletPickupMesh: THREE.Object3D | null = null
  private bulletPickupTemplate: THREE.Object3D | null = null
  /** Once collected, bullet pickup won't spawn again. */
  private bulletPickupCollected = false

  private rolieSirenStartTime = 0

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
    // Floor and walls are created in loadLevel() from the level's halfX, halfZ
    this.preloadSounds()
    this.startMusic()
    this.onGameOver = options?.onGameOver
    this.onVictory = options?.onVictory
    this.onHealthChange = options?.onHealthChange
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
        const rolieRef = (other as unknown as { rolieRef?: Rolie }).rolieRef
        if (spawn.fromPlayer && turretRef) {
          turretRef.takeDamage(this.player.getBulletDamage())
          this.bulletsToRemove.add(spawn)
        }
        if (spawn.fromPlayer && rolieRef) {
          rolieRef.takeDamage(this.player.getBulletDamage())
          this.bulletsToRemove.add(spawn)
        }
      }
      spawn.collisionHandler = handler
      spawn.body.addEventListener(COLLIDE_EVENT, handler as (e: unknown) => void)
    })
    this.loadPlayerModel()
    this.loadHealthPickupModel()
    this.loadBulletPickupModel()
    this.loadLevel(this.currentLevelIndex, true)

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
        // If level intro is active (e.g. model loaded after first frame), start wave so it plays
        if (this.levelIntro?.phase === 'closeup') this.player.playWave()
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

  private static readonly MUSIC_VOLUME = 0.3
  private static readonly MUSIC_DUCK_VOLUME = 0.15
  private musicDuckTimer: ReturnType<typeof setTimeout> | null = null
  private isMusicMuted = false

  private startMusic() {
    if (this.musicAudio) return
    this.musicAudio = new Audio(SOUND_MUSIC)
    this.musicAudio.loop = true
    this.musicAudio.volume = this.isMusicMuted ? 0 : TheMaskEngine.MUSIC_VOLUME
    this.musicAudio.play().catch(() => {})
  }

  setMusicMuted(muted: boolean) {
    this.isMusicMuted = muted
    if (this.musicAudio) {
      this.musicAudio.volume = muted ? 0 : TheMaskEngine.MUSIC_VOLUME
    }
  }

  getMusicMuted(): boolean {
    return this.isMusicMuted
  }

  private stopMusic() {
    if (this.musicDuckTimer) {
      clearTimeout(this.musicDuckTimer)
      this.musicDuckTimer = null
    }
    if (!this.musicAudio) return
    this.musicAudio.pause()
    this.musicAudio.currentTime = 0
    this.musicAudio = null
  }

  /** Temporarily lower music volume for important sounds */
  private duckMusic(durationMs = 2000) {
    if (!this.musicAudio) return
    this.musicAudio.volume = TheMaskEngine.MUSIC_DUCK_VOLUME
    if (this.musicDuckTimer) clearTimeout(this.musicDuckTimer)
    this.musicDuckTimer = setTimeout(() => {
      if (this.musicAudio) this.musicAudio.volume = TheMaskEngine.MUSIC_VOLUME
      this.musicDuckTimer = null
    }, durationMs)
  }

  private async loadHealthPickupModel() {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const loader = new GLTFLoader()
    loader.load(
      HEALTH_PICKUP_MODEL,
      (gltf) => {
        const model = gltf.scene
        // Scale to a reasonable size
        const box = new THREE.Box3().setFromObject(model)
        const size = new THREE.Vector3()
        box.getSize(size)
        const targetHeight = 1.0
        const scale = targetHeight / Math.max(size.y, 0.001)
        model.scale.setScalar(scale)
        this.healthPickupTemplate = model
        // If a pickup is already spawned (placeholder), replace it
        if (this.healthPickupMesh && this.healthPickupMesh.userData.isPlaceholder) {
          const pos = this.healthPickupMesh.position.clone()
          this.scene.remove(this.healthPickupMesh)
          this.disposeObject3D(this.healthPickupMesh)
          const pickup = model.clone()
          pickup.position.copy(pos)
          this.scene.add(pickup)
          this.healthPickupMesh = pickup
        }
      },
      undefined,
      (err) => console.warn('Failed to load pickup_health.glb', err)
    )
  }

  private async loadBulletPickupModel() {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const loader = new GLTFLoader()
    loader.load(
      BULLET_PICKUP_MODEL,
      (gltf) => {
        const model = gltf.scene
        // Scale to a reasonable size
        const box = new THREE.Box3().setFromObject(model)
        const size = new THREE.Vector3()
        box.getSize(size)
        const targetHeight = 1.0
        const scale = targetHeight / Math.max(size.y, 0.001)
        model.scale.setScalar(scale)
        this.bulletPickupTemplate = model
        // If a pickup is already spawned (placeholder), replace it
        if (this.bulletPickupMesh && this.bulletPickupMesh.userData.isPlaceholder) {
          const pos = this.bulletPickupMesh.position.clone()
          this.scene.remove(this.bulletPickupMesh)
          this.disposeObject3D(this.bulletPickupMesh)
          const pickup = model.clone()
          pickup.position.copy(pos)
          this.scene.add(pickup)
          this.bulletPickupMesh = pickup
        }
      },
      undefined,
      (err) => console.warn('Failed to load pickup_bullets.glb', err)
    )
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

  /** Trigger game over after a delay so player can see death animation */
  private triggerDelayedGameOver() {
    if (this.gameOverTimer) return // Already scheduled
    this.gameOverTimer = setTimeout(() => {
      this.onGameOver?.()
    }, 2000)
  }

  private playLevelVictorySound() {
    this.duckMusic(2000)
    const a = this.getCachedSound(SOUND_LEVEL_VICTORY)
    a.currentTime = 0
    a.play().catch(() => { })
  }

  /** Play a generated mechanical, dirty explosion (turret/rolie destroyed). */
  private playExplosionSound() {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const now = ctx.currentTime
      const duration = 0.5

      // Low rumble (mechanical thud)
      const rumble = ctx.createOscillator()
      const rumbleGain = ctx.createGain()
      rumble.type = 'sawtooth'
      rumble.frequency.setValueAtTime(80, now)
      rumble.frequency.exponentialRampToValueAtTime(25, now + duration)
      rumbleGain.gain.setValueAtTime(0.25, now)
      rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + duration)
      rumble.connect(rumbleGain)
      rumbleGain.connect(ctx.destination)
      rumble.start(now)
      rumble.stop(now + duration)

      // Noise layer (dirty/gritty)
      const bufferSize = ctx.sampleRate * duration
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5)
      }
      const noise = ctx.createBufferSource()
      noise.buffer = buffer
      const noiseGain = ctx.createGain()
      noiseGain.gain.setValueAtTime(0.2, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration)
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(400, now)
      filter.frequency.exponentialRampToValueAtTime(80, now + duration)
      noise.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(ctx.destination)
      noise.start(now)

      // Metallic ring (mechanical)
      const ring = ctx.createOscillator()
      const ringGain = ctx.createGain()
      ring.type = 'square'
      ring.frequency.setValueAtTime(320, now)
      ring.frequency.exponentialRampToValueAtTime(90, now + duration * 0.6)
      ringGain.gain.setValueAtTime(0.08, now)
      ringGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.6)
      ring.connect(ringGain)
      ringGain.connect(ctx.destination)
      ring.start(now)
      ring.stop(now + duration * 0.6)
    } catch {
      // Fallback to file if AudioContext not available
      const a = this.getCachedSound(SOUND_EXPLOSION)
      a.currentTime = 0
      a.volume = 0.6
      a.play().catch(() => { })
    }
  }

  /** Start generated siren sound (Rolie chasing). */
  private startRolieSiren() {
    if (this.rolieSirenPlaying) return
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      this.rolieSirenCtx = ctx
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(400, ctx.currentTime)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime)
      this.rolieSirenOsc = osc
      this.rolieSirenPlaying = true
      this.rolieSirenStartTime = performance.now() / 1000
    } catch {
      this.rolieSirenPlaying = false
    }
  }

  /** Stop Rolie siren and clean up. */
  private stopRolieSiren() {
    if (!this.rolieSirenPlaying || !this.rolieSirenOsc || !this.rolieSirenCtx) return
    try {
      const ctx = this.rolieSirenCtx
      this.rolieSirenOsc.stop(ctx.currentTime)
      this.rolieSirenOsc.disconnect()
    } catch {
      // ignore
    }
    this.rolieSirenOsc = null
    this.rolieSirenCtx = null
    this.rolieSirenPlaying = false
  }

  /** Update siren frequency for warbling (call each frame while playing). */
  private updateRolieSiren(now: number) {
    if (!this.rolieSirenOsc || !this.rolieSirenCtx) return
    const elapsed = now - this.rolieSirenStartTime
    // Siren: oscillate between ~350 and ~650 Hz, ~1.2 Hz cycle
    const freq = 500 + 150 * Math.sin(2 * Math.PI * 1.2 * elapsed)
    this.rolieSirenOsc.frequency.setTargetAtTime(freq, this.rolieSirenCtx.currentTime, 0.02)
  }

  /** Dispose geometry and materials from an Object3D (works for Mesh or Group). */
  private disposeObject3D(obj: THREE.Object3D) {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose()
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose())
          } else {
            child.material.dispose()
          }
        }
      }
    })
  }

  /** Load Rolie GLB model and replace placeholder mesh at given index. */
  private loadRolieModel(idx: number, x: number, z: number) {
    import('three/examples/jsm/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
      const loader = new GLTFLoader()
      loader.load(
        '/theMask/models/rolie_explodie.glb',
        (gltf) => {
          // Check if rolie still exists (may have been removed)
          if (idx >= this.rolieMeshes.length) return
          const oldMesh = this.rolieMeshes[idx]
          this.scene.remove(oldMesh)
          this.disposeObject3D(oldMesh)

          const model = gltf.scene
          // Scale model to reasonable size
          const box = new THREE.Box3().setFromObject(model)
          const size = new THREE.Vector3()
          box.getSize(size)
          const targetHeight = 1.5
          const scale = targetHeight / Math.max(size.y, 0.001)
          model.scale.setScalar(scale)
          model.position.set(x, FLOOR_Y, z)
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true
              child.receiveShadow = true
            }
          })
          this.scene.add(model)
          this.rolieMeshes[idx] = model
        },
        undefined,
        (err) => console.warn('Failed to load rolie_explodie.glb', err)
      )
    })
  }

  /** Apply Rolie explosion at (x, y, z): visual/sound, damage player by distance, destroy boxes in radius. */
  private applyRolieExplosion(px: number, py: number, pz: number) {
    this.spawnExplosion(px, py, pz)
    this.playExplosionSound()
    const playerPos = this.player.body.position
    const dx = playerPos.x - px
    const dy = playerPos.y - py
    const dz = playerPos.z - pz
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (dist <= ROLIE_EXPLOSION_RADIUS && !this.player.isDead() && !this.player.isPlayingDeath()) {
      const t = dist / ROLIE_EXPLOSION_RADIUS
      const damage = ROLIE_EXPLOSION_MIN_DAMAGE + (1 - t) * (ROLIE_EXPLOSION_MAX_DAMAGE - ROLIE_EXPLOSION_MIN_DAMAGE)
      const health = this.player.takeDamage(Math.round(damage))
      this.onHealthChange?.(health, this.player.getMaxHealth())
      if (this.player.isDead()) {
        this.player.playDeath(() => {})
        this.triggerDelayedGameOver()
      } else {
        this.player.playHitReact()
        this.playPlayerHitSound()
      }
    }
    // Push boxes away from explosion instead of destroying them
    const explosionForce = 15
    this.boxes.forEach((box) => {
      const bx = box.body.position.x - px
      const by = box.body.position.y - py
      const bz = box.body.position.z - pz
      const d = Math.sqrt(bx * bx + by * by + bz * bz)
      if (d <= ROLIE_EXPLOSION_RADIUS && d > 0.01) {
        // Normalize direction and apply force inversely proportional to distance
        const strength = explosionForce * (1 - d / ROLIE_EXPLOSION_RADIUS)
        const nx = bx / d
        const ny = (by / d) + 0.5  // Add upward component
        const nz = bz / d
        box.body.applyImpulse(
          new CANNON.Vec3(nx * strength, ny * strength, nz * strength),
          box.body.position
        )
      }
    })
  }

  /** Spawn a low-poly explosion at (x, y, z); runs for EXPLOSION_DURATION. */
  private spawnExplosion(x: number, y: number, z: number) {
    const group = new THREE.Group()
    group.position.set(x, y, z)

    // Central flash: bright sphere that expands and fades quickly
    const flashGeo = new THREE.SphereGeometry(0.5, 8, 6)
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.95,
    })
    const flashMesh = new THREE.Mesh(flashGeo, flashMat)
    flashMesh.scale.setScalar(0.1)
    group.add(flashMesh)

    const particles: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; sizeMul: number }[] = []
    const sharedGeo = new THREE.BoxGeometry(1, 1, 1)
    for (let i = 0; i < EXPLOSION_PARTICLE_COUNT; i++) {
      const sizeMul =
        EXPLOSION_PARTICLE_SIZE_MIN +
        Math.random() * (EXPLOSION_PARTICLE_SIZE_MAX - EXPLOSION_PARTICLE_SIZE_MIN)
      const mat = new THREE.MeshStandardMaterial({
        color: 0xff6600,
        emissive: 0xff2200,
        emissiveIntensity: 1.2,
      })
      const mesh = new THREE.Mesh(sharedGeo, mat)
      mesh.castShadow = true
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const speed = 0.8 + Math.random() * EXPLOSION_SPREAD
      const vx = Math.sin(phi) * Math.cos(theta) * speed
      const vy = Math.sin(phi) * Math.sin(theta) * speed + 1
      const vz = Math.cos(phi) * speed
      mesh.position.set(0, 0, 0)
      mesh.scale.setScalar(sizeMul)
      group.add(mesh)
      particles.push({ mesh, vx, vy, vz, sizeMul })
    }
    this.scene.add(group)
    this.explosions.push({ group, particles, elapsed: 0, sharedGeo, flashMesh })
    this.playExplosionSound()
  }

  private updateExplosions(dt: number) {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i]
      ex.elapsed += dt
      const t = ex.elapsed / EXPLOSION_DURATION
      const fade = Math.max(0, 1 - t * 1.1)

      // Central flash: expand then fade in first EXPLOSION_FLASH_DURATION
      if (ex.flashMesh) {
        const flashT = ex.elapsed / EXPLOSION_FLASH_DURATION
        if (flashT >= 1) {
          ex.group.remove(ex.flashMesh)
          ;(ex.flashMesh.geometry as THREE.BufferGeometry).dispose()
          ;(ex.flashMesh.material as THREE.Material).dispose()
          ex.flashMesh = null
        } else {
          const flashScale = flashT * EXPLOSION_FLASH_MAX_SCALE
          ex.flashMesh.scale.setScalar(flashScale)
          ;(ex.flashMesh.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - flashT)
        }
      }

      ex.particles.forEach((p) => {
        p.mesh.position.x += p.vx * dt
        p.mesh.position.y += p.vy * dt
        p.mesh.position.z += p.vz * dt
        p.mesh.scale.setScalar(p.sizeMul * fade)
        const m = p.mesh.material as THREE.MeshStandardMaterial
        if (m.emissive) m.emissive.multiplyScalar(0.96)
        m.opacity = fade
        m.transparent = true
      })
      if (ex.elapsed >= EXPLOSION_DURATION) {
        this.scene.remove(ex.group)
        ex.particles.forEach((p) => {
          const m = p.mesh.material as THREE.Material
          m.dispose()
        })
        if (ex.flashMesh) {
          ex.flashMesh.geometry.dispose()
          ;(ex.flashMesh.material as THREE.Material).dispose()
        }
        ex.sharedGeo.dispose()
        this.explosions.splice(i, 1)
      }
    }
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
  /** Load level by index. @param resetHealth If true, reset player health to max (used on game start). */
  private loadLevel(index: number, resetHealth = false) {
    this.boxes.forEach((b) => b.dispose(this.scene, this.world))
    this.boxes = []
    this.turrets.forEach((t) => t.dispose(this.scene, this.world))
    this.turrets = []
    this.rolies.forEach((r) => r.dispose(this.world))
    this.rolies = []
    this.rolieMeshes.forEach((m) => {
      this.scene.remove(m)
      this.disposeObject3D(m)
    })
    this.rolieMeshes = []
    // Remove existing health pickup
    if (this.healthPickupMesh) {
      this.scene.remove(this.healthPickupMesh)
      this.disposeObject3D(this.healthPickupMesh)
      this.healthPickupMesh = null
    }
    // Remove existing bullet pickup
    if (this.bulletPickupMesh) {
      this.scene.remove(this.bulletPickupMesh)
      this.disposeObject3D(this.bulletPickupMesh)
      this.bulletPickupMesh = null
    }
    const level = LEVELS[Math.min(index, LEVELS.length - 1)]
    const { halfX, halfZ } = level
    if (halfX !== this.currentArenaHalfX || halfZ !== this.currentArenaHalfZ) {
      this.removeArenaWallsAndCurbs()
      this.currentArenaHalfX = halfX
      this.currentArenaHalfZ = halfZ
      this.setupFloor(halfX, halfZ)
      this.setupWalls(halfX, halfZ)
      this.setupBoundaryVisual(halfX, halfZ)
    }
    this.boxes = createBoxPiles(this.world, this.scene, level.boxes)
    level.turrets.forEach(({ x, z }) => {
      const turret = new Turret(this.world, this.scene, { x, z }, {
        onShoot: (spawn) => {
          this.bullets.push(spawn)
          this.scene.add(spawn.mesh)
          const handler = (e: { body: CANNON.Body }) => {
            if (e.body === this.player.body && !this.bulletsHitPlayerThisFrame.has(spawn)) {
              this.bulletsHitPlayerThisFrame.add(spawn)
              this.bulletsToRemove.add(spawn)
              if (this.player.isDead() || this.player.isPlayingDeath()) return
              const health = this.player.takeDamage(PLAYER_DAMAGE_PER_HIT)
              this.onHealthChange?.(health, this.player.getMaxHealth())
              if (this.player.isDead()) {
                this.player.playDeath(() => {})
                this.triggerDelayedGameOver()
              } else {
                this.player.playHitReact()
                this.playPlayerHitSound()
              }
            }
          }
          spawn.collisionHandler = handler
          spawn.body.addEventListener(COLLIDE_EVENT, handler as (e: unknown) => void)
        },
      })
      this.turrets.push(turret)
    })
    const rolieConfigs = level.rolies ?? []
    rolieConfigs.forEach(({ x, z }, idx) => {
      try {
        const rolie = new Rolie(this.world, { x, z })
        this.rolies.push(rolie)
        // Placeholder box while GLB loads
        const size = 1.5
        const geo = new THREE.BoxGeometry(size, size, size)
        const mat = new THREE.MeshBasicMaterial({ color: 0xff3300 })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(x, FLOOR_Y + size / 2, z)
        this.scene.add(mesh)
        this.rolieMeshes.push(mesh)
        // Load GLB model and replace placeholder
        this.loadRolieModel(idx, x, z)
      } catch (err) {
        console.error('Failed to create Rolie at', x, z, err)
      }
    })
    // Start player at level-defined position, or default to positive corner
    const startX = level.playerStart?.x ?? (halfX - 3)
    const startZ = level.playerStart?.z ?? (halfZ - 2)
    this.player.body.position.set(startX, FLOOR_Y + PLAYER_HEIGHT / 2, startZ)
    this.player.body.velocity.set(0, 0, 0)
    if (resetHealth) {
      this.player.resetHealth()
    }
    this.onHealthChange?.(this.player.getHealth(), this.player.getMaxHealth())

    // Spawn pickups at random positions
    this.spawnHealthPickup(halfX, halfZ, startX, startZ)
    this.spawnBulletPickup(halfX, halfZ, startX, startZ)

    this.startLevelIntro()
  }

  private spawnHealthPickup(halfX: number, halfZ: number, playerX: number, playerZ: number) {
    // Find a random position that is not too close to player start
    const margin = 2
    let pickupX: number
    let pickupZ: number
    const minDistFromPlayer = 5
    let attempts = 0
    do {
      pickupX = (Math.random() * 2 - 1) * (halfX - margin)
      pickupZ = (Math.random() * 2 - 1) * (halfZ - margin)
      attempts++
    } while (
      Math.hypot(pickupX - playerX, pickupZ - playerZ) < minDistFromPlayer &&
      attempts < 20
    )

    // Use loaded model or create placeholder
    if (this.healthPickupTemplate) {
      const pickup = this.healthPickupTemplate.clone()
      pickup.position.set(pickupX, HEALTH_PICKUP_Y, pickupZ)
      this.scene.add(pickup)
      this.healthPickupMesh = pickup
    } else {
      // Placeholder sphere while model loads
      const geo = new THREE.SphereGeometry(0.4, 16, 16)
      const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(pickupX, HEALTH_PICKUP_Y, pickupZ)
      mesh.userData.isPlaceholder = true
      this.scene.add(mesh)
      this.healthPickupMesh = mesh
    }
  }

  private updateHealthPickup(dt: number, playerPos: CANNON.Vec3) {
    if (!this.healthPickupMesh) return

    // Rotate the pickup
    this.healthPickupMesh.rotation.y += HEALTH_PICKUP_ROTATION_SPEED * dt

    // Check collision with player
    const pickupPos = this.healthPickupMesh.position
    const dx = playerPos.x - pickupPos.x
    const dz = playerPos.z - pickupPos.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < HEALTH_PICKUP_RADIUS + PLAYER_RADIUS) {
      // Player picked up health
      const newHealth = this.player.heal(HEALTH_PICKUP_AMOUNT)
      this.onHealthChange?.(newHealth, this.player.getMaxHealth())
      this.playHealthPickupSound()

      // Remove pickup
      this.scene.remove(this.healthPickupMesh)
      this.disposeObject3D(this.healthPickupMesh)
      this.healthPickupMesh = null
    }
  }

  /** Play a generated "powerup" sound when picking up health. */
  private playHealthPickupSound() {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const now = ctx.currentTime
      const duration = 0.35

      // Rising tone (powerup feel)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(400, now)
      osc1.frequency.exponentialRampToValueAtTime(800, now + duration * 0.5)
      osc1.frequency.exponentialRampToValueAtTime(1200, now + duration)
      gain1.gain.setValueAtTime(0.15, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + duration)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + duration)

      // Sparkle layer
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(1000, now)
      osc2.frequency.exponentialRampToValueAtTime(2000, now + duration * 0.3)
      gain2.gain.setValueAtTime(0.08, now)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.3)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now)
      osc2.stop(now + duration * 0.3)

      // Chime
      const osc3 = ctx.createOscillator()
      const gain3 = ctx.createGain()
      osc3.type = 'sine'
      osc3.frequency.setValueAtTime(1600, now + 0.05)
      gain3.gain.setValueAtTime(0, now)
      gain3.gain.linearRampToValueAtTime(0.1, now + 0.05)
      gain3.gain.exponentialRampToValueAtTime(0.001, now + duration)
      osc3.connect(gain3)
      gain3.connect(ctx.destination)
      osc3.start(now + 0.05)
      osc3.stop(now + duration)
    } catch {
      // Silently fail if AudioContext not available
    }
  }

  private spawnBulletPickup(halfX: number, halfZ: number, playerX: number, playerZ: number) {
    // Don't spawn if already collected
    if (this.bulletPickupCollected) return

    // Spawn chance based on level: 0=0%, 1=10%, 2=20%, 3=50%, 4=75%, 5+=100%
    const spawnChances = [0, 0.1, 0.2, 0.5, 0.75, 1, 1]
    const chance = spawnChances[Math.min(this.currentLevelIndex, spawnChances.length - 1)]
    if (Math.random() > chance) return

    // Find a random position that is not too close to player start or health pickup
    const margin = 2
    let pickupX: number
    let pickupZ: number
    const minDistFromPlayer = 5
    const minDistFromHealthPickup = 4
    let attempts = 0
    do {
      pickupX = (Math.random() * 2 - 1) * (halfX - margin)
      pickupZ = (Math.random() * 2 - 1) * (halfZ - margin)
      attempts++
      const distFromPlayer = Math.hypot(pickupX - playerX, pickupZ - playerZ)
      const distFromHealth = this.healthPickupMesh
        ? Math.hypot(pickupX - this.healthPickupMesh.position.x, pickupZ - this.healthPickupMesh.position.z)
        : Infinity
      if (distFromPlayer >= minDistFromPlayer && distFromHealth >= minDistFromHealthPickup) break
    } while (attempts < 30)

    // Use loaded model or create placeholder
    if (this.bulletPickupTemplate) {
      const pickup = this.bulletPickupTemplate.clone()
      pickup.position.set(pickupX, BULLET_PICKUP_Y, pickupZ)
      this.scene.add(pickup)
      this.bulletPickupMesh = pickup
    } else {
      // Placeholder sphere while model loads (orange for bullets)
      const geo = new THREE.SphereGeometry(0.4, 16, 16)
      const mat = new THREE.MeshBasicMaterial({ color: 0xff9800 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(pickupX, BULLET_PICKUP_Y, pickupZ)
      mesh.userData.isPlaceholder = true
      this.scene.add(mesh)
      this.bulletPickupMesh = mesh
    }
  }

  private updateBulletPickup(dt: number, playerPos: CANNON.Vec3) {
    if (!this.bulletPickupMesh) return

    // Rotate the pickup
    this.bulletPickupMesh.rotation.y += HEALTH_PICKUP_ROTATION_SPEED * dt

    // Check collision with player
    const pickupPos = this.bulletPickupMesh.position
    const dx = playerPos.x - pickupPos.x
    const dz = playerPos.z - pickupPos.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < BULLET_PICKUP_RADIUS + PLAYER_RADIUS) {
      // Player picked up bullet powerup
      this.player.powerUpBullets()
      this.playBulletPickupSound()
      this.bulletPickupCollected = true

      // Remove pickup
      this.scene.remove(this.bulletPickupMesh)
      this.disposeObject3D(this.bulletPickupMesh)
      this.bulletPickupMesh = null
    }
  }

  /** Play a generated "powerup" sound when picking up bullet upgrade. */
  private playBulletPickupSound() {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const now = ctx.currentTime
      const duration = 0.4

      // Deep rising tone (power feel)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sawtooth'
      osc1.frequency.setValueAtTime(150, now)
      osc1.frequency.exponentialRampToValueAtTime(400, now + duration)
      gain1.gain.setValueAtTime(0.12, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + duration)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + duration)

      // Mid punch
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'square'
      osc2.frequency.setValueAtTime(300, now)
      osc2.frequency.exponentialRampToValueAtTime(600, now + duration * 0.5)
      gain2.gain.setValueAtTime(0.08, now)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.5)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now)
      osc2.stop(now + duration * 0.5)

      // High ping
      const osc3 = ctx.createOscillator()
      const gain3 = ctx.createGain()
      osc3.type = 'sine'
      osc3.frequency.setValueAtTime(800, now + 0.1)
      osc3.frequency.exponentialRampToValueAtTime(1200, now + duration)
      gain3.gain.setValueAtTime(0, now)
      gain3.gain.linearRampToValueAtTime(0.1, now + 0.1)
      gain3.gain.exponentialRampToValueAtTime(0.001, now + duration)
      osc3.connect(gain3)
      gain3.connect(ctx.destination)
      osc3.start(now + 0.1)
      osc3.stop(now + duration)
    } catch {
      // Silently fail if AudioContext not available
    }
  }

  private startLevelIntro() {
    const p = this.player.body.position
    const now = performance.now() / 1000
    this.levelIntro = {
      phase: 'closeup',
      closeupEndTime: now + INTRO_CLOSEUP_DURATION,
      swoopEndTime: 0,
      startPos: { x: 0, y: 0, z: 0 },
      startLookAt: { x: p.x, y: p.y, z: p.z },
    }
    this.player.playWave()
    this.setCameraCloseup()
  }

  private setCameraCloseup() {
    const p = this.player.body.position
    const dx = Math.sin(this.player.facingAngle)
    const dz = Math.cos(this.player.facingAngle)
    const dist = INTRO_CLOSEUP_DIST
    // Camera in front of player (same direction they face)
    this.camera.position.set(
      p.x + dx * dist,
      p.y + INTRO_CLOSEUP_HEIGHT,
      p.z + dz * dist
    )
    this.camera.lookAt(p.x, p.y, p.z)
  }

  private getNormalCameraPosition(): { pos: { x: number; y: number; z: number }; lookAt: { x: number; y: number; z: number } } {
    const p = this.player.body.position
    const dist = this.cameraDist
    const offsetY = dist * Math.sin(CAMERA_ANGLE)
    const offsetH = dist * Math.cos(CAMERA_ANGLE)
    const offsetX = offsetH * 0.7
    const offsetZ = offsetH * 0.7
    return {
      pos: { x: p.x + offsetX, y: p.y + offsetY, z: p.z + offsetZ },
      lookAt: { x: p.x, y: p.y, z: p.z },
    }
  }

  private updateLevelIntroCamera(now: number) {
    if (!this.levelIntro) return
    const intro = this.levelIntro
    const p = this.player.body.position

    if (intro.phase === 'closeup') {
      this.setCameraCloseup()
      if (now >= intro.closeupEndTime) {
        intro.startPos = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z }
        intro.startLookAt = { x: p.x, y: p.y, z: p.z }
        intro.phase = 'swoop'
        intro.swoopEndTime = now + INTRO_SWOOP_DURATION
      }
      return
    }

    if (intro.phase === 'swoop') {
      const swoopStart = intro.swoopEndTime - INTRO_SWOOP_DURATION
      let t = (now - swoopStart) / INTRO_SWOOP_DURATION
      t = Math.min(1, Math.max(0, t))
      const s = t * t * (3 - 2 * t)
      const target = this.getNormalCameraPosition()
      this.camera.position.set(
        intro.startPos.x + s * (target.pos.x - intro.startPos.x),
        intro.startPos.y + s * (target.pos.y - intro.startPos.y),
        intro.startPos.z + s * (target.pos.z - intro.startPos.z)
      )
      this.camera.lookAt(
        intro.startLookAt.x + s * (target.lookAt.x - intro.startLookAt.x),
        intro.startLookAt.y + s * (target.lookAt.y - intro.startLookAt.y),
        intro.startLookAt.z + s * (target.lookAt.z - intro.startLookAt.z)
      )
      if (t >= 1) {
        this.player.stopWave()
        this.levelIntro = null
      }
    }
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

  private setupFloor(halfX: number, halfZ: number) {
    // Clean up old floor
    if (this.floorMesh) {
      this.scene.remove(this.floorMesh)
      this.floorMesh.geometry.dispose()
      ;(this.floorMesh.material as THREE.Material).dispose()
      this.floorMesh = null
    }
    if (this.floorGrid) {
      this.scene.remove(this.floorGrid)
      this.floorGrid.dispose()
      this.floorGrid = null
    }
    if (this.floorBody) {
      this.world.removeBody(this.floorBody)
      this.floorBody = null
    }

    // Physics floor (infinite plane)
    const floorShape = new CANNON.Plane()
    this.floorBody = new CANNON.Body({
      mass: 0,
      shape: floorShape,
      collisionFilterGroup: 1,
      collisionFilterMask: 1 | 2, // so bullets hit the floor
    })
    this.floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    this.floorBody.position.set(0, FLOOR_Y, 0)
    this.world.addBody(this.floorBody)

    // Dark floor background
    const sizeX = halfX * 2
    const sizeZ = halfZ * 2
    const floorGeo = new THREE.PlaneGeometry(sizeX, sizeZ)
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x111111 })
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat)
    this.floorMesh.rotation.x = -Math.PI / 2
    this.floorMesh.position.y = FLOOR_Y
    this.scene.add(this.floorMesh)

    // Bright grid on top
    const gridSize = Math.max(sizeX, sizeZ)
    const divisions = Math.floor(gridSize) // 1 division per unit
    this.floorGrid = new THREE.GridHelper(gridSize, divisions, 0x00ffff, 0x333333)
    this.floorGrid.position.y = FLOOR_Y + 0.01 // Lift slightly to avoid z-fighting
    this.scene.add(this.floorGrid)
  }

  private setupWalls(halfX: number, halfZ: number) {
    const h = WALL_HEIGHT / 2
    const positions: [number, number, number][] = [
      [-halfX - WALL_THICKNESS / 2, h + FLOOR_Y, 0],
      [halfX + WALL_THICKNESS / 2, h + FLOOR_Y, 0],
      [0, h + FLOOR_Y, -halfZ - WALL_THICKNESS / 2],
      [0, h + FLOOR_Y, halfZ + WALL_THICKNESS / 2],
    ]
    const halfExtents = [
      new CANNON.Vec3(WALL_THICKNESS / 2, WALL_HEIGHT / 2, halfZ + WALL_THICKNESS),
      new CANNON.Vec3(WALL_THICKNESS / 2, WALL_HEIGHT / 2, halfZ + WALL_THICKNESS),
      new CANNON.Vec3(halfX + WALL_THICKNESS, WALL_HEIGHT / 2, WALL_THICKNESS / 2),
      new CANNON.Vec3(halfX + WALL_THICKNESS, WALL_HEIGHT / 2, WALL_THICKNESS / 2),
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
      this.wallBodies.push(body)
    })
  }

  private removeArenaWallsAndCurbs() {
    this.wallBodies.forEach((b) => this.world.removeBody(b))
    this.wallBodies.length = 0
    this.curbMeshes.forEach((m) => {
      this.scene.remove(m)
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
    })
    this.curbMeshes.length = 0
  }

  /** Visible low walls at the play area edges so the user sees the level boundary. */
  private setupBoundaryVisual(halfX: number, halfZ: number) {
    const curbHeight = 0.5
    const curbThickness = 0.4
    const color = 0xb71c1c // dark red / boundary color

    // Left (x = -halfX)
    const leftCurb = new THREE.Mesh(
      new THREE.BoxGeometry(curbThickness, curbHeight, 2 * halfZ),
      new THREE.MeshStandardMaterial({ color })
    )
    leftCurb.position.set(-halfX + curbThickness / 2, FLOOR_Y + curbHeight / 2, 0)
    leftCurb.receiveShadow = true
    leftCurb.castShadow = true
    this.scene.add(leftCurb)
    this.curbMeshes.push(leftCurb)

    // Right (x = +halfX)
    const rightCurb = new THREE.Mesh(
      new THREE.BoxGeometry(curbThickness, curbHeight, 2 * halfZ),
      new THREE.MeshStandardMaterial({ color })
    )
    rightCurb.position.set(halfX - curbThickness / 2, FLOOR_Y + curbHeight / 2, 0)
    rightCurb.receiveShadow = true
    rightCurb.castShadow = true
    this.scene.add(rightCurb)
    this.curbMeshes.push(rightCurb)

    // Back (z = -halfZ)
    const backCurb = new THREE.Mesh(
      new THREE.BoxGeometry(2 * halfX, curbHeight, curbThickness),
      new THREE.MeshStandardMaterial({ color })
    )
    backCurb.position.set(0, FLOOR_Y + curbHeight / 2, -halfZ + curbThickness / 2)
    backCurb.receiveShadow = true
    backCurb.castShadow = true
    this.scene.add(backCurb)
    this.curbMeshes.push(backCurb)

    // Front (z = +halfZ)
    const frontCurb = new THREE.Mesh(
      new THREE.BoxGeometry(2 * halfX, curbHeight, curbThickness),
      new THREE.MeshStandardMaterial({ color })
    )
    frontCurb.position.set(0, FLOOR_Y + curbHeight / 2, halfZ - curbThickness / 2)
    frontCurb.receiveShadow = true
    frontCurb.castShadow = true
    this.scene.add(frontCurb)
    this.curbMeshes.push(frontCurb)
  }

  private animate = () => {
    if (this.isDisposed) return
    this.animationId = requestAnimationFrame(this.animate)
    if (this.isPaused) {
      this.renderer.render(this.scene, this.camera)
      return
    }

    const now = performance.now() / 1000
    this.updateLevelIntroCamera(now)
    this.bulletsHitPlayerThisFrame.clear()

    const inIntro = !!this.levelIntro
    const inDeath = this.player.isPlayingDeath()
    if (!inIntro && !inDeath) {
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
          if (
            !this.bulletsHitPlayerThisFrame.has(spawn) &&
            this.segmentIntersectsSphere(
              prev.x, prev.y, prev.z,
              curr.x, curr.y, curr.z,
              playerBodyPos.x, playerBodyPos.y, playerBodyPos.z,
              playerSphereR
            )
          ) {
            this.bulletsHitPlayerThisFrame.add(spawn)
            this.bulletsToRemove.add(spawn)
            if (this.player.isDead() || this.player.isPlayingDeath()) return
            const health = this.player.takeDamage(PLAYER_DAMAGE_PER_HIT)
            this.onHealthChange?.(health, this.player.getMaxHealth())
            if (this.player.isDead()) {
              this.player.playDeath(() => {})
              this.triggerDelayedGameOver()
            } else {
              this.player.playHitReact()
              this.playPlayerHitSound()
            }
          }
        }
      }
    })
    this.player.clampToArena(this.currentArenaHalfX, this.currentArenaHalfZ)
    this.player.syncMesh()
    const animDt = this.lastAnimationTime > 0 ? now - this.lastAnimationTime : PHYSICS_DT
    this.lastAnimationTime = now
    this.player.updateAnimation(animDt)
    this.boxes.forEach((b) => b.syncMesh())
    const playerPos = { x: this.player.body.position.x, z: this.player.body.position.z }
    this.turrets.forEach((t) => t.update(PHYSICS_DT, playerPos))
    this.rolies.forEach((r) => r.update(PHYSICS_DT, playerPos, this.currentArenaHalfX, this.currentArenaHalfZ))
    const anyRolieCharging = this.rolies.some((r) => r.isCharging())
    if (anyRolieCharging && !this.rolieSirenPlaying) this.startRolieSiren()
    if (this.rolieSirenPlaying) this.updateRolieSiren(now)
    if (!anyRolieCharging && this.rolieSirenPlaying) this.stopRolieSiren()
    // Sync rolie mesh position and rotation from Rolie
    this.rolieMeshes.forEach((mesh, i) => {
      const r = this.rolies[i]
      if (r) {
        mesh.position.set(r.position.x, r.position.y + ROLIE_MESH_Y_OFFSET, r.position.z)
        mesh.rotation.y = r.facingAngle
      }
    })
    // Manual bullet-rolie collision (sphere vs rolie body)
    // Use larger hit radius than physics body for easier targeting
    const rolieHitRadius = ROLIE_BODY_RADIUS * 2.0 + BULLET_RADIUS_SWEEP
    this.bullets.forEach((spawn) => {
      if (!spawn.fromPlayer) return
      if (this.bulletsToRemove.has(spawn)) return
      const bp = spawn.body.position
      for (const r of this.rolies) {
        if (!r.isAlive()) continue
        const dx = bp.x - r.position.x
        const dy = bp.y - r.position.y
        const dz = bp.z - r.position.z
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (dist < rolieHitRadius) {
          r.takeDamage(this.player.getBulletDamage())
          this.bulletsToRemove.add(spawn)
          break
        }
      }
    })
    this.bullets.forEach(syncBulletMesh)
    this.updateExplosions(animDt)
    this.updateHealthPickup(animDt, playerBodyPos)
    this.updateBulletPickup(animDt, playerBodyPos)
    if (!this.levelIntro) this.updateCameraFollow()

    this.bulletsToRemove.forEach((spawn) => {
      disposeBullet(spawn, this.scene, this.world)
      const i = this.bullets.indexOf(spawn)
      if (i !== -1) this.bullets.splice(i, 1)
    })
    this.bulletsToRemove.clear()

    const toRemove: number[] = []
    this.bullets.forEach((spawn, i) => {
      if (isBulletOutOfBounds(spawn.body, spawn.createdAt, this.currentArenaHalfX, this.currentArenaHalfZ)) {
        toRemove.push(i)
      }
    })
    toRemove.reverse().forEach((i) => {
      const spawn = this.bullets[i]
      disposeBullet(spawn, this.scene, this.world)
      this.bullets.splice(i, 1)
    })

    const deadTurrets = this.turrets.filter((t) => !t.isAlive())
    deadTurrets.forEach((t) => {
      const p = t.body.position
      this.spawnExplosion(p.x, p.y, p.z)
      this.playExplosionSound()
      t.dispose(this.scene, this.world)
    })
    this.turrets = this.turrets.filter((t) => t.isAlive())

    // Rolie removal only (explosion disabled for now): remove dead rolies or those too close, without applying explosion
    const roliesToRemove: Rolie[] = []
    this.rolies.forEach((r) => {
      if (!r.isAlive()) {
        roliesToRemove.push(r)
        return
      }
      const dx = playerBodyPos.x - r.position.x
      const dz = playerBodyPos.z - r.position.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (r.isArmed() && dist <= ROLIE_EXPLODE_ON_PLAYER_DIST) roliesToRemove.push(r)
    })
    const rolieIndicesToRemove = roliesToRemove.map((r) => this.rolies.indexOf(r)).sort((a, b) => b - a)
    roliesToRemove.forEach((r) => {
      const p = r.position
      this.applyRolieExplosion(p.x, p.y, p.z)
      r.dispose(this.world)
    })
    rolieIndicesToRemove.forEach((idx) => {
      if (idx >= 0 && idx < this.rolieMeshes.length) {
        const obj = this.rolieMeshes[idx]
        this.scene.remove(obj)
        this.disposeObject3D(obj)
        this.rolieMeshes.splice(idx, 1)
      }
    })
    this.rolies = this.rolies.filter((r) => !roliesToRemove.includes(r))

    const level = LEVELS[this.currentLevelIndex]
    const levelHasEnemies = (level.turrets?.length ?? 0) > 0 || (level.rolies?.length ?? 0) > 0
    const playerAlive = !this.player.isDead() && !this.player.isPlayingDeath()
    if (
      playerAlive &&
      this.turrets.length === 0 &&
      this.rolies.length === 0 &&
      this.explosions.length === 0 &&
      levelHasEnemies
    ) {
      // Check if this was the last level
      if (this.currentLevelIndex >= LEVELS.length - 1) {
        this.playLevelVictorySound()
        this.onVictory?.()
      } else {
        this.playLevelVictorySound()
        this.currentLevelIndex++
        this.loadLevel(this.currentLevelIndex)
      }
    }

    this.renderer.render(this.scene, this.camera)
  }

  setTouchControls(state: TouchInputState) {
    this.touchState = state
  }

  pause() {
    this.isPaused = true
  }

  resume() {
    this.isPaused = false
  }

  dispose() {
    this.isDisposed = true
    this.stopRolieSiren()
    this.stopMusic()
    if (this.gameOverTimer) {
      clearTimeout(this.gameOverTimer)
      this.gameOverTimer = null
    }
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
    this.rolies.forEach((r) => r.dispose(this.world))
    this.rolies = []
    this.rolieMeshes.forEach((m) => {
      this.scene.remove(m)
      this.disposeObject3D(m)
    })
    this.rolieMeshes = []
    if (this.healthPickupMesh) {
      this.scene.remove(this.healthPickupMesh)
      this.disposeObject3D(this.healthPickupMesh)
      this.healthPickupMesh = null
    }
    if (this.healthPickupTemplate) {
      this.disposeObject3D(this.healthPickupTemplate)
      this.healthPickupTemplate = null
    }
    if (this.bulletPickupMesh) {
      this.scene.remove(this.bulletPickupMesh)
      this.disposeObject3D(this.bulletPickupMesh)
      this.bulletPickupMesh = null
    }
    if (this.bulletPickupTemplate) {
      this.disposeObject3D(this.bulletPickupTemplate)
      this.bulletPickupTemplate = null
    }
    if (this.floorMesh) {
      this.scene.remove(this.floorMesh)
      this.floorMesh.geometry.dispose()
      ;(this.floorMesh.material as THREE.Material).dispose()
      this.floorMesh = null
    }
    if (this.floorGrid) {
      this.scene.remove(this.floorGrid)
      this.floorGrid.dispose()
      this.floorGrid = null
    }
    if (this.floorBody) {
      this.world.removeBody(this.floorBody)
      this.floorBody = null
    }
    this.explosions.forEach((ex) => {
      this.scene.remove(ex.group)
      ex.particles.forEach((p) => {
        const m = p.mesh.material as THREE.Material
        m.dispose()
      })
      if (ex.flashMesh) {
        ex.flashMesh.geometry.dispose()
        ;(ex.flashMesh.material as THREE.Material).dispose()
      }
      ex.sharedGeo.dispose()
    })
    this.explosions = []
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
