import * as THREE from 'three'
import { Car } from './Car'
import { Track } from './Track'
import { SoundGenerator } from './SoundGenerator'

const BALL_RADIUS = 1.8
export const DEFAULT_DROP_HEIGHT = 15
const GRAVITY = 25
const BOUNCE_FACTOR = 0.6
const XZ_DRAG = 0.97          // per-frame at 60fps
const CAR_HIT_MULTIPLIER = 3.6 // how much car speed translates to ball impulse
const WALL_BOUNCE_FACTOR = 0.7 // energy kept on wall bounce
const MIN_BOUNCE_VELOCITY = 0.5 // below this, stop bouncing

const FUSE_DURATION = 7        // seconds from activation to explosion
const LAUNCH_RADIUS = 3        // cars within this distance get launched off-screen
const SHOCKWAVE_RADIUS = 12    // cars within this distance get pushed
const SHOCKWAVE_STRENGTH = 8   // max push strength for shockwave

export interface BallExplosionResult {
  exploded: boolean
  playerLaunched: boolean
}

export class Ball {
  public position: THREE.Vector3
  public mesh: THREE.Mesh

  private velocityY: number = 0
  private velocityX: number = 0
  private velocityZ: number = 0
  private soundGenerator: SoundGenerator
  private collidedCars: Set<Car> = new Set()

  // Bomb state
  private activated: boolean = false
  private activatedTimer: number = 0
  private flashAccumulator: number = 0
  private flashOn: boolean = false
  public exploded: boolean = false
  private material: THREE.MeshStandardMaterial

