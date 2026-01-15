import * as THREE from 'three'
import { Car } from './Car'
import { Track } from './Track'
import { RaceManager } from './RaceManager'

export interface RacingGameCallbacks {
  onRaceComplete: (results: { winner: string; second: string; third: string }) => void
  onLapUpdate?: (laps: number) => void
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

  constructor(container: HTMLElement, callbacks: RacingGameCallbacks) {
    this.callbacks = callbacks

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
    this.renderer.setSize(width, height, false) // false = don't update style
    this.renderer.shadowMap.enabled = true
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
          this.camera.lookAt(0, 0, 0)
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

    // Create ground plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100)
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x90ee90, // Light green grass
      flatShading: true
    })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = 0
    ground.receiveShadow = true
    this.scene.add(ground)

    // Create track
    this.track = new Track(this.scene)

    // Create navigation grid for A* pathfinding
    this.track.createNavigationGrid(1.0)

    // Create race manager
    this.raceManager = new RaceManager(this.callbacks)

    // Setup lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(10, 20, 10)
    directionalLight.castShadow = true
    this.scene.add(directionalLight)

    // Create cars
    this.createCars()

    // Start render loop
    this.animate()
  }

  private updateCameraPosition(viewWidth: number, viewHeight: number) {
    const aspect = viewWidth / viewHeight
    
    // Base camera position for landscape mode (aspect >= 1)
    // Track is roughly 42 units wide (outer bounds: -21 to +21) and 32 units tall (-16 to +16)
    const baseCameraY = 30
    const baseCameraZ = 30
    
    if (aspect < 1) {
      // Portrait mode: need to zoom out to see the full track width
      // The narrower the aspect ratio, the higher the camera needs to be
      // Calculate scale factor based on how much narrower portrait is compared to landscape
      const portraitScale = 1 / aspect
      // Increase camera height proportionally, with a cap to avoid going too high
      const adjustedY = baseCameraY * Math.min(portraitScale * 0.85, 2.0)
      const adjustedZ = baseCameraZ * Math.min(portraitScale * 0.7, 1.8)
      this.camera.position.set(0, adjustedY, adjustedZ)
    } else {
      // Landscape mode: use base position
      this.camera.position.set(0, baseCameraY, baseCameraZ)
    }
  }

  private createCars() {
    // Track start/finish line is at z: -10 (width/2 = 20/2 = 10, so -10)
    // Start positions: Red and Blue in front, Player and Green behind
    
    // Each car has unique characteristics for different racing personalities
    const carConfigs = [
      { 
        x: -1.5, 
        z: -10, 
        color: 0xff0000, 
        name: 'Red Racer',
        // Aggressive speedster - fast but less precise on corners
        maxSpeed: 9,
        acceleration: 18,
        turnSpeed: 0.022,
        aiAggressiveness: 0.9,
        pathRecalculateInterval: 0.3, // Recalculates path more frequently
        waypointLookAhead: 2 // Looks fewer waypoints ahead (more reactive)
      },
      { 
        x: 1.5, 
        z: -10, 
        color: 0x0000ff, 
        name: 'Blue Cruiser',
        // Balanced all-rounder - good at everything
        maxSpeed: 8,
        acceleration: 15,
        turnSpeed: 0.025,
        aiAggressiveness: 0.8,
        pathRecalculateInterval: 0.5,
        waypointLookAhead: 3
      },
      { 
        x: -1.5, 
        z: -13, 
        color: 0x000000, 
        name: 'Player',
        // Player car characteristics
        maxSpeed: 8,
        acceleration: 15,
        turnSpeed: 0.025,
        aiAggressiveness: 0.7,
        pathRecalculateInterval: 0.5,
        waypointLookAhead: 3
      },
      { 
        x: 1.5, 
        z: -13, 
        color: 0x00ff00, 
        name: 'Green Machine',
        // Careful navigator - slower top speed but great cornering
        maxSpeed: 7,
        acceleration: 12,
        turnSpeed: 0.03,
        aiAggressiveness: 0.7,
        pathRecalculateInterval: 0.8, // Plans further ahead
        waypointLookAhead: 5 // Looks more waypoints ahead (smoother lines)
      }
    ]

    carConfigs.forEach((config, index) => {
      const isPlayer = index === 2
      const car = new Car(
        config.x, 
        0.5, 
        config.z, 
        config.color, 
        config.name, 
        isPlayer,
        {
          maxSpeed: config.maxSpeed,
          acceleration: config.acceleration,
          turnSpeed: config.turnSpeed,
          aiAggressiveness: config.aiAggressiveness,
          pathRecalculateInterval: config.pathRecalculateInterval,
          waypointLookAhead: config.waypointLookAhead
        }
      )
      this.cars.push(car)
      this.scene.add(car.mesh)
      this.raceManager.addCar(car, this.track)
      // Give AI cars initial speed so they're visible moving
      if (!car.isPlayer) {
        car.speed = 2
      }
    })
  }

  private animate = () => {
    // Stop animation if disposed
    if (this.isDisposed) {
      return
    }

    this.animationId = requestAnimationFrame(this.animate)

    const deltaTime = 0.016 // ~60fps

    // Check if race is complete
    const raceComplete = this.raceManager.isRaceComplete()

    // Update cars
    this.cars.forEach(car => {
      car.update(deltaTime, this.track, this.cars, raceComplete)
    })

    // Update race manager (only if race not complete)
    if (!raceComplete) {
      this.raceManager.update(deltaTime, this.track)
    }

    // Update lap counter for player
    const playerCar = this.cars.find(car => car.isPlayer)
    if (playerCar && this.callbacks.onLapUpdate) {
      this.callbacks.onLapUpdate(playerCar.lapsCompleted)
    }

    // Render
    this.renderer.render(this.scene, this.camera)
  }

  public startRace() {
    this.raceManager.startRace(this.track)
    this.cars.forEach(car => car.startRace())
  }

  public reset() {
    this.raceManager.reset(this.track)
    this.cars.forEach((car, index) => {
      const startPositions = [
        { x: -1.5, z: -10 },
        { x: 1.5, z: -10 },
        { x: -1.5, z: -13 },
        { x: 1.5, z: -13 }
      ]
      car.reset(startPositions[index].x, startPositions[index].z)
    })
  }

  public setTouchControls(controls: { up: boolean; down: boolean; left: boolean; right: boolean }) {
    const playerCar = this.cars.find(car => car.isPlayer)
    if (playerCar) {
      playerCar.setTouchControls(controls)
    }
  }

  public dispose() {
    this.isDisposed = true
    
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    
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
