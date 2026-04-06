import * as THREE from 'three'
import { Car } from './Car'
import { Track } from './Track'
import { RaceManager } from './RaceManager'
import { StartLights } from './StartLights'
import { Mine } from './Mine'
import { SoundGenerator } from './SoundGenerator'
import { PlayerArrow } from './PlayerArrow'
import { BackgroundEye } from './BackgroundEye'
import { AmbientBunny } from './AmbientBunny'
import { AmbientWolf } from './AmbientWolf'
import { DecorationGrid } from './DecorationGrid'
import { TimerBillboard } from './TimerBillboard'
import { LapDigitDropEffect } from './LapDigitDropEffect'
import { LevelConfig, CarConfig, BallDropConfig } from './levels'
import { DECORATION_BOUNDS, DECORATION_MODELS } from './levels/decorationConfig'
import type { TouchDriveState } from './input'
import type { PlayerUpgrades } from './upgrades'
import { DEFAULT_PLAYER_UPGRADES, getFireButtonWeapons } from './upgrades'
import { getCachedTexture, preloadRacingLevelAssets, RACING_SHARED_ASSET_PATHS } from './assets'
import { RacingCombatController } from './engineCombat'
export type { FireWeaponUiState } from './engineCombat'
import type { FireWeaponUiState } from './engineCombat'

const PLAYER_DEFAULT_TURN_MULTIPLIER = 1.2

export interface RacingGameCallbacks {
  onRaceComplete: (results: { winner: string; second: string; third: string; times: { [name: string]: number } }) => void
  onLapComplete?: (laps: number) => void
  onTimerUpdate?: (time: number) => void
  onCarFinished?: (carName: string, screenPos: { x: number; y: number }) => void
  onCameraReady?: (screenPos: { x: number; y: number }) => void
  onWeaponUiStateChange?: (state: FireWeaponUiState) => void
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
  private backgroundEyes: BackgroundEye[] = []
  private ambientBunny: AmbientBunny | null = null
  private ambientWolf: AmbientWolf | null = null
  private ambientOuterWolf: AmbientWolf | null = null
  private decorationGrid: DecorationGrid | null = null
  private timerBillboard: TimerBillboard | null = null
  private lapDigitDropEffect: LapDigitDropEffect
  private pendingBallDrops: BallDropConfig[] = []
  private touchShoot: boolean = false
  private spacePressed: boolean = false
  private spaceKeyDownHandler: ((e: KeyboardEvent) => void) | null = null
  private spaceKeyUpHandler: ((e: KeyboardEvent) => void) | null = null
  private resizeHandler: (() => void) | null = null
  private orientationChangeHandler: (() => void) | null = null
  private orientationResizeTimeoutId: number | null = null
  private levelMineArmed: boolean = false

  // Player upgrades & weapon switching
  private playerUpgrades: PlayerUpgrades
  private combat: RacingCombatController

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
      const texture = getCachedTexture(RACING_SHARED_ASSET_PATHS.skyboxTexture)
      if (texture) {
        texture.mapping = THREE.EquirectangularReflectionMapping
        texture.colorSpace = THREE.SRGBColorSpace
        this.scene.background = texture
        this.scene.backgroundRotation.set(0, Math.PI, 0)
      } else {
        console.warn('Missing preloaded racing skybox texture')
      }
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
    this.resizeHandler = () => {
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
    this.resizeHandler()

    window.addEventListener('resize', this.resizeHandler)
    this.orientationChangeHandler = () => {
      // Delay to allow orientation change to complete
      if (this.orientationResizeTimeoutId !== null) {
        window.clearTimeout(this.orientationResizeTimeoutId)
      }
      this.orientationResizeTimeoutId = window.setTimeout(() => {
        this.resizeHandler?.()
        this.orientationResizeTimeoutId = null
      }, 100)
    }
    window.addEventListener('orientationchange', this.orientationChangeHandler)

    // Create track (with level-specific ground/grass theme)
    this.track = new Track(this.scene, undefined, {
      theme: this.currentLevelConfig.groundTheme,
      coverStyle: this.currentLevelConfig.groundCoverStyle
    })
    this.combat = new RacingCombatController(this.scene, this.track, this.soundGenerator, {
      onWeaponUiStateChange: (state) => this.callbacks.onWeaponUiStateChange?.(state),
    })

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
      playerCar.applyPermanentSpeedMultiplier(this.playerUpgrades.speedMultiplier)
      playerCar.applyPermanentTurnMultiplier(PLAYER_DEFAULT_TURN_MULTIPLIER)
      playerCar.hasRam = this.playerUpgrades.hasRam
    }