  constructor(scene: THREE.Scene, x: number, y: number, z: number, soundGenerator: SoundGenerator) {
    this.soundGenerator = soundGenerator
    this.position = new THREE.Vector3(x, y, z)

    const geometry = new THREE.SphereGeometry(BALL_RADIUS, 16, 12)
    this.material = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      roughness: 0.4,
      metalness: 0.1,
    })
    this.mesh = new THREE.Mesh(geometry, this.material)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.mesh.position.copy(this.position)
    scene.add(this.mesh)
  }

  update(deltaTime: number, cars: Car[], track: Track): BallExplosionResult {
    const result: BallExplosionResult = { exploded: false, playerLaunched: false }

    // --- Bomb fuse ---
    if (this.activated) {
      this.activatedTimer += deltaTime
      if (this.activatedTimer >= FUSE_DURATION) {
        this.detonate(cars, result)
        return result
      }
      this.updateFlash(deltaTime)
    }

    // --- Y-axis physics (gravity + ground bounce) ---
    this.velocityY -= GRAVITY * deltaTime
    this.position.y += this.velocityY * deltaTime

    if (this.position.y <= BALL_RADIUS) {
      this.position.y = BALL_RADIUS
      if (this.velocityY < -MIN_BOUNCE_VELOCITY) {
        this.soundGenerator.playBallBounce(Math.min(0.15, Math.abs(this.velocityY) * 0.01))
      }
      this.velocityY = -this.velocityY * BOUNCE_FACTOR
      if (Math.abs(this.velocityY) < MIN_BOUNCE_VELOCITY) {
        this.velocityY = 0
      }
    }

    // --- XZ physics ---
    this.position.x += this.velocityX * deltaTime
    this.position.z += this.velocityZ * deltaTime

    // Friction (frame-rate independent)
    const drag = Math.pow(XZ_DRAG, deltaTime * 60)
    this.velocityX *= drag
    this.velocityZ *= drag

    // Clamp to outer track bounds
    const outerResult = track.clampPositionToOuterBounds(this.position, BALL_RADIUS)
    if (outerResult.normals.length > 0) {
      this.position.copy(outerResult.clamped)
      for (const normal of outerResult.normals) {
        this.reflectVelocity(normal)
      }
      this.soundGenerator.playBallWallHit(Math.min(0.12, this.xzSpeed() * 0.015))
    }

    // Clamp to inner track bounds (push out of infield)
    const innerResult = track.clampPositionToInnerBounds(this.position, BALL_RADIUS)
    if (innerResult.normals.length > 0) {
      this.position.copy(innerResult.clamped)
      for (const normal of innerResult.normals) {
        this.reflectVelocity(normal)
      }
      this.soundGenerator.playBallWallHit(Math.min(0.12, this.xzSpeed() * 0.015))
    }

    // --- Car collision ---
    const newCollided = new Set<Car>()
    for (const car of cars) {
      if (car.launched || car.finished || car.isDestroyed) continue

      if (this.checkCarCollision(car)) {
        newCollided.add(car)
        // Only apply impulse on first contact (not while overlapping)
        if (!this.collidedCars.has(car)) {
          this.applyCarImpulse(car)
          this.soundGenerator.playBallCarHit(Math.min(0.2, car.speed * 0.02))
          // Activate bomb on first ever hit
          if (!this.activated) {
            this.activated = true
            this.activatedTimer = 0
          }
        }
      }
    }
    this.collidedCars = newCollided

    // Sync mesh
    this.mesh.position.copy(this.position)

    return result
  }

  private updateFlash(deltaTime: number): void {
    const progress = Math.min(this.activatedTimer / FUSE_DURATION, 1)
    // Flash interval: starts at 0.5s, decreases toward 0.05s
    const flashInterval = Math.max(0.05, 0.5 * (1 - progress))
    this.flashAccumulator += deltaTime

    if (this.flashAccumulator >= flashInterval) {
      this.flashAccumulator = 0
      this.flashOn = !this.flashOn
      this.material.emissive.setHex(this.flashOn ? 0xff0000 : 0x000000)
      this.material.emissiveIntensity = this.flashOn ? 0.8 + progress * 0.5 : 0
      this.soundGenerator.playBombTick(progress)
    }
  }

  private detonate(cars: Car[], result: BallExplosionResult): void {
    this.exploded = true
    this.soundGenerator.playExplosionSound()

    for (const car of cars) {
      if (car.launched || car.finished || car.isDestroyed) continue

      const dx = car.position.x - this.position.x
      const dz = car.position.z - this.position.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist < LAUNCH_RADIUS) {
        // Very close — launch off screen (same as mine)
        car.applyExplosionForce(this.position)
        if (car.isPlayer) result.playerLaunched = true
      } else if (dist < SHOCKWAVE_RADIUS) {
        // Medium range — XZ push
        const falloff = 1 - dist / SHOCKWAVE_RADIUS
        car.applyShockwavePush(this.position, SHOCKWAVE_STRENGTH * falloff)
      }
    }

    result.exploded = true
  }

  /**
   * Sphere-vs-OBB collision: find closest point on the car's OBB to the ball center.
   */
  private checkCarCollision(car: Car): boolean {
    const halfSize = car.getLocalHalfSize()
    const cos = Math.cos(-car.rotation)
    const sin = Math.sin(-car.rotation)

    // Transform ball center into car's local space (XZ only)
    const dx = this.position.x - car.position.x
    const dz = this.position.z - car.position.z
    const localX = dx * cos - dz * sin
    const localZ = dx * sin + dz * cos

    // Clamp to OBB extents
    const closestX = Math.max(-halfSize.x, Math.min(halfSize.x, localX))
    const closestZ = Math.max(-halfSize.z, Math.min(halfSize.z, localZ))

    // Distance from ball center to closest point (in XZ)
    const distX = localX - closestX
    const distZ = localZ - closestZ
    const distSq = distX * distX + distZ * distZ

    return distSq <= BALL_RADIUS * BALL_RADIUS
  }

  /**
   * Apply XZ impulse from car hit. No Y force.
   */
  private applyCarImpulse(car: Car): void {
    // Direction from car center to ball center (XZ only)
    const dirX = this.position.x - car.position.x
    const dirZ = this.position.z - car.position.z
    const len = Math.sqrt(dirX * dirX + dirZ * dirZ)
    if (len < 0.01) return

    const nx = dirX / len
    const nz = dirZ / len
    const impulse = Math.max(car.speed, 3) * CAR_HIT_MULTIPLIER

    this.velocityX += nx * impulse
    this.velocityZ += nz * impulse
  }

  private reflectVelocity(normal: THREE.Vector3): void {
    // Reflect XZ velocity along normal and apply wall bounce factor
    const dot = this.velocityX * normal.x + this.velocityZ * normal.z
    if (dot < 0) {
      this.velocityX -= 2 * dot * normal.x
      this.velocityZ -= 2 * dot * normal.z
      this.velocityX *= WALL_BOUNCE_FACTOR
      this.velocityZ *= WALL_BOUNCE_FACTOR
    }
  }

  private xzSpeed(): number {
    return Math.sqrt(this.velocityX * this.velocityX + this.velocityZ * this.velocityZ)
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.mesh.parent?.remove(this.mesh)
  }
}
