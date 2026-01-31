import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { FLOOR_Y } from './types'

/** Collision group for Rolie so player and bullets can hit it. */
export const ROLIE_COLLISION_GROUP = 8
/** Collision mask: default (1) = floor, walls, player, boxes; 4 = turrets. */
const ROLIE_COLLISION_MASK = 1 | 4

export const ROLIE_BODY_RADIUS = 0.7
const ROLIE_BODY_HEIGHT = 1.2
const ROLIE_MASS = 15
/** Distance (XZ) below which Rolie charges at the player to explode. */
export const ROLIE_CHARGE_TRIGGER_DISTANCE = 8
/** Speed when wandering (units per second). */
const ROLIE_WANDER_SPEED = 1.8
/** Speed when charging at player. */
const ROLIE_CHARGE_SPEED = 5
/** How often to pick a new wander direction (seconds). */
const ROLIE_WANDER_CHANGE_INTERVAL = 2
const ROLIE_MAX_HEALTH = 3
const HEALTH_BAR_WIDTH = 0.8
const HEALTH_BAR_HEIGHT = 0.08
const HEALTH_BAR_Y_OFFSET = 1.2
/** Seconds after spawn before proximity to player can trigger explosion (so player can see the Rolie). */
const ROLIE_ARM_DELAY = 2

export class Rolie {
  /** Physics body; position is body.position. */
  body: CANNON.Body
  /** Facing angle in radians (Y-axis rotation). */
  facingAngle = 0
  health = ROLIE_MAX_HEALTH
  readonly maxHealth = ROLIE_MAX_HEALTH
  private wanderDir = { x: 1, z: 0 }
  private wanderTimeLeft = ROLIE_WANDER_CHANGE_INTERVAL
  private timeAlive = 0
  private _charging = false
  private healthBarBg: THREE.Mesh
  private healthBarFill: THREE.Mesh
  private healthBarContainer: THREE.Group

  /** Position in world space (reads from body). */
  get position() {
    return this.body.position
  }

