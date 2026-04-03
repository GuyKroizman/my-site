import * as THREE from 'three'
import { Bullet } from './Bullet'
import { Car } from './Car'
import { Track } from './Track'
import { RaceManager } from './RaceManager'
import { StartLights } from './StartLights'
import { Mine } from './Mine'
import { SoundGenerator } from './SoundGenerator'
import { PlayerArrow } from './PlayerArrow'
import { BackgroundEye } from './BackgroundEye'
import { DecorationGrid } from './DecorationGrid'
import { TimerBillboard } from './TimerBillboard'
import { Ball, DEFAULT_DROP_HEIGHT } from './Ball'
import { LapDigitDropEffect } from './LapDigitDropEffect'
import { LevelConfig, CarConfig, BallDropConfig } from './levels'
import { DECORATION_BOUNDS, DECORATION_MODELS } from './levels/decorationConfig'
import type { TouchDriveState } from './input'
import type { PlayerUpgrades, UpgradeId } from './upgrades'
import { DEFAULT_PLAYER_UPGRADES, getFireButtonWeapons, getWeaponIcon } from './upgrades'

const BALL_SPAWN_MAX_ATTEMPTS = 8
const BALL_SPAWN_MARGIN = 0.2

export interface RacingGameCallbacks {
  onRaceComplete: (results: { winner: string; second: string; third: string; times: { [name: string]: number } }) => void
  onLapComplete?: (laps: number) => void
  onTimerUpdate?: (time: number) => void
  onCarFinished?: (carName: string, screenPos: { x: number; y: number }) => void
  onCameraReady?: (screenPos: { x: number; y: number }) => void
  onWeaponRotated?: (activeIcon: string, nextIcon: string) => void
}

export class RacingGameEngine {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private cars: Car[] = []
  private track: Track
  private raceManager: RaceManager
  private startLights: StartLights | null = null
  private animationId: number | null = null
  private callbacks: RacingGameCallbacks
  private isDisposed: boolean = false
  private raceStartTime: number = 0
  private timerActive: boolean = false
  private lastFrameTime: number = 0
  private frameInterval: number = 1000 / 60 // 16.67ms for 60 FPS
  private lastRenderTime: number = 0
  private currentLevelConfig: LevelConfig
  private isPaused: boolean = false
  private pauseStartTime: number = 0
  private totalPauseTime: number = 0
  private mine: Mine | null = null
  private soundGenerator: SoundGenerator = new SoundGenerator()
  private playerArrow: PlayerArrow | null = null
  private playerMineHitTime: number | null = null
  private backgroundTexture: THREE.Texture | null = null
  private backgroundEyes: BackgroundEye[] = []
  private decorationGrid: DecorationGrid | null = null
  private timerBillboard: TimerBillboard | null = null
  private lapDigitDropEffect: LapDigitDropEffect
  private balls: Ball[] = []
  private pendingBallDrops: BallDropConfig[] = []
  private bullets: Bullet[] = []
  private shootCooldown: number = 0
  private touchShoot: boolean = false
  private spacePressed: boolean = false
  private spaceKeyDownHandler: ((e: KeyboardEvent) => void) | null = null
  private spaceKeyUpHandler: ((e: KeyboardEvent) => void) | null = null
  private levelMineArmed: boolean = false

  // Player upgrades & weapon switching
  private playerUpgrades: PlayerUpgrades
  private playerMines: Mine[] = []
  private fireWeapons: UpgradeId[] = []
  private activeWeaponIndex: number = 0

  // Turbo boost state
  private turboBoostActive: boolean = false
  private turboBoostTimer: number = 0
  private turboBoostCooldown: number = 0
  private readonly TURBO_BOOST_DURATION: number = 1.0
  private readonly TURBO_BOOST_COOLDOWN: number = 3.0
  private readonly TURBO_BOOST_MULTIPLIER: number = 1.5
  private playerBaseMaxSpeed: number = 0

  // Camera shake
  private shakeTimer: number = 0
  private shakeDuration: number = 0
  private shakeIntensity: number = 0

  // Cinematic camera intro
  private cinematicActive: boolean = false
  private cinematicTimer: number = 0
  private gameplayCameraPos: THREE.Vector3 = new THREE.Vector3()
  private cinematicStartPos: THREE.Vector3 = new THREE.Vector3()
  private cinematicStartLookAt: THREE.Vector3 = new THREE.Vector3()
  private readonly CINEMATIC_HOLD_DURATION: number = 0.5
  private readonly CINEMATIC_SWEEP_DURATION: number = 2.0

