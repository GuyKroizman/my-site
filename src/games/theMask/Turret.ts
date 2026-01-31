import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { FLOOR_Y } from './types'
import type { BulletSpawn } from './Player'

const TURRET_BODY_RADIUS = 0.9
const TURRET_BODY_HEIGHT = 1.2
const TURRET_SHOOT_INTERVAL = 3
/** Only shoot when player is within this distance (units). */
const TURRET_SHOOT_RANGE = 15
/** Radians per second: how fast the cannon rotates toward the player. */
const TURRET_ROTATION_SPEED = 0.3
const TURRET_BULLET_RADIUS = 0.15
const TURRET_BULLET_SPEED = 24
const TURRET_BULLET_MASS = 3
const TURRET_MAX_HEALTH = 3
const HEALTH_BAR_WIDTH = 1.2
const HEALTH_BAR_HEIGHT = 0.12
const HEALTH_BAR_Y_OFFSET = 1.8
const CANNON_TOP_NAME = 'Turret_Cannon_Top'
/** Lower turret so it sits on the ground (model may have been authored floating). */
const TURRET_Y_OFFSET = -0.4

export interface TurretOptions {
  onShoot?: (spawn: BulletSpawn) => void
}

export class Turret {
  body: CANNON.Body
  /** Root mesh (group from GLB or placeholder). */
  mesh: THREE.Object3D
  /** Cannon top node to rotate toward player. */
  cannonTop: THREE.Object3D | null = null
  health = TURRET_MAX_HEALTH
  readonly maxHealth = TURRET_MAX_HEALTH
  private world: CANNON.World
  private scene: THREE.Scene
  private onShoot?: (spawn: BulletSpawn) => void
  private lastShootTime = 0
  private healthBarBg: THREE.Mesh
  private healthBarFill: THREE.Mesh
  private healthBarContainer: THREE.Group
  /** Stores the cannon's current aim angle for bullet direction. */
  private cannonAimAngle = 0
  /** Base Y position (FLOOR_Y + TURRET_Y_OFFSET) for visuals. */
  private readonly baseY: number