  constructor(
    world: CANNON.World,
    scene: THREE.Scene,
    pos: { x: number; z: number }
  ) {
    const halfH = ROLIE_BODY_HEIGHT / 2
    const y = FLOOR_Y + halfH
    this.body = new CANNON.Body({
      mass: ROLIE_MASS,
      position: new CANNON.Vec3(pos.x, y, pos.z),
      shape: new CANNON.Cylinder(ROLIE_BODY_RADIUS, ROLIE_BODY_RADIUS, ROLIE_BODY_HEIGHT, 12),
      collisionFilterGroup: ROLIE_COLLISION_GROUP,
      collisionFilterMask: ROLIE_COLLISION_MASK,
      linearDamping: 0.5,
      angularDamping: 0.5,
    })
      ; (this.body as unknown as { rolieRef?: Rolie }).rolieRef = this
    world.addBody(this.body)

    // Visual is created and owned by the engine

    this.healthBarContainer = new THREE.Group()
    this.healthBarContainer.position.set(this.position.x, this.position.y + HEALTH_BAR_Y_OFFSET, this.position.z)
    this.healthBarContainer.rotation.x = -Math.PI / 2
    const bgGeo = new THREE.PlaneGeometry(HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT)
    this.healthBarBg = new THREE.Mesh(bgGeo, new THREE.MeshBasicMaterial({ color: 0x333333 }))
    this.healthBarBg.position.z = 0.01
    this.healthBarContainer.add(this.healthBarBg)
    const fillGeo = new THREE.PlaneGeometry(HEALTH_BAR_WIDTH - 0.04, HEALTH_BAR_HEIGHT - 0.04)
    this.healthBarFill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: 0x4caf50 }))
    this.healthBarFill.position.z = 0.02
    this.healthBarFill.scale.x = 1
    this.healthBarContainer.add(this.healthBarFill)
    scene.add(this.healthBarContainer)

    this.pickNewWanderDirection()
  }

  private pickNewWanderDirection() {
    const angle = Math.random() * Math.PI * 2
    this.wanderDir.x = Math.sin(angle)
    this.wanderDir.z = Math.cos(angle)
    this.wanderTimeLeft = ROLIE_WANDER_CHANGE_INTERVAL * (0.6 + Math.random() * 0.8)
  }

  /**
   * Update AI: wander randomly when far from player, charge toward player when within trigger distance.
   * Call every frame after physics step.
   */
  /** True after ROLIE_ARM_DELAY seconds; until then proximity does not trigger explosion. */
  isArmed(): boolean {
    return this.timeAlive >= ROLIE_ARM_DELAY
  }

  /** True when within trigger distance and moving toward player. */
  isCharging(): boolean {
    return this._charging
  }

  update(
    dt: number,
    playerPosition: { x: number; z: number },
    halfX: number,
    halfZ: number
  ) {
    this.timeAlive += dt
    // Keep Rolie on the floor (gravity would otherwise pull it down)
    const halfH = ROLIE_BODY_HEIGHT / 2
    const targetY = FLOOR_Y + halfH
    if (this.body.position.y < targetY) {
      this.body.position.y = targetY
      this.body.velocity.y = 0
    }
    const dx = playerPosition.x - this.position.x
    const dz = playerPosition.z - this.position.z
    const distToPlayer = Math.sqrt(dx * dx + dz * dz)

    let speed: number
    let dirX: number
    let dirZ: number
    if (distToPlayer <= ROLIE_CHARGE_TRIGGER_DISTANCE && distToPlayer > 0.01) {
      this._charging = true
      const norm = 1 / distToPlayer
      dirX = dx * norm
      dirZ = dz * norm
      speed = ROLIE_CHARGE_SPEED
    } else {
      this._charging = false
      this.wanderTimeLeft -= dt
      if (this.wanderTimeLeft <= 0) this.pickNewWanderDirection()
      dirX = this.wanderDir.x
      dirZ = this.wanderDir.z
      speed = ROLIE_WANDER_SPEED
    }
    // Update facing angle to match movement direction
    this.facingAngle = Math.atan2(dirX, dirZ)

    // Move position manually (no physics)
    this.position.x += dirX * speed * dt
    this.position.z += dirZ * speed * dt

    // Clamp to arena bounds (physics will resolve; nudge position if out of bounds to avoid getting stuck)
    const margin = 1.0
    const minX = -halfX + margin
    const maxX = halfX - margin
    const minZ = -halfZ + margin
    const maxZ = halfZ - margin
    let hitWall = false
    if (this.position.x < minX) { this.body.position.x = minX; hitWall = true }
    if (this.position.x > maxX) { this.body.position.x = maxX; hitWall = true }
    if (this.position.z < minZ) { this.body.position.z = minZ; hitWall = true }
    if (this.position.z > maxZ) { this.body.position.z = maxZ; hitWall = true }
    if (hitWall) this.pickNewWanderDirection()

    this.body.velocity.x = dirX * speed
    this.body.velocity.z = dirZ * speed
    this.body.velocity.y = 0
    this.updateHealthBar()
  }

  /** Call after physics step to sync health bar position from body. */
  syncFromBody() {
    const p = this.body.position
    this.healthBarContainer.position.set(p.x, p.y + HEALTH_BAR_Y_OFFSET, p.z)
  }

  private updateHealthBar() {
    const ratio = Math.max(0, this.health / this.maxHealth)
    this.healthBarFill.scale.x = ratio
    this.healthBarFill.position.x = -(1 - ratio) * (HEALTH_BAR_WIDTH - 0.04) / 2
      ; (this.healthBarFill.material as THREE.MeshBasicMaterial).color.setHex(
        ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xff9800 : 0xf44336
      )
  }

  takeDamage(amount: number) {
    this.health = Math.max(0, this.health - amount)
  }

  isAlive(): boolean {
    return this.health > 0
  }

  dispose(scene: THREE.Scene, world: CANNON.World) {
    world.removeBody(this.body)
    scene.remove(this.healthBarContainer)
    this.healthBarBg.geometry.dispose()
      ; (this.healthBarBg.material as THREE.Material).dispose()
    this.healthBarFill.geometry.dispose()
      ; (this.healthBarFill.material as THREE.Material).dispose()
  }
}
