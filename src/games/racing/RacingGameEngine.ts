import * as THREE from 'three'
import { Car } from './Car'
import { Track } from './Track'
import { RaceManager } from './RaceManager'
import { StartLights } from './StartLights'
import { Mine } from './Mine'
import { SoundGenerator } from './SoundGenerator'
import { PlayerArrow } from './PlayerArrow'
import { LevelConfig, CarConfig } from './levels'

export interface RacingGameCallbacks {
  onRaceComplete: (results: { winner: string; second: string; third: string; times: { [name: string]: number } }) => void
  onLapUpdate?: (laps: number) => void
  onTimerUpdate?: (time: number) => void
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

  // Cinematic camera intro
  private cinematicActive: boolean = false
  private cinematicTimer: number = 0
  private gameplayCameraPos: THREE.Vector3 = new THREE.Vector3()
  private cinematicStartPos: THREE.Vector3 = new THREE.Vector3()
  private cinematicStartLookAt: THREE.Vector3 = new THREE.Vector3()
  private readonly CINEMATIC_HOLD_DURATION: number = 0.5
  private readonly CINEMATIC_SWEEP_DURATION: number = 2.0

  constructor(container: HTMLElement, callbacks: RacingGameCallbacks, levelConfig: LevelConfig) {
    this.callbacks = callbacks
    this.currentLevelConfig = levelConfig

    // Ensure container is properly sized
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      console.warn('Container has zero dimensions, using window size')
    }

    // Scene setup
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x87ceeb) // Sky blue

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
    container.appendChild(this.renderer.domElement)

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

    // Create track
    this.track = new Track(this.scene)

    // Create navigation grid for A* pathfinding
    this.track.createNavigationGrid(1.0)

    // Create race manager with level-specific required laps
    this.raceManager = new RaceManager(this.callbacks, this.currentLevelConfig.requiredLaps)

    // Create start lights
    this.startLights = new StartLights(this.scene, () => {
      // Start lights sequence complete - race can begin
      this.timerActive = true
      this.raceStartTime = performance.now() / 1000 // Convert to seconds
    })

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

    // Initialize cinematic camera intro
    this.initCinematicCamera()

    // Create player indicator arrow (visible during countdown)
    this.playerArrow = new PlayerArrow(this.scene)

    // Spawn mine on levels 2 and above (one per level, random position on track)
    if (this.currentLevelConfig.id >= 2) {
      const minePos = this.track.getRandomPointOnTrack()
      this.mine = new Mine(this.scene, minePos.x, minePos.z)
    }

    // Initialize frame time tracking
    this.lastFrameTime = performance.now() / 1000
    this.lastRenderTime = performance.now()

    // Start render loop
    this.animate()
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
    }
  }

  private createCars() {
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
    }

    // Update cars - pass start lights state
    const canStart = this.startLights ? this.startLights.isGreen() : false

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
    if (this.mine && !raceComplete) {
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

    // End race 3 seconds after player hit a mine
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

    // Update lap counter for player
    const playerCar = this.cars.find(car => car.isPlayer)
    if (playerCar && this.callbacks.onLapUpdate) {
      this.callbacks.onLapUpdate(playerCar.lapsCompleted)
    }

    this.updateCinematicCamera(deltaTime)

    // Render
    this.renderer.render(this.scene, this.camera)
  }

  public startRace() {
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

  public setTouchControls(controls: { up: boolean; down: boolean; left: boolean; right: boolean }) {
    const playerCar = this.cars.find(car => car.isPlayer)
    if (playerCar) {
      playerCar.setTouchControls(controls)
    }
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

  public dispose() {
    this.isDisposed = true

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

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
    this.soundGenerator.dispose()
    this.cars.forEach(car => car.dispose())
    this.cars = []
    this.track.dispose()

    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
    }

    if (this.renderer) {
      this.renderer.dispose()
    }
  }
}
