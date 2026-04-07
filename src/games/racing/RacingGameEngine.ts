import * as THREE from 'three'
import { Car } from './Car'
import { Track } from './Track'
import { RaceManager } from './RaceManager'
import { Mine } from './Mine'
import { SoundGenerator } from './SoundGenerator'
import { LevelConfig, BallDropConfig } from './levels'
import type { TouchDriveState } from './input'
import type { PlayerUpgrades } from './upgrades'
import { DEFAULT_PLAYER_UPGRADES, getFireButtonWeapons } from './upgrades'
import { getCachedTexture, preloadRacingLevelAssets, RACING_SHARED_ASSET_PATHS } from './assets'
import { RacingCombatController } from './engineCombat'
import { RacingEngineInputController } from './engineInput'
import { RacingSessionController } from './engineSession'
import { RacingPresentationController } from './enginePresentation'
import {
  applyPlayerRaceUpgrades,
  clonePendingBallDrops,
  createLevelMine,
  createRaceCars,
} from './engineSetup'
export type { FireWeaponUiState } from './engineCombat'
import type { FireWeaponUiState } from './engineCombat'

export interface RawRaceResults {
  winner: string
  second: string
  third: string
  times: { [name: string]: number }
}

export interface RacingGameCallbacks {
  onRaceComplete: (results: RawRaceResults & {
    destroyedCarNames: string[]
    eliminatedCars: Array<{ name: string; color: number }>
    playerFinishTime: number | null
    gluedCarNames: string[]
  }) => void
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
  private animationId: number | null = null
  private callbacks: RacingGameCallbacks
  private isDisposed: boolean = false
  private lastFrameTime: number = 0
  private frameInterval: number = 1000 / 60 // 16.67ms for 60 FPS
  private lastRenderTime: number = 0
  private currentLevelConfig: LevelConfig
  private isPaused: boolean = false
  private mine: Mine | null = null
  private soundGenerator: SoundGenerator = new SoundGenerator()
  private pendingBallDrops: BallDropConfig[] = []
  private touchShoot: boolean = false
  private spacePressed: boolean = false
  private resizeHandler: (() => void) | null = null
  private orientationChangeHandler: (() => void) | null = null
  private orientationResizeTimeoutId: number | null = null

  // Player upgrades & weapon switching
  private playerUpgrades: PlayerUpgrades
  private combat: RacingCombatController
  private input: RacingEngineInputController
  private session: RacingSessionController = new RacingSessionController()
  private presentation: RacingPresentationController

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
    this.presentation = new RacingPresentationController(this.scene, this.camera, {
      onCameraReady: (screenPos) => this.callbacks.onCameraReady?.(screenPos),
    }, this.currentLevelConfig)
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
    this.input = new RacingEngineInputController({
      onFirePressedChange: (pressed) => {
        this.spacePressed = pressed
      },
      onRotateWeapon: () => this.rotateWeapon(),
    })

    // Create navigation grid for A* pathfinding
    this.track.createNavigationGrid(1.0)

    // Create race manager with level-specific required laps
    this.raceManager = new RaceManager({
      onRaceComplete: (results) => this.callbacks.onRaceComplete({
        ...results,
        ...this.buildRaceTelemetry(results.times),
      }),
      onLapComplete: (laps) => this.callbacks.onLapComplete?.(laps),
      onCarFinished: (carName, screenPos) => this.callbacks.onCarFinished?.(carName, screenPos),
    }, this.currentLevelConfig.requiredLaps)
    this.raceManager.setFinishScreenPosGetter(() => this.presentation.projectFinishLine())

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

    this.cars = createRaceCars(this.scene, this.currentLevelConfig, (car) => {
      this.raceManager.addCar(car, this.track)
    })
    applyPlayerRaceUpgrades(this.cars, this.playerUpgrades)

    // Build fire-button weapon list for weapon switching
    this.combat.setFireWeapons(getFireButtonWeapons(this.playerUpgrades))

    this.mine = createLevelMine(this.scene, this.currentLevelConfig, () => this.track.getRandomPointOnTrack())

    // Initialize pending ball drops from level config
    this.pendingBallDrops = clonePendingBallDrops(this.currentLevelConfig)
    this.input.attach()
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

  private updateCameraPosition(viewWidth: number, viewHeight: number) {
    this.presentation.updateCameraPosition(viewWidth, viewHeight)
  }

  private getPlayerCar(): Car | undefined {
    return this.cars.find(car => car.isPlayer)
  }

  private updateRaceTimer(raceComplete: boolean): void {
    if (!this.session.isTimerActive() || raceComplete) {
      return
    }

    const elapsedTime = this.session.getElapsedRaceTime()
    this.callbacks.onTimerUpdate?.(elapsedTime)
    this.presentation.updateRaceTimer(elapsedTime)
  }

