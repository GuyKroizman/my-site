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
    // Position camera above and slightly behind to see the track
    this.camera.position.set(0, 30, 30)
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

  private createCars() {
    // Track start/finish line is at z: -10 (width/2 = 20/2 = 10, so -10)
    // Start positions: Red and Blue in front, Player and Green behind
    
    // All cars have equal speed and turning (fair characteristics)
    const baseCharacteristics = {
      maxSpeed: 8,
      acceleration: 15,
      turnSpeed: 0.025
    }
    
    const carConfigs = [
      { 
        x: -1.5, 
        z: -10, 
        color: 0xff0000, 
        name: 'Red Car',
        // Fair AI characteristics: aggressive but shorter lookahead
        aiAggressiveness: 0.85,
        aiLookAhead: 0.08
      },
      { 
        x: 1.5, 
        z: -10, 
        color: 0x0000ff, 
        name: 'Blue Car',
        // Fair AI characteristics: balanced approach
        aiAggressiveness: 0.75,
        aiLookAhead: 0.1
      },
      { 
        x: -1.5, 
        z: -13, 
        color: 0x000000, 
        name: 'Player',
        // Player car - AI characteristics don't matter (player controlled)
        aiAggressiveness: 0.7,
        aiLookAhead: 0.1
      },
      { 
        x: 1.5, 
        z: -13, 
        color: 0x00ff00, 
        name: 'Green Car',
        // Fair AI characteristics: more careful, longer lookahead
        aiAggressiveness: 0.65,
        aiLookAhead: 0.15
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
          ...baseCharacteristics,
          aiAggressiveness: config.aiAggressiveness,
          aiLookAhead: config.aiLookAhead
        }
      )
      this.cars.push(car)
      this.scene.add(car.mesh)
      this.raceManager.addCar(car)
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
    this.raceManager.startRace()
    this.cars.forEach(car => car.startRace())
  }

  public reset() {
    this.raceManager.reset()
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
