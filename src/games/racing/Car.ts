import * as THREE from 'three'
import { Track } from './Track'
import { SoundGenerator } from './SoundGenerator'
import { NEUTRAL_TOUCH_DRIVE_STATE, type TouchDriveState } from './input'
import { getCachedModelClone } from './assets'
import {
  addFireEffect,
  animateFireEffect,
  clearFireEffect,
  computeLocalHalfSize,
  createDefaultCarMesh,
  createHealthBar,
  disposeVisualObject,
  drawHealthBar,
  orientAndScaleCarModel,
} from './carVisuals'

/** 2D OBB overlap test using separating axis theorem on XZ plane. */
function obbOverlap(
  posA: THREE.Vector3, halfA: THREE.Vector3, rotA: number,
  posB: THREE.Vector3, halfB: THREE.Vector3, rotB: number
): boolean {
  // Each box has two local axes on the XZ plane (right and forward)
  const axA0x = Math.cos(rotA), axA0z = Math.sin(rotA)   // A's local X (right)
  const axA1x = -Math.sin(rotA), axA1z = Math.cos(rotA)   // A's local Z (forward)
  const axB0x = Math.cos(rotB), axB0z = Math.sin(rotB)
  const axB1x = -Math.sin(rotB), axB1z = Math.cos(rotB)

  const dx = posB.x - posA.x
  const dz = posB.z - posA.z

  const axes = [
    [axA0x, axA0z],
    [axA1x, axA1z],
    [axB0x, axB0z],
    [axB1x, axB1z],
  ]

  for (const [ax, az] of axes) {
    const dist = Math.abs(dx * ax + dz * az)
    const rA = halfA.x * Math.abs(axA0x * ax + axA0z * az)
      + halfA.z * Math.abs(axA1x * ax + axA1z * az)
    const rB = halfB.x * Math.abs(axB0x * ax + axB0z * az)
      + halfB.z * Math.abs(axB1x * ax + axB1z * az)
    if (dist > rA + rB) return false
  }
  return true
}

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
  public health: number = 100
  public isDestroyed: boolean = false
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

  // Lane offset state — each AI car gets a fixed offset to spread across the track
  private currentLaneOffset: number = 0
  private static nextAiIndex: number = 0
  public static resetAiIndex() { Car.nextAiIndex = 0 }

  private boundingBox: THREE.Box3
  private localHalfSize: THREE.Vector3 = new THREE.Vector3()
  private boxHelper: THREE.LineSegments | null = null
  private keys: { [key: string]: boolean } = {}
  private keyDownHandler: ((e: KeyboardEvent) => void) | null = null
  private keyUpHandler: ((e: KeyboardEvent) => void) | null = null
  // Shockwave push velocity (decays over time for visible slide effect)
  private pushVelocityX: number = 0
  private pushVelocityZ: number = 0

  /** When set, car is flying from a mine explosion and ignores normal driving. */
  public launched: boolean = false
  public launchVelocity: THREE.Vector3 | null = null
  private launchAngularVelocity: THREE.Vector3 | null = null
  private readonly gravity: number = 35
  private touchControls: TouchDriveState = { ...NEUTRAL_TOUCH_DRIVE_STATE }
  private soundGenerator: SoundGenerator
  private fireMeshes: THREE.Sprite[] = []
  private fireLight: THREE.PointLight | null = null
  private fireTime: number = 0
  private isDamaged: boolean = false
  private damageSpeedMultiplier: number = 1
  private turboBoostMultiplier: number = 1
  private glueSlowMultiplier: number = 1
  private glueSlowTimer: number = 0

  // Health bar
  private healthBarSprite: THREE.Sprite | null = null
  private healthBarCanvas: HTMLCanvasElement | null = null
  private healthBarTexture: THREE.CanvasTexture | null = null
  private lastDrawnHealth: number = -1
  public hasRam: boolean = false
  private lastCollisionTime: number = 0
  private collisionCooldown: number = 0.2 // Minimum time between collision sounds (seconds)

  /** Half-extent of car for outer track boundary checks (keeps car body on track, not just center) */
  private static readonly TRACK_COLLISION_MARGIN = 1.6
  /** Tighter margin for inner rail so the car visually touches the rail before bouncing */
  private static readonly INNER_RAIL_MARGIN = 0.7
  private static readonly MIN_STEER_SPEED = 0.1
  private static readonly BRAKE_ONLY_SPEED = 0.75
  private static readonly TOUCH_REVERSE_TRIGGER = 0.55

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

    // Assign each AI car a different base lane offset so they spread across the track
    if (!isPlayer) {
      // Inner (1.5), middle (0.0), outer (-1.5) — moderate spread, safe from rails
      const offsets = [1.5, 0.0, -1.5]
      this.currentLaneOffset = offsets[Car.nextAiIndex % offsets.length]
      Car.nextAiIndex++
    }

    // Apply characteristics if provided
    if (characteristics) {
      this.maxSpeed = characteristics.maxSpeed
      this.acceleration = characteristics.acceleration
      this.turnSpeed = characteristics.turnSpeed
      this.aiAggressiveness = characteristics.aiAggressiveness
      this.pathRecalculateInterval = characteristics.pathRecalculateInterval
      this.waypointLookAhead = characteristics.waypointLookAhead
    }

    this.mesh = createDefaultCarMesh(color)

    // Cars start facing east (positive x direction) since track goes from -15 to 15 at z: -10
    // In Three.js, rotation.y = Math.PI/2 faces +x direction
    this.rotation = Math.PI / 2

    this.mesh.position.copy(this.position)
    this.mesh.rotation.y = this.rotation

    // Compute local-space bounding half-size (with rotation 0)
    this.localHalfSize.copy(computeLocalHalfSize(this.mesh))

    // Setup bounding box (will be updated each frame as OBB)
    this.boundingBox = new THREE.Box3().setFromObject(this.mesh)

    if (modelPath) {
      this.applyCachedModel(modelPath)
    }

    // Create health bar sprite (always faces camera)
    this.createHealthBar()

    // Setup keyboard controls for player
    if (isPlayer) {
      this.setupControls()
    }
  }

  public getBoundingBox(): THREE.Box3 {
    return this.boundingBox
  }

  public getLocalHalfSize(): THREE.Vector3 {
    return this.localHalfSize
  }

  private recomputeLocalHalfSize(): void {
    this.localHalfSize.copy(computeLocalHalfSize(this.mesh))
  }

  /** Get the four XZ corners of the oriented bounding box. */
  public getOBBCorners(): THREE.Vector3[] {
    const hw = this.localHalfSize.x
    const hd = this.localHalfSize.z
    const cos = Math.cos(this.rotation)
    const sin = Math.sin(this.rotation)
    const cx = this.position.x
    const cz = this.position.z
    const corners: THREE.Vector3[] = []
    for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]] as [number, number][]) {
      corners.push(new THREE.Vector3(
        cx + lx * cos - lz * sin,
        this.position.y,
        cz + lx * sin + lz * cos
      ))
    }
    return corners
  }

  /** Check OBB-vs-OBB collision using separating axis theorem on the XZ plane. */
  public obbIntersects(other: Car): boolean {
    return obbOverlap(
      this.position, this.localHalfSize, this.rotation,
      other.position, other.localHalfSize, other.rotation
    )
  }

  public showBoundingBoxHelper(_scene: THREE.Scene): void {
    if (this.boxHelper) return
    // Create a wireframe box in local space that will follow the mesh
    const geo = new THREE.BufferGeometry()
    const hw = this.localHalfSize.x
    const hh = this.localHalfSize.y
    const hd = this.localHalfSize.z
    // 12 edges of a box
    const verts = new Float32Array([
      -hw, -hh, -hd, hw, -hh, -hd,
      hw, -hh, -hd, hw, -hh, hd,
      hw, -hh, hd, -hw, -hh, hd,
      -hw, -hh, hd, -hw, -hh, -hd,
      -hw, hh, -hd, hw, hh, -hd,
      hw, hh, -hd, hw, hh, hd,
      hw, hh, hd, -hw, hh, hd,
      -hw, hh, hd, -hw, hh, -hd,
      -hw, -hh, -hd, -hw, hh, -hd,
      hw, -hh, -hd, hw, hh, -hd,
      hw, -hh, hd, hw, hh, hd,
      -hw, -hh, hd, -hw, hh, hd,
    ])
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
    const mat = new THREE.LineBasicMaterial({ color: 0x00ff00 })
    this.boxHelper = new THREE.LineSegments(geo, mat)
    this.mesh.add(this.boxHelper)
  }

  private setupControls() {
    this.keyDownHandler = (e: KeyboardEvent) => {
      this.keys[e.key] = true
    }

    this.keyUpHandler = (e: KeyboardEvent) => {
      this.keys[e.key] = false
    }

    window.addEventListener('keydown', this.keyDownHandler)
    window.addEventListener('keyup', this.keyUpHandler)
  }

  private applyCachedModel(modelPath: string): void {
    const cachedModel = getCachedModelClone(modelPath)
    if (!cachedModel) {
      console.warn(`Missing preloaded car model "${modelPath}", keeping fallback geometry`)
      return
    }

    const model = orientAndScaleCarModel(cachedModel)
    this.replaceCarVisual(model)
    this.recomputeLocalHalfSize()
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
    disposeVisualObject(object)
  }

  /** Apply explosion force from a mine; car will be launched and fly off. */
  public applyExplosionForce(origin: THREE.Vector3, forceMagnitude: number = 45) {
    this.launched = true
    this.speed = 0
    const dir = new THREE.Vector3()
    dir.subVectors(this.position, origin)
    dir.y = 0
    if (dir.lengthSq() < 0.01) {
      dir.set(1, 0, 0)
    } else {
      dir.normalize()
    }
    const upComponent = 0.7
    const horizontalComponent = Math.sqrt(1 - upComponent * upComponent)
    this.launchVelocity = new THREE.Vector3(
      dir.x * horizontalComponent * forceMagnitude,
      upComponent * forceMagnitude,
      dir.z * horizontalComponent * forceMagnitude
    )
    this.launchAngularVelocity = new THREE.Vector3(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 14
    )
  }

  /** Apply an XZ shockwave push without launching the car. Adds velocity for visible slide. */
  public applyShockwavePush(origin: THREE.Vector3, strength: number) {
    const dir = new THREE.Vector3()
    dir.subVectors(this.position, origin)
    dir.y = 0
    if (dir.lengthSq() < 0.01) dir.set(1, 0, 0)
    else dir.normalize()
    this.pushVelocityX += dir.x * strength * 3
    this.pushVelocityZ += dir.z * strength * 3
    this.speed *= 0.5
  }

  public applyPermanentSpeedMultiplier(multiplier: number) {
    this.maxSpeed *= multiplier
  }

  public applyPermanentTurnMultiplier(multiplier: number) {
    this.turnSpeed *= multiplier
  }

  public setTurboBoostMultiplier(multiplier: number) {
    this.turboBoostMultiplier = multiplier
  }

  public applyGlueSlow(duration: number, multiplier: number) {
    this.glueSlowTimer = duration
    this.glueSlowMultiplier = multiplier
    this.speed *= multiplier
  }

  public clearTemporarySpeedEffects() {
    this.turboBoostMultiplier = 1
    this.glueSlowMultiplier = 1
    this.glueSlowTimer = 0
  }

  private getEffectiveMaxSpeed(): number {
    return this.maxSpeed * this.damageSpeedMultiplier * this.turboBoostMultiplier * this.glueSlowMultiplier
  }

  public update(deltaTime: number, track: Track, allCars: Car[], raceComplete: boolean = false, canStart: boolean = false) {
    this.updateGlueSlowState(deltaTime)

    if (this.updateLaunchedState(deltaTime)) {
      return
    }

    if (this.updateDestroyedState(deltaTime)) {
      return
    }

    if (this.updateStoppedState(raceComplete, canStart)) {
      return
    }

    this.updateDrivingIntent(deltaTime, track, allCars)

    const movementState = this.createMovementState(deltaTime)
    const positionAfterWall = this.resolveWallCollisions(movementState.newPosition, movementState.direction, track)
    this.resolveCarCollision(positionAfterWall, movementState.direction, movementState.moveDistance, allCars)
    this.syncDrivingVisualState(deltaTime)
    this.updateRaceProgress(track)
  }

  private updateGlueSlowState(deltaTime: number): void {
    if (this.glueSlowTimer <= 0) {
      return
    }

    this.glueSlowTimer = Math.max(0, this.glueSlowTimer - deltaTime)
    if (this.glueSlowTimer === 0) {
      this.glueSlowMultiplier = 1
    }
  }

  private updateLaunchedState(deltaTime: number): boolean {
    if (!this.launched || !this.launchVelocity) {
      return false
    }

    this.position.add(this.launchVelocity.clone().multiplyScalar(deltaTime))
    this.launchVelocity.y -= this.gravity * deltaTime
    this.mesh.position.copy(this.position)
    if (this.launchAngularVelocity) {
      this.mesh.rotation.x += this.launchAngularVelocity.x * deltaTime
      this.mesh.rotation.y += this.launchAngularVelocity.y * deltaTime
      this.mesh.rotation.z += this.launchAngularVelocity.z * deltaTime
    }
    this.updateHealthBar()
    return true
  }

  private updateDestroyedState(deltaTime: number): boolean {
    if (!this.isDestroyed) {
      return false
    }

    this.fireTime += deltaTime
    this.animateFire()
    this.updateHealthBar()
    return true
  }

  private updateStoppedState(raceComplete: boolean, canStart: boolean): boolean {
    if (!this.finished && !raceComplete && canStart) {
      return false
    }

    this.speed = 0
    this.mesh.position.copy(this.position)
    this.mesh.rotation.y = this.rotation
    return true
  }

  private updateDrivingIntent(deltaTime: number, track: Track, allCars: Car[]): void {
    if (this.isPlayer) {
      this.updatePlayer(deltaTime)
      return
    }

    this.updateAI(deltaTime, track, allCars)
  }

  private createMovementState(deltaTime: number): {
    direction: THREE.Vector3
    moveDistance: number
    newPosition: THREE.Vector3
  } {
    const effectiveSpeed = this.isPlayer ? this.speed : Math.max(0, this.speed)
    const moveDistance = effectiveSpeed * deltaTime
    const direction = new THREE.Vector3(
      Math.sin(this.rotation),
      0,
      Math.cos(this.rotation)
    )
    const newPosition = this.position.clone().add(direction.multiplyScalar(moveDistance))

    newPosition.x += this.pushVelocityX * deltaTime
    newPosition.z += this.pushVelocityZ * deltaTime
    const pushDrag = Math.pow(0.92, deltaTime * 60)
    this.pushVelocityX *= pushDrag
    this.pushVelocityZ *= pushDrag
    if (Math.abs(this.pushVelocityX) < 0.1) this.pushVelocityX = 0
    if (Math.abs(this.pushVelocityZ) < 0.1) this.pushVelocityZ = 0

    return { direction, moveDistance, newPosition }
  }

  private resolveWallCollisions(
    newPosition: THREE.Vector3,
    direction: THREE.Vector3,
    track: Track
  ): THREE.Vector3 {
    let positionAfterWall: THREE.Vector3
    if (track.isOutsideOuterBorder(newPosition, Car.TRACK_COLLISION_MARGIN)) {
      const { clamped, normals } = track.clampPositionToOuterBounds(
        newPosition,
        Car.TRACK_COLLISION_MARGIN
      )
      positionAfterWall = clamped
      const velocity = direction.clone().multiplyScalar(this.speed)
      const slideVelocity = velocity.clone()
      for (const n of normals) {
        const intoWall = slideVelocity.dot(n)
        if (intoWall < 0) {
          slideVelocity.addScaledVector(n, -intoWall)
        }
      }
      const slideSpeed = slideVelocity.length()
      this.speed = slideSpeed
      if (slideSpeed > 0.05) {
        this.rotation = Math.atan2(slideVelocity.x, slideVelocity.z)
      }
      this.speed *= 0.92
    } else if (track.isInsideInnerArea(newPosition, Car.INNER_RAIL_MARGIN)) {
      const { clamped } = track.clampPositionToInnerBounds(
        newPosition,
        Car.INNER_RAIL_MARGIN
      )
      positionAfterWall = clamped
    } else {
      positionAfterWall = newPosition
    }

    this.position.copy(positionAfterWall)
    return positionAfterWall
  }

  private resolveCarCollision(
    positionAfterWall: THREE.Vector3,
    direction: THREE.Vector3,
    moveDistance: number,
    allCars: Car[]
  ): void {
    const collisionResult = this.checkCollisionWithRepulsion(positionAfterWall, allCars)
    if (collisionResult.collided) {
      const currentTime = performance.now() / 1000
      if (currentTime - this.lastCollisionTime >= this.collisionCooldown) {
        const volume = collisionResult.isAiCollision ? 0.3 : undefined
        this.soundGenerator.playCrashSound(volume)
        this.lastCollisionTime = currentTime
      }

      this.position.add(collisionResult.repulsion)
      const reducedMovement = direction.clone().multiplyScalar(moveDistance * 0.3)
      this.position.add(reducedMovement)
      this.speed *= 0.8
      const rotationAmount = 0.015
      if (Math.random() > 0.5) {
        this.rotation += rotationAmount
      } else {
        this.rotation -= rotationAmount
      }
    } else {
      this.position.copy(positionAfterWall)
    }
  }

  private syncDrivingVisualState(deltaTime: number): void {
    this.mesh.position.copy(this.position)
    this.mesh.rotation.y = this.rotation

    if (this.isDamaged) {
      this.fireTime += deltaTime
      this.animateFire()
    }

    this.updateHealthBar()
    this.boundingBox.setFromObject(this.mesh)
  }

  private updateRaceProgress(track: Track): void {
    this.updateLapProgress(track)
    this.updateCheckpoints(track)
  }

  public setTouchControls(controls: TouchDriveState) {
    this.touchControls = controls
  }

  private updatePlayer(deltaTime: number) {
    // Don't respond to input if finished
    if (this.finished) {
      this.speed = 0
      return
    }

    const keyboardThrottle = this.getKeyboardAxis(
      ['ArrowUp', 'w', 'W'],
      ['ArrowDown', 's', 'S']
    )
    const keyboardSteering = this.getKeyboardAxis(
      ['ArrowRight', 'd', 'D'],
      ['ArrowLeft', 'a', 'A']
    )

    const touchThrottle = keyboardThrottle === 0 ? this.touchControls.throttle : 0
    const touchSteering = keyboardSteering === 0 ? this.touchControls.steering : 0

    this.applyThrottle(deltaTime, keyboardThrottle, touchThrottle)

    // Turning - direction depends on whether car is moving forward or reverse
    // When in reverse, steering is reversed (left turns right, right turns left)
    // Reduced sensitivity by using a lower multiplier
    // Check both keyboard and touch controls
    const steeringInput = keyboardSteering !== 0 ? keyboardSteering : touchSteering
    const isTouch = keyboardSteering === 0 && touchSteering !== 0
    const currentSpeed = Math.abs(this.speed)
    const isReversing = this.speed < 0
    const effectiveMaxSpeed = this.getEffectiveMaxSpeed()
    if (currentSpeed > Car.MIN_STEER_SPEED && steeringInput !== 0) {
      const turnMultiplier = isTouch ? 1.35 : 0.7
      // Use a minimum speed ratio so turning works at low speeds
      const speedRatio = Math.max(0.5, currentSpeed / effectiveMaxSpeed)
      const turnAmount =
        this.turnSpeed * speedRatio * turnMultiplier * Math.abs(steeringInput)

      // When reversing, swap left and right steering
      if (isReversing) {
        if (steeringInput < 0) {
          // In reverse, left input turns right (clockwise)
          this.rotation -= turnAmount
        }
        if (steeringInput > 0) {
          // In reverse, right input turns left (counter-clockwise)
          this.rotation += turnAmount
        }
      } else {
        if (steeringInput < 0) {
          // Turn left (counter-clockwise when viewed from above)
          this.rotation += turnAmount
        }
        if (steeringInput > 0) {
          // Turn right (clockwise when viewed from above)
          this.rotation -= turnAmount
        }
      }
    }
  }

  private applyThrottle(deltaTime: number, keyboardThrottle: number, touchThrottle: number) {
    const effectiveMaxSpeed = this.getEffectiveMaxSpeed()

    if (keyboardThrottle > 0) {
      this.speed = Math.min(this.speed + this.acceleration * deltaTime, effectiveMaxSpeed)
      return
    }

    if (keyboardThrottle < 0) {
      this.speed = Math.max(this.speed - this.acceleration * deltaTime, -effectiveMaxSpeed)
      return
    }

    if (touchThrottle > 0) {
      this.speed = Math.min(this.speed + this.acceleration * deltaTime * touchThrottle, effectiveMaxSpeed)
      return
    }

    if (touchThrottle < 0) {
      const downwardIntent = Math.abs(touchThrottle)

      if (this.speed > Car.BRAKE_ONLY_SPEED) {
        this.speed = Math.max(this.speed - this.acceleration * deltaTime * (1 + downwardIntent), 0)
        return
      }

      if (downwardIntent > Car.TOUCH_REVERSE_TRIGGER) {
        const reverseStrength =
          (downwardIntent - Car.TOUCH_REVERSE_TRIGGER) / (1 - Car.TOUCH_REVERSE_TRIGGER)
        this.speed = Math.max(
          this.speed - this.acceleration * deltaTime * reverseStrength,
          -effectiveMaxSpeed
        )
        return
      }

      if (this.speed > 0) {
        this.speed = Math.max(this.speed - this.acceleration * deltaTime * downwardIntent, 0)
        return
      }
    }

    this.applyNaturalDeceleration(deltaTime)
  }

  private applyNaturalDeceleration(deltaTime: number) {
    if (this.speed > 0) {
      this.speed = Math.max(this.speed - this.acceleration * deltaTime * 2, 0)
    } else if (this.speed < 0) {
      this.speed = Math.min(this.speed + this.acceleration * deltaTime * 2, 0)
    }
  }

  private getKeyboardAxis(positiveKeys: string[], negativeKeys: string[]) {
    const positivePressed = positiveKeys.some(key => this.keys[key])
    const negativePressed = negativeKeys.some(key => this.keys[key])

    if (positivePressed === negativePressed) {
      return 0
    }

    return positivePressed ? 1 : -1
  }

  private updateAI(deltaTime: number, track: Track, _allCars: Car[]) {
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
    const effectiveMaxSpeed = this.getEffectiveMaxSpeed()
    if (this.astarPath.length === 0) {
      this.speed = Math.min(this.speed + this.acceleration * deltaTime * 0.5, effectiveMaxSpeed * 0.5)
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
      // Offset every waypoint perpendicular to the path direction based on current lane
      if (this.currentLaneOffset !== 0 && path.length >= 2) {
        for (let i = 0; i < path.length; i++) {
          const wp = path[i]
          // Compute path direction at this waypoint
          const prev = path[Math.max(0, i - 1)]
          const next = path[Math.min(path.length - 1, i + 1)]
          const dx = next.x - prev.x
          const dz = next.z - prev.z
          const segLen = Math.sqrt(dx * dx + dz * dz)
          if (segLen < 0.01) continue

          // Perpendicular: (-dz, dx) or (dz, -dx). Pick the one pointing toward center.
          const perpX = -dz / segLen
          const perpZ = dx / segLen
          // Dot with "toward center" to check if this perp points inward
          const dotToCenter = perpX * (-wp.x) + perpZ * (-wp.z)
          const sign = dotToCenter >= 0 ? 1 : -1
          // positive laneOffset = inner, so use sign; negative = outer, flip
          wp.x += sign * perpX * this.currentLaneOffset
          wp.z += sign * perpZ * this.currentLaneOffset

          // Clamp: if offset pushed waypoint off-track, pull it back (2.0 margin keeps car away from rails)
          if (track.isInsideInnerArea(wp, 2.0)) {
            const { clamped } = track.clampPositionToInnerBounds(wp, 2.0)
            wp.copy(clamped)
          } else if (track.isOutsideOuterBorder(wp, 2.0)) {
            const { clamped } = track.clampPositionToOuterBounds(wp, 2.0)
            wp.copy(clamped)
          }
        }
      }
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
    const effectiveMaxSpeed = this.getEffectiveMaxSpeed()
    if (distanceToTarget < 0.5) {
      // Very close to target, just maintain speed
      this.speed = Math.min(this.speed + this.acceleration * deltaTime * 0.5, effectiveMaxSpeed * 0.8)
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
    const maxTargetSpeed = effectiveMaxSpeed * targetSpeedMultiplier

    if (absAngleDiff > Math.PI / 4) {
      // Sharp turn (>45°) - slow down
      this.speed = Math.max(this.speed - this.acceleration * deltaTime * 1.5, effectiveMaxSpeed * 0.4 * targetSpeedMultiplier)
    } else if (absAngleDiff > Math.PI / 8) {
      // Moderate turn (>22.5°) - slow down slightly
      this.speed = Math.max(this.speed - this.acceleration * deltaTime * 0.3, effectiveMaxSpeed * 0.7 * targetSpeedMultiplier)
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
    const repulsion = new THREE.Vector3(0, 0, 0)
    let collided = false
    let isAiCollision = false

    for (const otherCar of allCars) {
      if (otherCar === this || otherCar.finished || otherCar.launched) continue

      if (obbOverlap(newPosition, this.localHalfSize, this.rotation, otherCar.position, otherCar.localHalfSize, otherCar.rotation)) {
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
          let pushStrength = Math.max(0.4, 1.0 - distance) * 0.5

          if (this.isPlayer && this.hasRam) {
            // Ram: push other car harder, self barely bounces
            const pushToOther = toOther.clone().multiplyScalar(-pushStrength * 2)
            otherCar.pushVelocityX += pushToOther.x * 8
            otherCar.pushVelocityZ += pushToOther.z * 8
            otherCar.takeDamageAmount(3)
            pushStrength *= 0.5
          }

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

  public takeDamage(): void {
    this.takeDamageAmount(6)
  }

  public takeDamageAmount(amount: number): void {
    if (this.isDestroyed) return
    this.health -= amount
    if (this.health <= 0) {
      this.health = 0
      this.destroy()
    } else if (this.health <= 20 && !this.isDamaged && !this.isPlayer) {
      this.applyDamagedState()
    }
  }

  private applyDamagedState(): void {
    this.isDamaged = true
    this.damageSpeedMultiplier = 0.3
    this.addFireEffect(3, 0.5, 0.4, 1.0, 4)
  }

  private destroy(): void {
    this.isDestroyed = true
    this.speed = 0

    // If already showing damaged fire, clear it before adding full fire
    if (this.isDamaged) {
      this.clearFireEffect()
    }

    this.addFireEffect(6, 0.8, 0.8, 2, 6)
  }

  private addFireEffect(count: number, spreadXZ: number, baseScale: number, lightIntensity: number, lightDistance: number): void {
    const fireState = addFireEffect(this.mesh, count, spreadXZ, baseScale, lightIntensity, lightDistance)
    this.fireMeshes = fireState.fireMeshes
    this.fireLight = fireState.fireLight
  }

  private animateFire(): void {
    animateFireEffect(this.fireMeshes, this.fireLight, this.fireTime)
  }

  private clearFireEffect(): void {
    const fireState = clearFireEffect(this.mesh, {
      fireMeshes: this.fireMeshes,
      fireLight: this.fireLight
    })
    this.fireMeshes = fireState.fireMeshes
    this.fireLight = fireState.fireLight
  }

  public startRace() {
    this.resetTransientState()
  }

  public reset(x: number, z: number) {
    this.position.set(x, 0.5, z)
    this.startX = x
    this.rotation = Math.PI / 2
    this.resetTransientState()
    this.mesh.position.copy(this.position)
    this.mesh.rotation.set(0, this.rotation, 0)
  }

  private resetTransientState(): void {
    this.speed = 0
    this.lapProgress = 0
    this.lapsCompleted = 0
    this.finished = false
    this.finishPosition = 0
    this.launched = false
    this.launchVelocity = null
    this.launchAngularVelocity = null
    this.pushVelocityX = 0
    this.pushVelocityZ = 0
    this.clearTemporarySpeedEffects()
    this.health = 100
    this.isDestroyed = false
    this.isDamaged = false
    this.damageSpeedMultiplier = 1
    this.clearFireEffect()
  }

  private createHealthBar(): void {
    const healthBar = createHealthBar()
    this.healthBarCanvas = healthBar.canvas
    this.healthBarTexture = healthBar.texture
    this.healthBarSprite = healthBar.sprite
    this.drawHealthBar()
  }

  /** Must be called after the car is added to the scene, to add the health bar sprite too. */
  public addHealthBarToScene(scene: THREE.Scene): void {
    if (this.healthBarSprite) {
      scene.add(this.healthBarSprite)
    }
  }

  private drawHealthBar(): void {
    if (!this.healthBarCanvas || !this.healthBarTexture) return
    if (this.lastDrawnHealth === this.health) return
    this.lastDrawnHealth = this.health
    drawHealthBar(this.healthBarCanvas, this.healthBarTexture, this.health)
  }

  private updateHealthBar(): void {
    this.drawHealthBar()
    if (this.healthBarSprite) {
      this.healthBarSprite.visible = this.health < 100 && !this.isDestroyed && !this.launched
      this.healthBarSprite.position.set(this.position.x, this.position.y + 1.8, this.position.z)
    }
  }

  public dispose() {
    if (this.keyDownHandler) {
      window.removeEventListener('keydown', this.keyDownHandler)
      this.keyDownHandler = null
    }
    if (this.keyUpHandler) {
      window.removeEventListener('keyup', this.keyUpHandler)
      this.keyUpHandler = null
    }

    this.clearFireEffect()
    if (this.healthBarSprite) {
      this.healthBarSprite.parent?.remove(this.healthBarSprite)
      this.healthBarSprite.material.dispose()
    }
    if (this.healthBarTexture) {
      this.healthBarTexture.dispose()
    }
    this.disposeVisualObject(this.mesh)
    this.soundGenerator.dispose()
  }
}