    // Build fire-button weapon list for weapon switching
    this.combat.setFireWeapons(getFireButtonWeapons(this.playerUpgrades))

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

    if (this.currentLevelConfig.id === 2) {
      const ambientOrbitCenter = { x: -24, y: 0.5, z: -19 }
      this.ambientWolf = new AmbientWolf(this.scene, ambientOrbitCenter)
      this.ambientOuterWolf = new AmbientWolf(this.scene, ambientOrbitCenter, {
        radius: 4.6,
        startAngle: 0.28,
      })
      this.ambientBunny = new AmbientBunny(this.scene, ambientOrbitCenter)
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

  }

  public static preloadLevelAssets(level: LevelConfig): Promise<void> {
    return preloadRacingLevelAssets(level)
  }

  public async initialize(): Promise<void> {
    if (typeof this.renderer.compileAsync === 'function') {
      await this.renderer.compileAsync(this.scene, this.camera)
    } else {
      this.renderer.compile(this.scene, this.camera)
    }

    this.renderer.render(this.scene, this.camera)
    this.lastFrameTime = performance.now() / 1000
    this.lastRenderTime = performance.now()
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
      this.raceManager.addCar(car, this.track)
      // Don't give AI cars initial speed - they'll wait for green light
    })
  }

  private getPlayerCar(): Car | undefined {
    return this.cars.find(car => car.isPlayer)
  }

  private updateRaceTimer(raceComplete: boolean): void {
    if (!this.timerActive || raceComplete) {
      return
    }

    const currentTime = performance.now() / 1000
    const elapsedTime = currentTime - this.raceStartTime - this.totalPauseTime
    this.callbacks.onTimerUpdate?.(elapsedTime)
    this.timerBillboard?.update(elapsedTime)
  }

  private getCanStart(): boolean {
    return this.startLights ? this.startLights.isGreen() : false
  }

  private syncRaceStart(canStart: boolean): void {
    if (!canStart || this.timerActive) {
      return
    }

    this.timerActive = true
    this.raceStartTime = performance.now() / 1000

    if (this.mine && !this.levelMineArmed) {
      this.mine.startActivationCountdown()
      this.levelMineArmed = true
    }
  }

  private updatePlayerArrow(deltaTime: number, canStart: boolean): void {
    if (!this.playerArrow) {
      return
    }

    if (canStart) {
      this.playerArrow.hide()
      return
    }

    const playerCar = this.getPlayerCar()
    if (playerCar) {
      this.playerArrow.update(deltaTime, playerCar.position)
    }
  }

  private updateCars(deltaTime: number, raceComplete: boolean, canStart: boolean): void {
    this.cars.forEach(car => {
      car.update(deltaTime, this.track, this.cars, raceComplete, canStart)
    })
  }

  private updateLevelMine(raceComplete: boolean, canStart: boolean): void {
    if (!this.mine || raceComplete || !canStart || !this.mine.isActive()) {
      return
    }

    for (const car of this.cars) {
      if (car.launched || car.finished) continue
      if (this.mine.collidesWith(car.position)) {
        this.handleExplosionHit(car, this.mine.getPosition())
        this.mine.destroy()
        this.mine = null
        break
      }
    }
  }

  private updatePendingBallDrops(raceComplete: boolean): void {
    if (!this.timerActive || raceComplete) {
      return
    }

    const elapsed = performance.now() / 1000 - this.raceStartTime - this.totalPauseTime
    for (let i = this.pendingBallDrops.length - 1; i >= 0; i--) {
      const drop = this.pendingBallDrops[i]
      if (elapsed >= drop.dropTime) {
        this.combat.spawnBall(drop)
        this.pendingBallDrops.splice(i, 1)
      }
    }
  }

  private updatePlayerFailureState(raceComplete: boolean): void {
    if (!raceComplete && this.playerMineHitTime === null) {
      const playerCar = this.getPlayerCar()
      if (playerCar?.isDestroyed) {
        this.playerMineHitTime = performance.now() / 1000
      }
    }

    if (this.playerMineHitTime === null || raceComplete) {
      return
    }

    const elapsed = performance.now() / 1000 - this.playerMineHitTime
    if (elapsed >= 3) {
      this.playerMineHitTime = null
      this.raceManager.forceComplete()
    }
  }

  private updateRaceManager(deltaTime: number, raceComplete: boolean): void {
    if (raceComplete) {
      return
    }

    const currentTime = performance.now() / 1000
    const elapsedRaceTime = this.timerActive ? (currentTime - this.raceStartTime - this.totalPauseTime) : 0
    this.raceManager.update(deltaTime, this.track, elapsedRaceTime)
  }

  private updateCombat(deltaTime: number, canStart: boolean, raceComplete: boolean): void {
    this.combat.update(deltaTime, {
      canStart,
      raceComplete,
      firePressed: this.spacePressed || this.touchShoot,
      cars: this.cars,
      playerCar: this.getPlayerCar(),
      onExplosionHit: (car, origin) => this.handleExplosionHit(car, origin),
      onCameraShake: (duration, intensity) => this.triggerCameraShake(duration, intensity),
      onPlayerBallExplosion: () => {
        if (this.playerMineHitTime === null) {
          this.playerMineHitTime = performance.now() / 1000
        }
      },
    })
  }

  private updateSceneEffects(deltaTime: number): void {
    this.updateCinematicCamera(deltaTime)
    this.backgroundEyes.forEach((eye) => eye.update(deltaTime))
    this.ambientBunny?.update(deltaTime)
    this.ambientOuterWolf?.update(deltaTime)
    this.ambientWolf?.update(deltaTime)
    this.lapDigitDropEffect.update(deltaTime)
    this.updateCameraShake(deltaTime)
  }

  private handleExplosionHit(car: Car, explosionOrigin: THREE.Vector3): void {
    car.applyExplosionForce(explosionOrigin)
    this.soundGenerator.playExplosionSound()
    if (car.isPlayer) {
      this.playerMineHitTime = performance.now() / 1000
    }
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

    this.updateRaceTimer(raceComplete)

    const canStart = this.getCanStart()
    this.syncRaceStart(canStart)
    this.updatePlayerArrow(deltaTime, canStart)
    this.updateCars(deltaTime, raceComplete, canStart)
    this.updateLevelMine(raceComplete, canStart)
    this.updatePendingBallDrops(raceComplete)
    this.updateCombat(deltaTime, canStart, raceComplete)
    this.updatePlayerFailureState(raceComplete)
    this.updateRaceManager(deltaTime, raceComplete)
    this.updateSceneEffects(deltaTime)

    // Render
    this.renderer.render(this.scene, this.camera)

    // Restore camera position after render so shake doesn't accumulate
    if (this.shakeTimer > 0 && !this.cinematicActive) {
      this.camera.position.copy(this.gameplayCameraPos)
    }
  }

  public startRace() {
    this.resetRaceState()
    this.initCinematicCamera()
    this.startLights?.reset()
    this.playerArrow?.show()
    this.raceManager.startRace(this.track)
    this.cars.forEach(car => car.startRace())
    this.combat.emitUiState(true)
  }

  private resetRaceState(): void {
    this.combat.reset(this.getPlayerCar())
    this.resetRaceTimingState()
    this.pendingBallDrops = [...(this.currentLevelConfig.ballDrops ?? [])]
    this.levelMineArmed = false
    this.lapDigitDropEffect.clear()
  }

  private resetRaceTimingState(): void {
    this.timerActive = false
    this.raceStartTime = 0
    this.totalPauseTime = 0
    this.pauseStartTime = 0
    this.playerMineHitTime = null
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
    this.combat.rotateWeapon()
  }

  public getActiveWeaponIcon(): string {
    return this.combat.getActiveWeaponIcon()
  }

  public getNextWeaponIcon(): string {
    return this.combat.getNextWeaponIcon()
  }

  public getFireWeaponCount(): number {
    return this.combat.getFireWeaponCount()
  }

  public getFireWeaponUiState(): FireWeaponUiState {
    return this.combat.getFireWeaponUiState()
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
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler)
      this.resizeHandler = null
    }
    if (this.orientationChangeHandler) {
      window.removeEventListener('orientationchange', this.orientationChangeHandler)
      this.orientationChangeHandler = null
    }
    if (this.orientationResizeTimeoutId !== null) {
      window.clearTimeout(this.orientationResizeTimeoutId)
      this.orientationResizeTimeoutId = null
    }

    this.combat.dispose()

    if (this.startLights) {
      this.startLights.dispose()
      this.startLights = null
    }

    if (this.mine) {
      this.mine.destroy()
      this.mine = null
    }
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
    this.backgroundEyes.forEach((eye) => eye.dispose())
    this.backgroundEyes = []
    this.ambientBunny?.dispose()
    this.ambientBunny = null
    this.ambientOuterWolf?.dispose()
    this.ambientOuterWolf = null
    this.ambientWolf?.dispose()
    this.ambientWolf = null
    this.scene.background = null

    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
    }

    if (this.renderer) {
      this.renderer.dispose()
    }
  }
}