  constructor(container: HTMLElement, callbacks: RacingGameCallbacks, levelConfig: LevelConfig, upgrades?: PlayerUpgrades) {
    // Wrap callbacks so we play finish sound when any car crosses the line, then invoke the provided callback
    const userCallbacks = callbacks
    this.callbacks = {
      ...userCallbacks,
      onCarFinished: (carName: string, screenPos: { x: number; y: number }) => {
        this.soundGenerator.playFinishSound()
        userCallbacks.onCarFinished?.(carName, screenPos)
      }
    }
    this.currentLevelConfig = levelConfig
    this.playerUpgrades = upgrades ?? { ...DEFAULT_PLAYER_UPGRADES, selectedIds: new Set() }

    // Ensure container is properly sized
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      console.warn('Container has zero dimensions, using window size')
    }

    // Scene setup
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x87ceeb)
    this.scene.backgroundRotation.set(0, 0, 0)
    if (levelConfig.id === 1) {
      const loader = new THREE.TextureLoader()
      loader.load('/racing/sunset-skybox.png', (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping
        texture.colorSpace = THREE.SRGBColorSpace
        this.scene.background = texture
        this.scene.backgroundRotation.set(0, Math.PI, 0)
        this.backgroundTexture = texture
      })
    }

    // Camera setup - top-down, slightly angled
    const width = Math.max(container.clientWidth || window.innerWidth, 1)
    const height = Math.max(container.clientHeight || window.innerHeight, 1)
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    // Position camera to show the entire track centered
    // Track is 30x20, centered at (0, 0, 0), start line at z: -10
    // Adjust camera position based on aspect ratio for portrait mode
    this.updateCameraPosition(width, height)
    this.camera.lookAt(0, 0, 0)

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    // Limit pixel ratio to 1 for consistent performance (prevents high-DPI scaling issues)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1))
    this.renderer.setSize(width, height, false) // false = don't update style
    this.renderer.shadowMap.enabled = true
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.25
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.renderer.domElement.style.margin = '0'
    this.renderer.domElement.style.padding = '0'
    container.style.overflow = 'hidden'
    // Insert canvas first so React-rendered overlays (HUD, confetti) paint on top
    container.insertBefore(this.renderer.domElement, container.firstChild)

    // Handle window resize and orientation changes
    const handleResize = () => {
      // Use requestAnimationFrame to ensure layout is complete
      requestAnimationFrame(() => {
        const newWidth = Math.max(container.clientWidth || window.innerWidth, 1)
        const newHeight = Math.max(container.clientHeight || window.innerHeight, 1)

        if (newWidth > 0 && newHeight > 0) {
          this.camera.aspect = newWidth / newHeight
          this.updateCameraPosition(newWidth, newHeight)
          if (!this.cinematicActive) {
            this.camera.lookAt(0, 0, 0)
          }
          this.camera.updateProjectionMatrix()
          this.renderer.setSize(newWidth, newHeight, false) // false = don't update style
        }
      })
    }

    // Initial resize to ensure proper sizing
    handleResize()

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', () => {
      // Delay to allow orientation change to complete
      setTimeout(handleResize, 100)
    })

    // Create track (with level-specific ground/grass theme)
    this.track = new Track(this.scene, undefined, this.currentLevelConfig.groundTheme)

    // Create navigation grid for A* pathfinding
    this.track.createNavigationGrid(1.0)

    // Create race manager with level-specific required laps
    this.raceManager = new RaceManager(this.callbacks, this.currentLevelConfig.requiredLaps)
    this.raceManager.setFinishScreenPosGetter(() => this.projectFinishLine())

    // Create start lights
    this.startLights = new StartLights(this.scene, () => {
      // Start lights sequence complete
    })

    // Create timer billboard
    this.timerBillboard = new TimerBillboard(this.scene)
    this.lapDigitDropEffect = new LapDigitDropEffect(this.scene)

    // Setup lighting (brighter so car models are more visible)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95)
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
    directionalLight.position.set(10, 20, 10)
    directionalLight.castShadow = true
    this.scene.add(directionalLight)

    // Fill light from the opposite side to reduce dark shadows on cars
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4)
    fillLight.position.set(-8, 12, -8)
    this.scene.add(fillLight)

    // Create cars
    this.createCars()

    // Apply player upgrades to player car
    const playerCar = this.cars.find(car => car.isPlayer)
    if (playerCar) {
      playerCar.maxSpeed *= this.playerUpgrades.speedMultiplier
      playerCar.turnSpeed *= this.playerUpgrades.turnSpeedMultiplier
      playerCar.hasRam = this.playerUpgrades.hasRam
      this.playerBaseMaxSpeed = playerCar.maxSpeed
    }

    // Build fire-button weapon list for weapon switching
    this.fireWeapons = getFireButtonWeapons(this.playerUpgrades)
    this.activeWeaponIndex = 0

    // Initialize cinematic camera intro
    this.initCinematicCamera()

    // Create player indicator arrow (visible during countdown)
    this.playerArrow = new PlayerArrow(this.scene)

    // Spawn mine on levels 2 and above (one per level, random position on track)
    if (this.currentLevelConfig.id >= 2) {
      const minePos = this.track.getRandomPointOnTrack()
      this.mine = new Mine(this.scene, minePos.x, minePos.z, 2.0, false)
    }

    // Initialize pending ball drops from level config
    this.pendingBallDrops = [...(this.currentLevelConfig.ballDrops ?? [])]

    if (this.currentLevelConfig.id === 1) {
      this.backgroundEyes.push(
        new BackgroundEye(this.scene, {
          position: { x: 62, y: 4, z: -25 },
          stroll: {
            delay: 10,
            duration: 15,
            endPosition: { x: 10, y: 4, z: -17 }
          }
        })
      )
      this.backgroundEyes.push(
        new BackgroundEye(this.scene, {
          position: { x: 62, y: 4, z: -25 },
          scaleMultiplier: 0.5,
          stroll: {
            delay: 24,
            duration: 10,
            endPosition: { x: 5, y: 4, z: -22 }
          }
        })
      )
    }

    if (this.currentLevelConfig.decorationRows?.length) {
      this.decorationGrid = new DecorationGrid(
        this.scene,
        DECORATION_BOUNDS,
        DECORATION_MODELS,
        this.currentLevelConfig.decorationRows
      )
    }

    // Setup keys for shooting (X) and weapon switching (Z)
    this.spaceKeyDownHandler = (e: KeyboardEvent) => {
      if (e.code === 'KeyX') {
        this.spacePressed = true
      }
      if (e.code === 'KeyZ') {
        this.rotateWeapon()
      }
    }
    this.spaceKeyUpHandler = (e: KeyboardEvent) => {
      if (e.code === 'KeyX') {
        this.spacePressed = false
      }
    }
    window.addEventListener('keydown', this.spaceKeyDownHandler)
    window.addEventListener('keyup', this.spaceKeyUpHandler)

    // Initialize frame time tracking
    this.lastFrameTime = performance.now() / 1000
    this.lastRenderTime = performance.now()

    // Start render loop
    this.animate()
  }

  private projectFinishLine(): { x: number; y: number } {
    const pos = new THREE.Vector3(0, 0.5, -7).project(this.camera)
    return {
      x: (pos.x * 0.5 + 0.5) * window.innerWidth,
      y: (-pos.y * 0.5 + 0.5) * window.innerHeight
    }
  }

  private updateCameraPosition(viewWidth: number, viewHeight: number) {
    const aspect = viewWidth / viewHeight
    const trackWidth = 50
    const fovRad = (this.camera.fov * Math.PI) / 180
    const baseCameraY = 25
    const baseCameraZ = 26

    if (aspect < 1) {
      const requiredY = trackWidth / (2 * Math.tan(fovRad / 2) * aspect)
      const requiredZ = requiredY * (baseCameraZ / baseCameraY)
      this.gameplayCameraPos.set(0, requiredY, requiredZ)
    } else {
      this.gameplayCameraPos.set(0, baseCameraY, baseCameraZ)
    }

    if (!this.cinematicActive) {
      this.camera.position.copy(this.gameplayCameraPos)
    }
  }

  private smootherstep(t: number): number {
    t = Math.max(0, Math.min(1, t))
    return t * t * t * (t * (t * 6 - 15) + 10)
  }

  private initCinematicCamera() {
    const carConfigs = this.currentLevelConfig.cars
    let centerX = 0, centerZ = 0
    carConfigs.forEach(config => {
      centerX += config.x
      centerZ += config.z
    })
    centerX /= carConfigs.length
    centerZ /= carConfigs.length

    this.cinematicStartPos.set(centerX + 8, 1.5, centerZ)
    this.cinematicStartLookAt.set(centerX - 2, 0.5, centerZ)

    this.camera.position.copy(this.cinematicStartPos)
    this.camera.lookAt(this.cinematicStartLookAt)

    this.cinematicActive = true
    this.cinematicTimer = 0
  }

  private updateCinematicCamera(deltaTime: number) {
    if (!this.cinematicActive) return

    this.cinematicTimer += deltaTime

    if (this.cinematicTimer <= this.CINEMATIC_HOLD_DURATION) {
      this.camera.position.copy(this.cinematicStartPos)
      this.camera.lookAt(this.cinematicStartLookAt)
      return
    }

    const sweepTime = this.cinematicTimer - this.CINEMATIC_HOLD_DURATION
    const t = Math.min(sweepTime / this.CINEMATIC_SWEEP_DURATION, 1)
    const easedT = this.smootherstep(t)

    this.camera.position.lerpVectors(this.cinematicStartPos, this.gameplayCameraPos, easedT)

    const currentLookAt = new THREE.Vector3().lerpVectors(
      this.cinematicStartLookAt,
      new THREE.Vector3(0, 0, 0),
      easedT
    )
    this.camera.lookAt(currentLookAt)

    if (t >= 1) {
      this.cinematicActive = false
      this.camera.position.copy(this.gameplayCameraPos)
      this.camera.lookAt(0, 0, 0)

      this.callbacks.onCameraReady?.(this.projectFinishLine())

      if (this.startLights) {
        this.startLights.startSequence()
      }
    }
  }

  private createCars() {
    Car.resetAiIndex()
    // Use car configurations from the current level
    const carConfigs = this.currentLevelConfig.cars

    carConfigs.forEach((config: CarConfig) => {
      const car = new Car(
        config.x,
        0.5,
        config.z,
        config.color,
        config.name,
        config.isPlayer,
        config.characteristics,
        config.modelPath
      )
      this.cars.push(car)
      this.scene.add(car.mesh)
      car.addHealthBarToScene(this.scene)
      car.showBoundingBoxHelper(this.scene)
      this.raceManager.addCar(car, this.track)
      // Don't give AI cars initial speed - they'll wait for green light
    })
  }

  private animate = () => {
    // Stop animation if disposed
    if (this.isDisposed) {
      return
    }

    this.animationId = requestAnimationFrame(this.animate)

    // If paused, only render the scene (no updates)
    if (this.isPaused) {
      this.renderer.render(this.scene, this.camera)
      return
    }

    // Frame rate limiting: only render if enough time has passed
    const currentTime = performance.now()
    const elapsed = currentTime - this.lastRenderTime

    if (elapsed < this.frameInterval) {
      // Not enough time has passed, skip this frame
      return
    }

    this.lastRenderTime = currentTime - (elapsed % this.frameInterval)

    // Calculate actual delta time for smooth animation
    const currentTimeSeconds = currentTime / 1000
    let deltaTime = currentTimeSeconds - this.lastFrameTime
    this.lastFrameTime = currentTimeSeconds

    // Clamp deltaTime to prevent large jumps (e.g., when tab is inactive)
    if (deltaTime > 0.1) deltaTime = 0.016 // Cap at ~60fps equivalent
    if (deltaTime <= 0) deltaTime = 0.016 // Prevent negative or zero deltaTime

    // Update start lights
    if (this.startLights) {
      this.startLights.update(deltaTime)
    }

    // Check if race is complete
    const raceComplete = this.raceManager.isRaceComplete()

    // Update timer and notify callback
    if (this.timerActive && !raceComplete) {
      const currentTime = performance.now() / 1000
      const elapsedTime = currentTime - this.raceStartTime - this.totalPauseTime
      if (this.callbacks.onTimerUpdate) {
        this.callbacks.onTimerUpdate(elapsedTime)
      }
      if (this.timerBillboard) {
        this.timerBillboard.update(elapsedTime)
      }
    }

    // Update cars - pass start lights state
    const canStart = this.startLights ? this.startLights.isGreen() : false

    // Start timer the moment cars can go
    if (canStart && !this.timerActive) {
      this.timerActive = true
      this.raceStartTime = performance.now() / 1000
      if (this.mine && !this.levelMineArmed) {
        this.mine.startActivationCountdown()
        this.levelMineArmed = true
      }
    }

    // Update player arrow (show during countdown, hide once race starts)
    if (this.playerArrow) {
      if (canStart) {
        this.playerArrow.hide()
      } else {
        const playerCar = this.cars.find(car => car.isPlayer)
        if (playerCar) {
          this.playerArrow.update(deltaTime, playerCar.position)
        }
      }
    }

    this.cars.forEach(car => {
      car.update(deltaTime, this.track, this.cars, raceComplete, canStart)
    })

    // Check car–mine collision (only one mine per level; first collision destroys it)
    if (this.mine && !raceComplete && canStart && this.mine.isActive()) {
      for (const car of this.cars) {
        if (car.launched || car.finished) continue
        if (this.mine.collidesWith(car.position)) {
          car.applyExplosionForce(this.mine.getPosition())
          this.soundGenerator.playExplosionSound()
          if (car.isPlayer) {
            this.playerMineHitTime = performance.now() / 1000
          }
          this.mine.destroy()
          this.mine = null
          break
        }
      }
    }

    // Spawn pending ball drops based on elapsed race time
    if (this.timerActive && !raceComplete) {
      const elapsed = performance.now() / 1000 - this.raceStartTime - this.totalPauseTime
      for (let i = this.pendingBallDrops.length - 1; i >= 0; i--) {
        const drop = this.pendingBallDrops[i]
        if (elapsed >= drop.dropTime) {
          this.spawnBall(drop)
          this.pendingBallDrops.splice(i, 1)
        }
      }
    }

    // Update balls and handle explosions + chain reactions (skip after race ends)
    if (!raceComplete) {
      const newlyExplodedPositions: THREE.Vector3[] = []
      for (let i = this.balls.length - 1; i >= 0; i--) {
        const ball = this.balls[i]
        const result = ball.update(deltaTime, this.cars, this.track)
        if (result.exploded) {
          if (result.playerLaunched && this.playerMineHitTime === null) {
            this.playerMineHitTime = performance.now() / 1000
          }
          if (result.explosionPosition) {
            newlyExplodedPositions.push(result.explosionPosition)
            this.triggerCameraShake(0.5, 0.6)
          }
        }
        // Remove balls whose explosion animation has finished
        if (ball.exploded && !ball.isExplosionAnimating) {
          ball.dispose()
          this.balls.splice(i, 1)
        }
      }
      this.resolveBallCollisions()
      // Chain reactions: exploding balls trigger nearby balls
      if (newlyExplodedPositions.length > 0) {
        for (const ball of this.balls) {
          if (ball.exploded) continue
          for (const pos of newlyExplodedPositions) {
            if (ball.isInChainReactionRange(pos)) {
              if (ball.activated) {
                ball.triggerImmediateDetonation()
              } else {
                ball.triggerActivation()
              }
              break
            }
          }
        }
      }
    }

    // End race 3 seconds after player car is destroyed (by explosions, bullets, etc.)
    if (this.playerMineHitTime === null && !raceComplete) {
      const playerCar = this.cars.find(car => car.isPlayer)
      if (playerCar && playerCar.isDestroyed) {
        this.playerMineHitTime = performance.now() / 1000
      }
    }

    // End race 3 seconds after player hit a mine or was destroyed
    if (this.playerMineHitTime !== null && !raceComplete) {
      const elapsed = performance.now() / 1000 - this.playerMineHitTime
      if (elapsed >= 3) {
        this.playerMineHitTime = null
        this.raceManager.forceComplete()
      }
    }

    // Update race manager (only if race not complete)
    if (!raceComplete) {
      const currentTime = performance.now() / 1000
      const elapsedRaceTime = this.timerActive ? (currentTime - this.raceStartTime - this.totalPauseTime) : 0
      this.raceManager.update(deltaTime, this.track, elapsedRaceTime)
    }

    // Handle shooting / fire button actions based on active weapon
    this.shootCooldown = Math.max(0, this.shootCooldown - deltaTime)
    if (this.fireWeapons.length > 0 && (this.spacePressed || this.touchShoot) && this.shootCooldown <= 0 && canStart && !raceComplete) {
      const activeWeapon = this.fireWeapons[this.activeWeaponIndex]
      switch (activeWeapon) {
        case 'gun': this.shootBullet(); break
        case 'mines': this.dropPlayerMine(); break
        case 'turbo_boost': this.activateTurboBoost(); break
      }
    }

    // Update turbo boost
    if (this.turboBoostActive) {
      this.turboBoostTimer -= deltaTime
      if (this.turboBoostTimer <= 0) {
        this.turboBoostActive = false
        const pc = this.cars.find(car => car.isPlayer)
        if (pc) pc.maxSpeed = this.playerBaseMaxSpeed
        this.turboBoostCooldown = this.TURBO_BOOST_COOLDOWN
      }
    }
    if (this.turboBoostCooldown > 0) {
      this.turboBoostCooldown = Math.max(0, this.turboBoostCooldown - deltaTime)
    }

    // Check player-dropped mine collisions
    for (let i = this.playerMines.length - 1; i >= 0; i--) {
      const mine = this.playerMines[i]
      if (!mine.isActive()) continue
      let mineHit = false
      for (const car of this.cars) {
        if (car.launched || car.finished) continue
        if (mine.collidesWith(car.position)) {
          car.applyExplosionForce(mine.getPosition())
          this.soundGenerator.playExplosionSound()
          if (car.isPlayer) {
            this.playerMineHitTime = performance.now() / 1000
          }
          mineHit = true
          break
        }
      }
      if (mineHit) {
        mine.destroy()
        this.playerMines.splice(i, 1)
      }
    }

    // Update bullets and check collisions with AI cars
    const aiCars = this.cars.filter(car => !car.isPlayer)
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i]
      bullet.update(deltaTime)
      let hit = false
      if (!bullet.isExpired()) {
        for (const car of aiCars) {
          if (!car.isDestroyed && !car.finished && bullet.checkCollision(car)) {
            const wasAlive = !car.isDestroyed
            car.takeDamage()
            if (wasAlive && car.isDestroyed) {
              this.soundGenerator.playExplosionSound(0.5)
            } else {
              this.soundGenerator.playBulletImpact()
            }
            hit = true
            break
          }
        }
      }
      if (hit || bullet.isExpired()) {
        bullet.dispose(this.scene)
        this.bullets.splice(i, 1)
      }
    }

    this.updateCinematicCamera(deltaTime)

    this.backgroundEyes.forEach((eye) => eye.update(deltaTime))
    this.lapDigitDropEffect.update(deltaTime)

    // Apply camera shake
    this.updateCameraShake(deltaTime)

    // Render
    this.renderer.render(this.scene, this.camera)

    // Restore camera position after render so shake doesn't accumulate
    if (this.shakeTimer > 0 && !this.cinematicActive) {
      this.camera.position.copy(this.gameplayCameraPos)
    }
  }

  public startRace() {
    // Clear any bullets, balls, and player mines from a previous race
    this.bullets.forEach(b => b.dispose(this.scene))
    this.bullets = []
    this.shootCooldown = 0
    this.balls.forEach(b => b.dispose())
    this.balls = []
    this.playerMines.forEach(m => m.destroy())
    this.playerMines = []
    this.turboBoostActive = false
    this.turboBoostTimer = 0
    this.turboBoostCooldown = 0
    this.pendingBallDrops = [...(this.currentLevelConfig.ballDrops ?? [])]
    this.levelMineArmed = false
    this.lapDigitDropEffect.clear()

    // Reset timer
    this.timerActive = false
    this.raceStartTime = 0
    this.totalPauseTime = 0
    this.pauseStartTime = 0
    this.playerMineHitTime = null

    // Reset cinematic camera
    this.initCinematicCamera()

    // Reset start lights
    if (this.startLights) {
      this.startLights.reset()
    }

    // Show player arrow again for countdown
    if (this.playerArrow) {
      this.playerArrow.show()
    }

    // Start lights will begin sequence automatically
    // Race manager will start when lights complete
    this.raceManager.startRace(this.track)
    this.cars.forEach(car => car.startRace())
  }

  public reset() {
    this.raceManager.reset(this.track)
    const carConfigs = this.currentLevelConfig.cars
    this.cars.forEach((car, index) => {
      if (index < carConfigs.length) {
        car.reset(carConfigs[index].x, carConfigs[index].z)
      }
    })
  }

  public setTouchControls(controls: TouchDriveState) {
    const playerCar = this.cars.find(car => car.isPlayer)
    if (playerCar) {
      playerCar.setTouchControls(controls)
    }
  }

  public setTouchShoot(shooting: boolean) {
    this.touchShoot = shooting
  }

  public rotateWeapon(): void {
    if (this.fireWeapons.length <= 1) return
    this.activeWeaponIndex = (this.activeWeaponIndex + 1) % this.fireWeapons.length
    this.soundGenerator.playWeaponSwitch()
    const activeIcon = getWeaponIcon(this.fireWeapons[this.activeWeaponIndex])
    const nextIcon = getWeaponIcon(this.fireWeapons[(this.activeWeaponIndex + 1) % this.fireWeapons.length])
    this.callbacks.onWeaponRotated?.(activeIcon, nextIcon)
  }

  public getActiveWeaponIcon(): string {
    if (this.fireWeapons.length === 0) return ''
    return getWeaponIcon(this.fireWeapons[this.activeWeaponIndex])
  }

  public getNextWeaponIcon(): string {
    if (this.fireWeapons.length <= 1) return ''
    return getWeaponIcon(this.fireWeapons[(this.activeWeaponIndex + 1) % this.fireWeapons.length])
  }

  public getFireWeaponCount(): number {
    return this.fireWeapons.length
  }

  public spawnLapDigit(lapNumber: number): void {
    this.lapDigitDropEffect.spawnDigit(lapNumber)
  }

  private triggerCameraShake(duration: number, intensity: number) {
    this.shakeDuration = duration
    this.shakeTimer = duration
    this.shakeIntensity = intensity
  }

  private updateCameraShake(deltaTime: number) {
    if (this.shakeTimer <= 0 || this.cinematicActive) return
    this.shakeTimer -= deltaTime
    const t = Math.max(0, this.shakeTimer / this.shakeDuration)
    const magnitude = this.shakeIntensity * t
    this.camera.position.x = this.gameplayCameraPos.x + (Math.random() - 0.5) * 2 * magnitude
    this.camera.position.y = this.gameplayCameraPos.y + (Math.random() - 0.5) * 2 * magnitude
    this.camera.position.z = this.gameplayCameraPos.z + (Math.random() - 0.5) * 2 * magnitude
  }

  private spawnBall(drop: BallDropConfig) {
    let x: number, z: number
    if (drop.x !== undefined && drop.z !== undefined) {
      x = drop.x
      z = drop.z
    } else {
      const pos = this.findBallSpawnPoint()
      x = pos.x
      z = pos.z
    }
    const y = drop.y ?? DEFAULT_DROP_HEIGHT
    const ball = new Ball(this.scene, x, y, z, this.soundGenerator)
    this.balls.push(ball)
  }

  private findBallSpawnPoint(): THREE.Vector3 {
    let bestCandidate = this.track.getRandomPointOnTrack()
    let bestDistance = -Infinity

    for (let attempt = 0; attempt < BALL_SPAWN_MAX_ATTEMPTS; attempt++) {
      const candidate = this.track.getRandomPointOnTrack()
      const nearestDistance = this.getNearestLiveBallDistance(candidate)
      if (nearestDistance > bestDistance) {
        bestCandidate = candidate
        bestDistance = nearestDistance
      }
      if (nearestDistance >= this.getBallSpawnClearance()) {
        return candidate
      }
    }

    return bestCandidate
  }

  private getNearestLiveBallDistance(position: THREE.Vector3): number {
    let nearestDistance = Infinity

    for (const ball of this.balls) {
      if (ball.exploded) continue
      const distance = position.distanceTo(ball.position)
      nearestDistance = Math.min(nearestDistance, distance)
    }

    return nearestDistance
  }

  private getBallSpawnClearance(): number {
    return this.balls.length > 0 ? this.balls[0].getRadius() * 2 + BALL_SPAWN_MARGIN : 0
  }

  private resolveBallCollisions(): void {
    const activeBalls = this.balls.filter(ball => !ball.exploded)
    if (activeBalls.length < 2) return

    for (let pass = 0; pass < activeBalls.length; pass++) {
      let changed = false
      for (let i = 0; i < activeBalls.length; i++) {
        for (let j = i + 1; j < activeBalls.length; j++) {
          if (activeBalls[i].resolveCollisionWithBall(activeBalls[j], this.track)) {
            changed = true
          }
        }
      }
      if (!changed) break
    }
  }

  private shootBullet() {
    const playerCar = this.cars.find(car => car.isPlayer)
    if (!playerCar || playerCar.launched || playerCar.isDestroyed) return

    const forward = new THREE.Vector3(
      Math.sin(playerCar.rotation),
      0,
      Math.cos(playerCar.rotation)
    )
    const spawnPos = playerCar.position.clone().addScaledVector(forward, 1.8)
    spawnPos.y = playerCar.position.y

    const bullet = new Bullet(spawnPos, playerCar.rotation)
    this.scene.add(bullet.mesh)
    this.bullets.push(bullet)
    this.soundGenerator.playBulletShoot()
    this.shootCooldown = 0.05
  }

  private dropPlayerMine() {
    const playerCar = this.cars.find(car => car.isPlayer)
    if (!playerCar || playerCar.launched || playerCar.isDestroyed) return

    const backward = new THREE.Vector3(
      -Math.sin(playerCar.rotation),
      0,
      -Math.cos(playerCar.rotation)
    )
    const spawnPos = playerCar.position.clone().addScaledVector(backward, 2.0)
    const mine = new Mine(this.scene, spawnPos.x, spawnPos.z, 2.0)
    this.playerMines.push(mine)
    this.soundGenerator.playMineDrop()
    this.shootCooldown = 1.5
  }

  private activateTurboBoost() {
    if (this.turboBoostActive || this.turboBoostCooldown > 0) return
    const playerCar = this.cars.find(car => car.isPlayer)
    if (!playerCar || playerCar.launched || playerCar.isDestroyed) return

    this.turboBoostActive = true
    this.turboBoostTimer = this.TURBO_BOOST_DURATION
    playerCar.maxSpeed = this.playerBaseMaxSpeed * this.TURBO_BOOST_MULTIPLIER
    this.soundGenerator.playTurboBoost()
    this.shootCooldown = this.TURBO_BOOST_DURATION + this.TURBO_BOOST_COOLDOWN
  }

  public pause() {
    if (!this.isPaused) {
      this.isPaused = true
      this.pauseStartTime = performance.now() / 1000
    }
  }

  public resume() {
    if (this.isPaused) {
      // Calculate how long we were paused and add it to total pause time
      const pauseEndTime = performance.now() / 1000
      const pauseDuration = pauseEndTime - this.pauseStartTime
      this.totalPauseTime += pauseDuration

      this.isPaused = false
      // Reset frame time to prevent large deltaTime jump after resume
      this.lastFrameTime = performance.now() / 1000
    }
  }

  public isPausedState(): boolean {
    return this.isPaused
  }

  /**
   * Play the sad finish sound (when the player did not advance to the next level).
   * Called from the UI when the race result has levelPassed === false.
   */
  public playSadFinishSound(): void {
    this.soundGenerator.playSadFinishSound()
  }

  public dispose() {
    this.isDisposed = true

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

    if (this.spaceKeyDownHandler) {
      window.removeEventListener('keydown', this.spaceKeyDownHandler)
      this.spaceKeyDownHandler = null
    }
    if (this.spaceKeyUpHandler) {
      window.removeEventListener('keyup', this.spaceKeyUpHandler)
      this.spaceKeyUpHandler = null
    }

    this.bullets.forEach(b => b.dispose(this.scene))
    this.bullets = []
    this.balls.forEach(b => b.dispose())
    this.balls = []

    if (this.startLights) {
      this.startLights.dispose()
      this.startLights = null
    }

    if (this.mine) {
      this.mine.destroy()
      this.mine = null
    }
    this.playerMines.forEach(m => m.destroy())
    this.playerMines = []
    if (this.playerArrow) {
      this.playerArrow.dispose()
      this.playerArrow = null
    }
    if (this.timerBillboard) {
      this.timerBillboard.dispose()
      this.timerBillboard = null
    }
    if (this.decorationGrid) {
      this.decorationGrid.destroy()
      this.decorationGrid = null
    }
    this.lapDigitDropEffect.dispose()
    this.soundGenerator.dispose()
    this.cars.forEach(car => car.dispose())
    this.cars = []
    this.track.dispose()
    if (this.backgroundTexture) {
      this.backgroundTexture.dispose()
      this.backgroundTexture = null
    }
    this.backgroundEyes.forEach((eye) => eye.dispose())
    this.backgroundEyes = []
    this.scene.background = null

    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
    }

    if (this.renderer) {
      this.renderer.dispose()
    }
  }
}