  private getCanStart(): boolean {
    return this.presentation.isStartGreen()
  }

  private syncRaceStart(canStart: boolean): void {
    if (!this.session.beginRaceIfNeeded(canStart)) {
      return
    }

    if (this.mine && !this.session.isLevelMineArmed()) {
      this.mine.startActivationCountdown()
      this.session.markLevelMineArmed()
    }
  }

  private updatePlayerArrow(deltaTime: number, canStart: boolean): void {
    this.presentation.updatePlayerArrow(deltaTime, canStart, this.getPlayerCar()?.position)
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
    if (!this.session.isTimerActive() || raceComplete) {
      return
    }

    const elapsed = this.session.getElapsedRaceTime()
    for (let i = this.pendingBallDrops.length - 1; i >= 0; i--) {
      const drop = this.pendingBallDrops[i]
      if (elapsed >= drop.dropTime) {
        this.combat.spawnBall(drop)
        this.pendingBallDrops.splice(i, 1)
      }
    }
  }

  private updatePlayerFailureState(raceComplete: boolean): void {
    if (!raceComplete && this.session.getPlayerFailureElapsed() === null) {
      const playerCar = this.getPlayerCar()
      if (playerCar?.isDestroyed) {
        this.session.recordPlayerFailure()
      }
    }

    const failureElapsed = this.session.getPlayerFailureElapsed()
    if (failureElapsed === null || raceComplete) {
      return
    }

    if (failureElapsed >= 3) {
      this.session.clearPlayerFailure()
      this.raceManager.forceComplete()
    }
  }

  private updateRaceManager(deltaTime: number, raceComplete: boolean): void {
    if (raceComplete) {
      return
    }

    const elapsedRaceTime = this.session.getElapsedRaceTime()
    this.raceManager.update(deltaTime, this.track, elapsedRaceTime)
  }

  private buildRaceTelemetry(times: { [name: string]: number }): {
    destroyedCarNames: string[]
    eliminatedCars: Array<{ name: string; color: number }>
    playerFinishTime: number | null
    gluedCarNames: string[]
  } {
    const eliminatedCars = this.cars
      .filter(car => !car.isPlayer && (car.isDestroyed || car.launched))
      .map(car => ({ name: car.name, color: car.color }))

    return {
      destroyedCarNames: eliminatedCars.map(car => car.name),
      eliminatedCars,
      playerFinishTime: times.Player ?? null,
      gluedCarNames: this.combat.getGluedCarNames(),
    }
  }

  private updateCombat(deltaTime: number, canStart: boolean, raceComplete: boolean): void {
    this.combat.update(deltaTime, {
      canStart,
      raceComplete,
      firePressed: this.spacePressed || this.touchShoot,
      cars: this.cars,
      playerCar: this.getPlayerCar(),
      onExplosionHit: (car, origin) => this.handleExplosionHit(car, origin),
      onCameraShake: (duration, intensity) => this.presentation.triggerCameraShake(duration, intensity),
      onPlayerBallExplosion: () => this.session.recordPlayerFailure(),
    })
  }

  private updateSceneEffects(deltaTime: number): void {
    this.presentation.updateSceneEffects(deltaTime)
  }

  private handleExplosionHit(car: Car, explosionOrigin: THREE.Vector3): void {
    car.applyExplosionForce(explosionOrigin)
    this.soundGenerator.playExplosionSound()
    if (car.isPlayer) {
      this.session.recordPlayerFailure()
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

    this.presentation.updateStartLights(deltaTime)

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
    this.presentation.restoreCameraAfterRender()
  }

  public startRace() {
    this.resetRaceState()
    this.presentation.startRace(this.currentLevelConfig.cars)
    this.raceManager.startRace(this.track)
    this.cars.forEach(car => car.startRace())
    this.combat.emitUiState(true)
  }

  private resetRaceState(): void {
    this.combat.reset(this.getPlayerCar())
    this.session.reset()
    this.pendingBallDrops = clonePendingBallDrops(this.currentLevelConfig)
    this.presentation.clearLapDigits()
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
    this.presentation.spawnLapDigit(lapNumber)
  }

  public pause() {
    if (!this.isPaused) {
      this.isPaused = true
      this.session.pause()
    }
  }

  public resume() {
    if (this.isPaused) {
      this.session.resume()
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

    this.input.dispose()
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

    if (this.mine) {
      this.mine.destroy()
      this.mine = null
    }
    this.presentation.dispose()
    this.soundGenerator.dispose()
    this.cars.forEach(car => car.dispose())
    this.cars = []
    this.track.dispose()
    this.scene.background = null

    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
    }

    if (this.renderer) {
      this.renderer.dispose()
    }
  }
}
