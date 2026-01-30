import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import type { InputState } from './types'
import { ARENA_HALF_X, ARENA_HALF_Z, FLOOR_Y } from './types'

const PLAYER_RADIUS = 0.4
const PLAYER_HEIGHT = 1.2
const PLAYER_MASS = 80
const MOVE_FORCE = 120
const MAX_SPEED = 6
const BULLET_RADIUS = 0.15
const BULLET_SPEED = 32
const BULLET_MASS = 3
const SHOOT_COOLDOWN = 0.2

export interface BulletSpawn {
  body: CANNON.Body
  mesh: THREE.Mesh
  createdAt: number
}

export class Player {
  body: CANNON.Body
  mesh: THREE.Mesh
  /** Facing angle in radians (around Y). 0 = +Z, π/2 = +X. */
  facingAngle: number = 0
  private lastShootTime: number = 0
  private onShoot?: (spawn: BulletSpawn) => void

  constructor(world: CANNON.World, scene: THREE.Scene, position: { x: number; y: number; z: number }) {
    const shape = new CANNON.Cylinder(PLAYER_RADIUS, PLAYER_RADIUS, PLAYER_HEIGHT - 2 * PLAYER_RADIUS, 12)
    this.body = new CANNON.Body({
      mass: PLAYER_MASS,
      position: new CANNON.Vec3(position.x, position.y + PLAYER_HEIGHT / 2, position.z),
      shape,
      fixedRotation: true,
      linearDamping: 0.3,
    })
    world.addBody(this.body)

    const geometry = new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_HEIGHT - 2 * PLAYER_RADIUS, 4, 8)
    const material = new THREE.MeshStandardMaterial({ color: 0x2196f3 })
    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.mesh.position.copy(new THREE.Vector3(position.x, position.y + PLAYER_HEIGHT / 2, position.z))
    scene.add(this.mesh)
  }

  setOnShoot(callback: (spawn: BulletSpawn) => void) {
    this.onShoot = callback
  }

  updateInput(state: InputState, dt: number) {
    const vx = this.body.velocity.x
    const vz = this.body.velocity.z
    const speed = Math.sqrt(vx * vx + vz * vz)

    if (state.left) this.facingAngle += 2 * dt
    if (state.right) this.facingAngle -= 2 * dt

    const dx = Math.sin(this.facingAngle)
    const dz = Math.cos(this.facingAngle)
    if (state.up) {
      this.body.velocity.x += dx * MOVE_FORCE * dt
      this.body.velocity.z += dz * MOVE_FORCE * dt
    }
    if (state.down) {
      this.body.velocity.x -= dx * MOVE_FORCE * dt
      this.body.velocity.z -= dz * MOVE_FORCE * dt
    }

    if (speed > MAX_SPEED) {
      const scale = MAX_SPEED / speed
      this.body.velocity.x *= scale
      this.body.velocity.z *= scale
    }

    if (state.shoot && this.onShoot) {
      const now = performance.now() / 1000
      if (now - this.lastShootTime >= SHOOT_COOLDOWN) {
        this.lastShootTime = now
        this.spawnBullet()
      }
    }
  }

  private spawnBullet() {
    if (!this.onShoot) return
    const world = this.body.world
    if (!world) return
    const px = this.body.position.x
    const py = this.body.position.y
    const pz = this.body.position.z
    const dx = Math.sin(this.facingAngle)
    const dz = Math.cos(this.facingAngle)
    const bulletBody = new CANNON.Body({
      mass: BULLET_MASS,
      position: new CANNON.Vec3(px + dx * 0.6, py, pz + dz * 0.6),
      shape: new CANNON.Sphere(BULLET_RADIUS),
      velocity: new CANNON.Vec3(dx * BULLET_SPEED, 0, dz * BULLET_SPEED),
      linearDamping: 0,
      collisionFilterGroup: 2, // bullet group
      collisionFilterMask: 1 | 2, // collide with default (1) and other bullets (2)
    })
    world.addBody(bulletBody)
    const bulletMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BULLET_RADIUS, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffeb3b })
    )
    bulletMesh.castShadow = true
    bulletMesh.position.set(bulletBody.position.x, bulletBody.position.y, bulletBody.position.z)
    this.onShoot({ body: bulletBody, mesh: bulletMesh, createdAt: performance.now() })
  }

  /** Sync mesh from physics (call every frame). */
  syncMesh() {
    this.mesh.position.set(this.body.position.x, this.body.position.y, this.body.position.z)
    this.mesh.rotation.y = this.facingAngle
  }

  /** Clamp position to arena (called after physics step). */
  clampToArena() {
    const p = this.body.position
    const r = PLAYER_RADIUS
    if (p.x < -ARENA_HALF_X + r) this.body.position.x = -ARENA_HALF_X + r
    if (p.x > ARENA_HALF_X - r) this.body.position.x = ARENA_HALF_X - r
    if (p.z < -ARENA_HALF_Z + r) this.body.position.z = -ARENA_HALF_Z + r
    if (p.z > ARENA_HALF_Z - r) this.body.position.z = ARENA_HALF_Z - r
    if (p.y < FLOOR_Y + PLAYER_HEIGHT / 2) this.body.position.y = FLOOR_Y + PLAYER_HEIGHT / 2
  }

  dispose(scene: THREE.Scene, world: CANNON.World) {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
    world.removeBody(this.body)
  }
}
