import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { FLOOR_Y } from './types'
import type { BulletSpawn } from './Player'

const TURRET_BODY_RADIUS = 0.9
const TURRET_BODY_HEIGHT = 1.2
const TURRET_SHOOT_INTERVAL = 3
const TURRET_BULLET_RADIUS = 0.15
const TURRET_BULLET_SPEED = 24
const TURRET_BULLET_MASS = 3
const TURRET_MAX_HEALTH = 3
const HEALTH_BAR_WIDTH = 1.2
const HEALTH_BAR_HEIGHT = 0.12
const HEALTH_BAR_Y_OFFSET = 1.8
const CANNON_TOP_NAME = 'Turret_Cannon_Top'

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
    this.body = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(px, FLOOR_Y + halfH, pz),
      shape: new CANNON.Cylinder(TURRET_BODY_RADIUS, TURRET_BODY_RADIUS, TURRET_BODY_HEIGHT, 12),
      collisionFilterGroup: 4,
      collisionFilterMask: 2,
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
    placeholder.position.set(px, FLOOR_Y, pz)
    this.mesh = placeholder
    scene.add(this.mesh)

    this.healthBarContainer = new THREE.Group()
    this.healthBarContainer.position.set(px, FLOOR_Y + HEALTH_BAR_Y_OFFSET, pz)
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
          model.position.set(px, FLOOR_Y + TURRET_BODY_HEIGHT / 2, pz)
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

  /** Point cannon at target (x, z in world). Rotate around Z so the barrel stays horizontal. */
  aimAt(targetX: number, targetZ: number) {
    if (!this.cannonTop) return
    const p = this.body.position
    const dx = targetX - p.x
    const dz = targetZ - p.z
    const angle = Math.atan2(dx, dz)
    this.cannonTop.rotation.z = -angle
  }

  /** Update: aim at player and shoot on interval. */
  update(dt: number, playerPosition: { x: number; z: number }) {
    this.aimAt(playerPosition.x, playerPosition.z)
    this.lastShootTime += dt
    if (this.lastShootTime >= TURRET_SHOOT_INTERVAL && this.onShoot) {
      this.lastShootTime = 0
      const p = this.body.position
      const dx = playerPosition.x - p.x
      const dz = playerPosition.z - p.z
      const len = Math.sqrt(dx * dx + dz * dz) || 1
      this.spawnBulletInDirection(dx / len, dz / len)
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