  constructor(
    world: CANNON.World,
    scene: THREE.Scene,
    position: { x: number; z: number },
    options?: TurretOptions
  ) {
    this.world = world
    this.scene = scene
    this.onShoot = options?.onShoot

    const px = position.x
    const pz = position.z
    const halfH = TURRET_BODY_HEIGHT / 2
    this.baseY = FLOOR_Y + TURRET_Y_OFFSET
    this.body = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(px, this.baseY + halfH, pz),
      shape: new CANNON.Cylinder(TURRET_BODY_RADIUS, TURRET_BODY_RADIUS, TURRET_BODY_HEIGHT, 12),
      collisionFilterGroup: 4,
      collisionFilterMask: 1 | 2, // 1 = player (solid), 2 = bullets
    })
    ;(this.body as unknown as { turretRef?: Turret }).turretRef = this
    world.addBody(this.body)

    const placeholder = new THREE.Group()
    const geo = new THREE.CylinderGeometry(TURRET_BODY_RADIUS, TURRET_BODY_RADIUS, TURRET_BODY_HEIGHT, 12)
    const mat = new THREE.MeshStandardMaterial({ color: 0x455a64 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.y = halfH
    mesh.castShadow = true
    mesh.receiveShadow = true
    placeholder.add(mesh)
    placeholder.position.set(px, this.baseY, pz)
    this.mesh = placeholder
    scene.add(this.mesh)

    this.healthBarContainer = new THREE.Group()
    this.healthBarContainer.position.set(px, this.baseY + HEALTH_BAR_Y_OFFSET, pz)
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

    this.loadModel(px, pz)
  }

  private loadModel(px: number, pz: number) {
    import('three/examples/jsm/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
      const loader = new GLTFLoader()
      loader.load(
        '/theMask/models/turret_cannon.glb',
        (gltf) => {
          this.scene.remove(this.mesh)
          const model = gltf.scene
          const box = new THREE.Box3().setFromObject(model)
          const size = new THREE.Vector3()
          box.getSize(size)
          const center = new THREE.Vector3()
          box.getCenter(center)
          model.position.sub(center)
          const scale = TURRET_BODY_HEIGHT / Math.max(size.y, 0.001)
          model.scale.setScalar(scale)
          model.position.set(px, this.baseY + TURRET_BODY_HEIGHT / 2, pz)
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true
              child.receiveShadow = true
            }
          })
          const top = model.getObjectByName(CANNON_TOP_NAME)
          if (top) {
            this.cannonTop = top
          }
          this.mesh = model
          this.scene.add(this.mesh)
        },
        undefined,
        (err) => console.warn('Failed to load turret_cannon.glb', err)
      )
    })
  }

  /** Gradually rotate cannon toward target (x, z in world) at limited speed. */
  aimAt(targetX: number, targetZ: number, dt: number) {
    const p = this.body.position
    const dx = targetX - p.x
    const dz = targetZ - p.z
    const targetAngle = Math.atan2(dx, dz)

    // Compute shortest angular difference
    let diff = targetAngle - this.cannonAimAngle
    while (diff > Math.PI) diff -= 2 * Math.PI
    while (diff < -Math.PI) diff += 2 * Math.PI

    // Clamp rotation step to max speed
    const maxStep = TURRET_ROTATION_SPEED * dt
    const step = Math.max(-maxStep, Math.min(maxStep, diff))
    this.cannonAimAngle += step

    // Apply to cannon visual if loaded
    if (this.cannonTop) {
      this.cannonTop.rotation.z = this.cannonAimAngle
    }
  }

  /** Get the direction the cannon is currently pointing based on tracked angle. */
  private getCannonAimDirection(): { dx: number; dz: number } {
    // Bullet goes toward where cannon points
    const dx = Math.sin(this.cannonAimAngle)
    const dz = Math.cos(this.cannonAimAngle)
    return { dx, dz }
  }

  /** Update: aim at player; shoot in cannon direction when player is within range. */
  update(dt: number, playerPosition: { x: number; z: number }) {
    // Get current aim direction BEFORE rotating toward player
    const aimBeforeUpdate = this.getCannonAimDirection()

    // Now rotate cannon toward player
    this.aimAt(playerPosition.x, playerPosition.z, dt)
    this.lastShootTime += dt

    const p = this.body.position
    const toPlayerX = playerPosition.x - p.x
    const toPlayerZ = playerPosition.z - p.z
    const distToPlayer = Math.sqrt(toPlayerX * toPlayerX + toPlayerZ * toPlayerZ)

    if (distToPlayer <= TURRET_SHOOT_RANGE && this.lastShootTime >= TURRET_SHOOT_INTERVAL && this.onShoot) {
      this.lastShootTime = 0
      // Use the direction from BEFORE the rotation update
      this.spawnBulletInDirection(aimBeforeUpdate.dx, aimBeforeUpdate.dz)
    }
    this.updateHealthBar()
  }

  private updateHealthBar() {
    const ratio = Math.max(0, this.health / this.maxHealth)
    this.healthBarFill.scale.x = ratio
    this.healthBarFill.position.x = -(1 - ratio) * (HEALTH_BAR_WIDTH - 0.04) / 2
    ;(this.healthBarFill.material as THREE.MeshBasicMaterial).color.setHex(
      ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xff9800 : 0xf44336
    )
  }

  private spawnBulletInDirection(dx: number, dz: number) {
    const p = this.body.position
    const bulletBody = new CANNON.Body({
      mass: TURRET_BULLET_MASS,
      // Spawn bullet at barrel tip (offset in aim direction)
      position: new CANNON.Vec3(p.x + dx * 0.6, p.y, p.z + dz * 0.6),
      shape: new CANNON.Sphere(TURRET_BULLET_RADIUS),
      velocity: new CANNON.Vec3(dx * TURRET_BULLET_SPEED, 0, dz * TURRET_BULLET_SPEED),
      linearDamping: 0,
      collisionFilterGroup: 2,
      collisionFilterMask: 1 | 2,
    })
    this.world.addBody(bulletBody)
    const bulletMesh = new THREE.Mesh(
      new THREE.SphereGeometry(TURRET_BULLET_RADIUS, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xe53935 })
    )
    bulletMesh.castShadow = true
    bulletMesh.position.set(bulletBody.position.x, bulletBody.position.y, bulletBody.position.z)
    this.onShoot?.({
      body: bulletBody,
      mesh: bulletMesh,
      createdAt: performance.now(),
      fromPlayer: false,
    })
  }

  takeDamage(amount: number) {
    this.health = Math.max(0, this.health - amount)
  }

  isAlive(): boolean {
    return this.health > 0
  }

  dispose(scene: THREE.Scene, world: CANNON.World) {
    world.removeBody(this.body)
    scene.remove(this.mesh)
    if (this.mesh instanceof THREE.Group) {
      this.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose()
          if (child.material) (child.material as THREE.Material).dispose()
        }
      })
    }
    scene.remove(this.healthBarContainer)
    this.healthBarBg.geometry.dispose()
    ;(this.healthBarBg.material as THREE.Material).dispose()
    this.healthBarFill.geometry.dispose()
    ;(this.healthBarFill.material as THREE.Material).dispose()
  }
}
