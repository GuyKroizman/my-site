import * as THREE from 'three'
import { Track } from './Track'
import { SoundGenerator } from './SoundGenerator'

export interface CarCharacteristics {
  maxSpeed: number
  acceleration: number
  turnSpeed: number
  aiAggressiveness: number // 0-1, affects how aggressively AI drives
  pathRecalculateInterval: number // How often to recalculate A* path (seconds)
  waypointLookAhead: number // How many waypoints ahead to look for steering
}

export class Car {
  public mesh: THREE.Group
  public position: THREE.Vector3
  public rotation: number = 0 // Rotation in radians
  public speed: number = 0
  public maxSpeed: number = 8
  public acceleration: number = 15
  public turnSpeed: number = 0.05
  public isPlayer: boolean
  public name: string
  public color: number
  public lapProgress: number = 0 // Progress along the track (0-1) - kept for backward compatibility
  public lapsCompleted: number = 0 // Number of laps completed
  public finished: boolean = false
  public finishPosition: number = 0
  public startX: number // Store starting X position to return to finish line
  public lastCheckpoint: number = -1 // Last checkpoint passed (-1 means none)
  public checkpointPassed: boolean[] = [] // Track which checkpoints passed this lap (dynamically sized)

  // AI characteristics
  private aiAggressiveness: number = 0.7
  private pathRecalculateInterval: number = 0.5
  private waypointLookAhead: number = 3

  // A* navigation state
  private astarPath: THREE.Vector3[] = []
  private astarPathIndex: number = 0
  private astarRecalculateTimer: number = 0

  private boundingBox: THREE.Box3
  private keys: { [key: string]: boolean } = {}
  private touchControls: { up: boolean; down: boolean; left: boolean; right: boolean } = {
    up: false,
    down: false,
    left: false,
    right: false
  }
  private soundGenerator: SoundGenerator
  private lastCollisionTime: number = 0
  private collisionCooldown: number = 0.2 // Minimum time between collision sounds (seconds)

  constructor(
    x: number, 
    y: number, 
    z: number, 
    color: number, 
    name: string, 
    isPlayer: boolean,
    characteristics?: CarCharacteristics,
    modelPath?: string
  ) {
    this.position = new THREE.Vector3(x, y, z)
    this.startX = x // Store starting X position
    this.color = color
    this.name = name
    this.isPlayer = isPlayer
    this.soundGenerator = new SoundGenerator()

    // Apply characteristics if provided
    if (characteristics) {
      this.maxSpeed = characteristics.maxSpeed
      this.acceleration = characteristics.acceleration
      this.turnSpeed = characteristics.turnSpeed
      this.aiAggressiveness = characteristics.aiAggressiveness
      this.pathRecalculateInterval = characteristics.pathRecalculateInterval
      this.waypointLookAhead = characteristics.waypointLookAhead
    }

    // Create car mesh with polygon style
    this.mesh = new THREE.Group()

    // Car body (main box)
    const bodyGeometry = new THREE.BoxGeometry(1.2, 0.6, 2)
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: color })
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.castShadow = true
    body.receiveShadow = true
    this.mesh.add(body)

    // Car roof (smaller box on top)
    const roofGeometry = new THREE.BoxGeometry(0.8, 0.4, 1.2)
    const roofMaterial = new THREE.MeshStandardMaterial({ color: color * 0.8 })
    const roof = new THREE.Mesh(roofGeometry, roofMaterial)
    roof.position.y = 0.5
    roof.castShadow = true
    this.mesh.add(roof)

    // Wheels (simple boxes)
    const wheelGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3)
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 })
    
    const wheelPositions = [
      { x: -0.5, y: -0.3, z: 0.7 },
      { x: 0.5, y: -0.3, z: 0.7 },
      { x: -0.5, y: -0.3, z: -0.7 },
      { x: 0.5, y: -0.3, z: -0.7 }
    ]

    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel.position.set(pos.x, pos.y, pos.z)
      wheel.castShadow = true
      this.mesh.add(wheel)
    })

    // Cars start facing east (positive x direction) since track goes from -15 to 15 at z: -10
    // In Three.js, rotation.y = Math.PI/2 faces +x direction
    this.rotation = Math.PI / 2
    
    this.mesh.position.copy(this.position)
    this.mesh.rotation.y = this.rotation

    // Setup bounding box
    this.boundingBox = new THREE.Box3().setFromObject(this.mesh)

    if (modelPath) {
      void this.loadCustomModel(modelPath)
    }

    // Setup keyboard controls for player
    if (isPlayer) {
      this.setupControls()
    }
  }

  private setupControls() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key] = true
    })

    window.addEventListener('keyup', (e) => {
      this.keys[e.key] = false
    })
  }

  private async loadCustomModel(modelPath: string): Promise<void> {
    const isGlb = modelPath.toLowerCase().endsWith('.glb') || modelPath.toLowerCase().endsWith('.gltf')
    try {
      if (isGlb) {
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
        const loader = new GLTFLoader()
        loader.load(
          modelPath,
          (gltf) => {
            const model = this.orientAndScaleLoadedModel(gltf.scene as THREE.Group)
            this.replaceCarVisual(model)
            this.boundingBox.setFromObject(this.mesh)
          },
          undefined,
          (error) => {
            console.warn(`Failed to load car model "${modelPath}"`, error)
          }
        )
      } else {
        const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js')
        const loader = new FBXLoader()
        loader.load(
          modelPath,
          (fbx) => {
            const model = this.orientAndScaleLoadedModel(fbx)
            this.replaceCarVisual(model)
            this.boundingBox.setFromObject(this.mesh)
          },
          undefined,
          (error) => {
            console.warn(`Failed to load car model "${modelPath}"`, error)
          }
        )
      }
    } catch (error) {
      console.warn(`Failed to initialize loader for "${modelPath}"`, error)
    }
  }

  private orientAndScaleLoadedModel(model: THREE.Group): THREE.Group {
    const initialBounds = new THREE.Box3().setFromObject(model)
    const initialSize = new THREE.Vector3()
    initialBounds.getSize(initialSize)

    // If the longest axis is X, rotate so the car's length points forward on Z.
    if (initialSize.x > initialSize.z) {
      model.rotation.y = Math.PI / 2
    }

    const orientedBounds = new THREE.Box3().setFromObject(model)
    const orientedSize = new THREE.Vector3()
    orientedBounds.getSize(orientedSize)

    // Car model size (larger = more visible on track).
    const targetLength = 3.0
    const scale = targetLength / Math.max(orientedSize.z, 0.001)
    model.scale.setScalar(scale)

    const finalBounds = new THREE.Box3().setFromObject(model)
    const finalCenter = new THREE.Vector3()
    finalBounds.getCenter(finalCenter)
    const targetBottomY = -0.3
    model.position.set(-finalCenter.x, targetBottomY - finalBounds.min.y, -finalCenter.z)

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    return model
  }

  private replaceCarVisual(model: THREE.Object3D) {
    const oldChildren = [...this.mesh.children]
    oldChildren.forEach((child) => {
      this.mesh.remove(child)
      this.disposeVisualObject(child)
    })
    this.mesh.add(model)
  }

  private disposeVisualObject(object: THREE.Object3D) {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
  }

  public update(deltaTime: number, track: Track, allCars: Car[], raceComplete: boolean = false, canStart: boolean = false) {
    // If race is complete or car is finished, stop all movement
    if (this.finished || raceComplete) {
      this.speed = 0
      // Just update visual position to keep car visible
      this.mesh.position.copy(this.position)
      this.mesh.rotation.y = this.rotation
      return
    }

    // Don't allow movement until green light
    if (!canStart) {
      this.speed = 0
      // Just update visual position to keep car visible
      this.mesh.position.copy(this.position)
      this.mesh.rotation.y = this.rotation
      return
    }

    if (this.isPlayer) {
      this.updatePlayer(deltaTime)
    } else {
      this.updateAI(deltaTime, track)
    }

    // Apply movement (speed can be negative for reverse, but not for AI)
    // For AI cars, ensure speed is never negative to prevent backward movement
    const effectiveSpeed = this.isPlayer ? this.speed : Math.max(0, this.speed)
    const moveDistance = effectiveSpeed * deltaTime
    const direction = new THREE.Vector3(
      Math.sin(this.rotation),
      0,
      Math.cos(this.rotation)
    )

    // Check if car is in inner area (off-track) - slow down significantly
    const isOffTrack = track.isInsideInnerArea(this.position)
    if (isOffTrack) {
      // Continuously reduce speed when off-track (grass) - apply friction
      this.speed *= 0.85 // Continuous friction on grass
      // Also limit max speed when off-track
      const maxSpeedOnGrass = this.maxSpeed * 0.3
      if (this.speed > maxSpeedOnGrass) {
        this.speed = maxSpeedOnGrass
      }
      // Ensure AI cars never go backwards
      if (!this.isPlayer) {
        this.speed = Math.max(0, this.speed)
      }
    }

    const newPosition = this.position.clone().add(direction.multiplyScalar(moveDistance))

    // Check if position is outside outer border - block movement
    if (track.isOutsideOuterBorder(newPosition)) {
      // Block movement - don't allow car to go outside
      this.speed *= 0.3 // Slow down significantly when hitting outer wall
      // Push car back inside
      const pushBack = direction.clone().multiplyScalar(-0.2)
      this.position.add(pushBack)
      return // Don't move forward
    }

    // Check collision with other cars and handle repulsion
    const collisionResult = this.checkCollisionWithRepulsion(newPosition, allCars)
    if (collisionResult.collided) {
      // Play crash sound if enough time has passed since last collision
      const currentTime = performance.now() / 1000
      if (currentTime - this.lastCollisionTime >= this.collisionCooldown) {
        // AI-AI collisions use constant low volume (0.3), player collisions use randomized volume
        const volume = collisionResult.isAiCollision ? 0.3 : undefined
        this.soundGenerator.playCrashSound(volume)
        this.lastCollisionTime = currentTime
      }
      
      // Apply repulsion to push cars apart
      this.position.add(collisionResult.repulsion)
      
      // Still allow some movement in the original direction, but reduced
      const reducedMovement = direction.clone().multiplyScalar(moveDistance * 0.3)
      this.position.add(reducedMovement)
      
      // Reduce speed when colliding, but don't stop completely
      this.speed *= 0.8
      
      // Add slight random rotation to help cars slide past each other
      const rotationAmount = 0.015
      if (Math.random() > 0.5) {
        this.rotation += rotationAmount
      } else {
        this.rotation -= rotationAmount
      }
    } else {
      this.position.copy(newPosition)
    }

    // Update mesh position and rotation
    this.mesh.position.copy(this.position)
    this.mesh.rotation.y = this.rotation

    // Update bounding box
    this.boundingBox.setFromObject(this.mesh)

    // Update lap progress
    this.updateLapProgress(track)
    this.updateCheckpoints(track)
  }

  public setTouchControls(controls: { up: boolean; down: boolean; left: boolean; right: boolean }) {
    this.touchControls = controls
  }

  private updatePlayer(deltaTime: number) {
    // Don't respond to input if finished
    if (this.finished) {
      this.speed = 0
      return
    }

    // Forward movement - check both keyboard and touch
    const isAccelerating = this.keys['ArrowUp'] || this.keys['w'] || this.keys['W'] || this.touchControls.up
    const isBraking = this.keys['ArrowDown'] || this.keys['s'] || this.keys['S'] || this.touchControls.down

    if (isAccelerating) {
      this.speed = Math.min(this.speed + this.acceleration * deltaTime, this.maxSpeed)
    } else if (isBraking) {
      // Reverse movement
      this.speed = Math.max(this.speed - this.acceleration * deltaTime, -this.maxSpeed * 0.5)
    } else {
      // Decelerate
      if (this.speed > 0) {
        this.speed = Math.max(this.speed - this.acceleration * deltaTime * 2, 0)
      } else if (this.speed < 0) {
        this.speed = Math.min(this.speed + this.acceleration * deltaTime * 2, 0)
      }
    }

    // Turning - direction depends on whether car is moving forward or reverse
    // When in reverse, steering is reversed (left turns right, right turns left)
    // Reduced sensitivity by using a lower multiplier
    // Check both keyboard and touch controls
    const currentSpeed = Math.abs(this.speed)
    const isReversing = this.speed < 0
    if (currentSpeed > 0) {
      const turnMultiplier = 0.7 // Reduce overall turn sensitivity
      const isTurningLeft = this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A'] || this.touchControls.left
      const isTurningRight = this.keys['ArrowRight'] || this.keys['d'] || this.keys['D'] || this.touchControls.right
      
      // When reversing, swap left and right steering
      if (isReversing) {
        if (isTurningLeft) {
          // In reverse, left input turns right (clockwise)
          this.rotation -= this.turnSpeed * (currentSpeed / this.maxSpeed) * turnMultiplier
        }
        if (isTurningRight) {
          // In reverse, right input turns left (counter-clockwise)
          this.rotation += this.turnSpeed * (currentSpeed / this.maxSpeed) * turnMultiplier
        }
      } else {
        if (isTurningLeft) {
          // Turn left (counter-clockwise when viewed from above)
          this.rotation += this.turnSpeed * (currentSpeed / this.maxSpeed) * turnMultiplier
        }
        if (isTurningRight) {
          // Turn right (clockwise when viewed from above)
          this.rotation -= this.turnSpeed * (currentSpeed / this.maxSpeed) * turnMultiplier
        }
      }
    }
  }

  private updateAI(deltaTime: number, track: Track) {
    // A* pathfinding-based AI navigation
    
    // Update recalculation timer
    this.astarRecalculateTimer += deltaTime
    
    // Recalculate path periodically or if we've reached the end
    const needsRecalculation = 
      this.astarRecalculateTimer >= this.pathRecalculateInterval ||
      this.astarPath.length === 0 ||
      this.astarPathIndex >= this.astarPath.length - 1
    
    if (needsRecalculation) {
      this.astarRecalculateTimer = 0
      this.recalculateAStarPath(track)
    }
    
    // If we still don't have a path, just accelerate forward
    if (this.astarPath.length === 0) {
      this.speed = Math.min(this.speed + this.acceleration * deltaTime * 0.5, this.maxSpeed * 0.5)
      return
    }
    
    // Advance path index if we're close to current waypoint
    while (this.astarPathIndex < this.astarPath.length - 1) {
      const currentWaypoint = this.astarPath[this.astarPathIndex]
      const distToWaypoint = this.position.distanceTo(currentWaypoint)
      
      if (distToWaypoint < 2.0) {
        // Move to next waypoint
        this.astarPathIndex++
      } else {
        break
      }
    }
    
    // Get target point - look ahead based on car's waypointLookAhead characteristic
    const targetIndex = Math.min(this.astarPathIndex + this.waypointLookAhead, this.astarPath.length - 1)
    const targetPoint = this.astarPath[targetIndex]
    
    this.steerTowardsTarget(deltaTime, targetPoint)
  }

  private recalculateAStarPath(track: Track) {
    // Get next checkpoint as the goal
    const checkpointCount = track.getCheckpointCount()
    const nextCheckpointId = (this.lastCheckpoint + 1) % checkpointCount
    const goalPoint = track.getNextCheckpointCenter(nextCheckpointId)
    
    // Find path using A*
    const path = track.findPath(
      this.position.x,
      this.position.z,
      goalPoint.x,
      goalPoint.z
    )
    
    if (path.length > 0) {
      this.astarPath = path
      this.astarPathIndex = 0
    }
  }

  private steerTowardsTarget(deltaTime: number, targetPoint: THREE.Vector3) {
    // Calculate direction to target
    const direction = new THREE.Vector3()
    direction.subVectors(targetPoint, this.position)
    direction.y = 0
    
    const distanceToTarget = direction.length()
    if (distanceToTarget < 0.5) {
      // Very close to target, just maintain speed
      this.speed = Math.min(this.speed + this.acceleration * deltaTime * 0.5, this.maxSpeed * 0.8)
      return
    }
    
    direction.normalize()

    // Calculate target rotation
    const targetRotation = Math.atan2(direction.x, direction.z)
    
    // Calculate angle difference
    let angleDiff = targetRotation - this.rotation
    // Normalize angle difference to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI

    // Turn towards target - use proportional control for smooth steering
    // Turn rate: 4 radians per second
    const turnRate = 4.0 * deltaTime
    const turnAmount = Math.max(-turnRate, Math.min(turnRate, angleDiff))
    this.rotation += turnAmount
    
    // Normalize rotation to [0, 2*PI]
    while (this.rotation > Math.PI * 2) this.rotation -= Math.PI * 2
    while (this.rotation < 0) this.rotation += Math.PI * 2

    // Speed control based on turn angle
    const absAngleDiff = Math.abs(angleDiff)
    const targetSpeedMultiplier = this.aiAggressiveness
    const maxTargetSpeed = this.maxSpeed * targetSpeedMultiplier
    
    if (absAngleDiff > Math.PI / 4) {
      // Sharp turn (>45°) - slow down
      this.speed = Math.max(this.speed - this.acceleration * deltaTime * 1.5, this.maxSpeed * 0.4 * targetSpeedMultiplier)
    } else if (absAngleDiff > Math.PI / 8) {
      // Moderate turn (>22.5°) - slow down slightly
      this.speed = Math.max(this.speed - this.acceleration * deltaTime * 0.3, this.maxSpeed * 0.7 * targetSpeedMultiplier)
    } else {
      // Straight or gentle turn - accelerate towards max speed
      this.speed = Math.min(this.speed + this.acceleration * deltaTime, maxTargetSpeed)
    }
    
    // Ensure AI cars never go backwards
    if (!this.isPlayer) {
      this.speed = Math.max(0, this.speed)
    }
  }

  private checkCollisionWithRepulsion(newPosition: THREE.Vector3, allCars: Car[]): { collided: boolean; repulsion: THREE.Vector3; isAiCollision: boolean } {
    const testBox = new THREE.Box3()
    const tempMesh = this.mesh.clone()
    tempMesh.position.copy(newPosition)
    testBox.setFromObject(tempMesh)

    const repulsion = new THREE.Vector3(0, 0, 0)
    let collided = false
    let isAiCollision = false

    for (const otherCar of allCars) {
      if (otherCar === this || otherCar.finished) continue
      
      if (testBox.intersectsBox(otherCar.boundingBox)) {
        collided = true
        // Check if both cars are AI (neither is player)
        isAiCollision = !this.isPlayer && !otherCar.isPlayer
        
        // Calculate repulsion vector to push cars apart
        const toOther = new THREE.Vector3()
        toOther.subVectors(this.position, otherCar.position)
        toOther.y = 0 // Keep on ground plane
        
        const distance = toOther.length()
        if (distance > 0.01) { // Avoid division by zero
          toOther.normalize()
          // Push cars apart - stronger push when closer together
          const pushStrength = Math.max(0.4, 1.0 - distance) * 0.5
          toOther.multiplyScalar(pushStrength)
          repulsion.add(toOther)
        } else {
          // If cars are exactly on top of each other, push in a random direction
          const randomAngle = Math.random() * Math.PI * 2
          repulsion.add(new THREE.Vector3(
            Math.cos(randomAngle) * 0.5,
            0,
            Math.sin(randomAngle) * 0.5
          ))
        }
      }
    }

    return { collided, repulsion, isAiCollision }
  }

  private updateLapProgress(track: Track) {
    // Calculate progress based on position along track
    // Pass previous progress to ensure directional movement
    this.lapProgress = track.getProgress(this.position, this.lapProgress)
  }

  public updateCheckpoints(track: Track) {
    // Check if car is in any checkpoint
    const checkpointCount = track.getCheckpointCount()
    
    // Initialize checkpointPassed array if needed (supports dynamic checkpoint counts)
    if (this.checkpointPassed.length !== checkpointCount) {
      this.checkpointPassed = new Array(checkpointCount).fill(false)
    }
    
    for (let i = 0; i < checkpointCount; i++) {
      if (track.isInCheckpoint(this.position, i)) {
        // Check if this is the next expected checkpoint
        const expectedNext = (this.lastCheckpoint + 1) % checkpointCount
        
        if (i === expectedNext || (this.lastCheckpoint === -1 && i === 0)) {
          // Car passed the next checkpoint in sequence
          this.lastCheckpoint = i
          this.checkpointPassed[i] = true
          
          // Note: Lap completion is handled by RaceManager
          // It will check if checkpoint 0 was just passed and all others were already passed
        }
      }
    }
  }

  public startRace() {
    this.finished = false
    this.lapProgress = 0
    this.lapsCompleted = 0
    this.finishPosition = 0
    // Don't give AI cars initial speed - they'll wait for green light
    this.speed = 0
  }

  public reset(x: number, z: number) {
    this.position.set(x, 0.5, z)
    this.startX = x // Update starting X position
    // Cars start facing east (positive x direction) since track goes from -15 to 15 at z: -10
    // In Three.js, rotation.y = Math.PI/2 faces +x direction
    this.rotation = Math.PI / 2
    this.speed = 0
    this.lapProgress = 0
    this.lapsCompleted = 0
    this.finished = false
    this.finishPosition = 0
    this.mesh.position.copy(this.position)
    this.mesh.rotation.y = this.rotation
  }

  public dispose() {
    this.disposeVisualObject(this.mesh)
    this.soundGenerator.dispose()
  }
}
