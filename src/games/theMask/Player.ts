import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import type { InputState } from './types'
import { ARENA_HALF_X, ARENA_HALF_Z, FLOOR_Y } from './types'

const PLAYER_RADIUS = 0.4
export const PLAYER_HEIGHT = 1.2
const PLAYER_MASS = 80
const MOVE_FORCE = 22
const MAX_SPEED = 4
const MOVE_SPEED_THRESHOLD = 0.3
const BULLET_RADIUS = 0.15
const BULLET_SPEED = 32
const BULLET_MASS = 3
const DEFAULT_SHOOT_COOLDOWN = 0.2

export interface BulletSpawn {
  body: CANNON.Body
  mesh: THREE.Mesh
  createdAt: number
}

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      child.geometry.dispose()
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose())
      else if (child.material) child.material.dispose()
    }
  })
}

export class Player {
  body: CANNON.Body
  /** Visual representation (Mesh or Group from GLB). */
  mesh: THREE.Object3D
  /** Facing angle in radians (around Y). 0 = +Z, π/2 = +X. */
  facingAngle: number = 0
  private lastShootTime: number = 0
  private shootCooldown: number = DEFAULT_SHOOT_COOLDOWN
  private onShoot?: (spawn: BulletSpawn) => void
  private scene: THREE.Scene
  private isCapsulePlaceholder = false
  private mixer: THREE.AnimationMixer | null = null
  private idleAction: THREE.AnimationAction | null = null
  private runAction: THREE.AnimationAction | null = null
  private currentAction: 'idle' | 'run' = 'idle'

  constructor(
    world: CANNON.World,
    scene: THREE.Scene,
    position: { x: number; y: number; z: number },
    options?: { shootCooldown?: number }
  ) {
    this.scene = scene
    if (options?.shootCooldown != null) this.shootCooldown = options.shootCooldown
    const shape = new CANNON.Cylinder(PLAYER_RADIUS, PLAYER_RADIUS, PLAYER_HEIGHT - 2 * PLAYER_RADIUS, 12)
    this.body = new CANNON.Body({
      mass: PLAYER_MASS,
      position: new CANNON.Vec3(position.x, position.y + PLAYER_HEIGHT / 2, position.z),
      shape,
      fixedRotation: true,
      linearDamping: 2.8,
    })
    world.addBody(this.body)

    const geometry = new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_HEIGHT - 2 * PLAYER_RADIUS, 4, 8)
    const material = new THREE.MeshStandardMaterial({ color: 0x2196f3 })
    const placeholder = new THREE.Mesh(geometry, material)
    placeholder.castShadow = true
    placeholder.receiveShadow = true
    placeholder.position.copy(new THREE.Vector3(position.x, position.y + PLAYER_HEIGHT / 2, position.z))
    this.mesh = placeholder
    this.isCapsulePlaceholder = true
    scene.add(this.mesh)
  }

  /** Replace the current visual with a loaded model (e.g. GLB). Optionally pass animations for idle/run. */
  replaceVisual(model: THREE.Object3D, animations?: THREE.AnimationClip[]) {
    this.scene.remove(this.mesh)
    if (this.isCapsulePlaceholder && this.mesh instanceof THREE.Mesh) {
      this.mesh.geometry.dispose()
      ;(this.mesh.material as THREE.Material).dispose()
    } else {
      disposeObject3D(this.mesh)
    }
    this.mixer = null
    this.idleAction = null
    this.runAction = null

    this.mesh = model
    this.isCapsulePlaceholder = false
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    this.scene.add(this.mesh)

    if (animations && animations.length > 0) {
      const mixerRoot =
        (model.getObjectByName('CharacterArmature') as THREE.Object3D) || model
      this.mixer = new THREE.AnimationMixer(mixerRoot)
      const idleClip = animations.find(
        (c) =>
          c.name === 'Idle' ||
          c.name.endsWith('|Idle') ||
          (c.name.toLowerCase().includes('idle') && !c.name.toLowerCase().includes('idle_gun'))
      ) ?? animations.find((c) => c.name.toLowerCase().includes('idle'))
      const runClip =
        animations.find((c) => c.name.includes('Run_Gun') || c.name.endsWith('|Run_Gun')) ??
        animations.find((c) => c.name.toLowerCase().includes('run'))
      if (idleClip) {
        this.idleAction = this.mixer.clipAction(idleClip)
        this.idleAction.setLoop(THREE.LoopRepeat, Infinity)
        this.idleAction.play()
        this.idleAction.setEffectiveWeight(1)
      }
      if (runClip) {
        this.runAction = this.mixer.clipAction(runClip)
        this.runAction.setLoop(THREE.LoopRepeat, Infinity)
        this.runAction.play()
        this.runAction.setEffectiveWeight(0)
      }
      this.currentAction = 'idle'
    }
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

    this.tryShoot(state.shoot)
  }

  /**
   * Camera-relative movement from joystick; aim joystick = shoot direction (world XZ).
   * When shoot is true and aimWorld is non-zero, shoot in that direction.
   */
  updateInputFromTouch(
    worldMoveX: number,
    worldMoveZ: number,
    aimWorldX: number,
    aimWorldZ: number,
    shoot: boolean,
    dt: number
  ) {
    const len = Math.sqrt(worldMoveX * worldMoveX + worldMoveZ * worldMoveZ)
    const aimLen = Math.sqrt(aimWorldX * aimWorldX + aimWorldZ * aimWorldZ)
    if (aimLen > 0.01) this.facingAngle = Math.atan2(aimWorldX, aimWorldZ)
    if (len > 0.01) {
      const nx = worldMoveX / len
      const nz = worldMoveZ / len
      if (aimLen <= 0.01) this.facingAngle = Math.atan2(nx, nz)
      this.body.velocity.x += nx * MOVE_FORCE * dt
      this.body.velocity.z += nz * MOVE_FORCE * dt
    }
    const vx = this.body.velocity.x
    const vz = this.body.velocity.z
    const speed = Math.sqrt(vx * vx + vz * vz)
    if (speed > MAX_SPEED) {
      const scale = MAX_SPEED / speed
      this.body.velocity.x *= scale
      this.body.velocity.z *= scale
    }
    if (shoot) {
      const aimLen = Math.sqrt(aimWorldX * aimWorldX + aimWorldZ * aimWorldZ)
      if (aimLen > 0.01) {
        this.shootInDirection(aimWorldX / aimLen, aimWorldZ / aimLen)
      } else {
        this.tryShoot(true)
      }
    }
  }

  /** Shoot a bullet in the given world XZ direction (normalized). */
  shootInDirection(worldX: number, worldZ: number) {
    if (!this.onShoot) return
    const now = performance.now() / 1000
    if (now - this.lastShootTime < this.shootCooldown) return
    this.lastShootTime = now
    this.spawnBulletInDirection(worldX, worldZ)
  }

  private tryShoot(wantShoot: boolean) {
    if (!wantShoot || !this.onShoot) return
    const now = performance.now() / 1000
    if (now - this.lastShootTime >= this.shootCooldown) {
      this.lastShootTime = now
      this.spawnBullet()
    }
  }

  private spawnBullet() {
    const dx = Math.sin(this.facingAngle)
    const dz = Math.cos(this.facingAngle)
    this.spawnBulletInDirection(dx, dz)
  }

  private spawnBulletInDirection(dx: number, dz: number) {
    if (!this.onShoot) return
    const world = this.body.world
    if (!world) return
    const px = this.body.position.x
    const py = this.body.position.y
    const pz = this.body.position.z
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

  /** Sync visual from physics (call every frame). */
  syncMesh() {
    this.mesh.position.set(this.body.position.x, this.body.position.y, this.body.position.z)
    this.mesh.rotation.y = this.facingAngle
  }

  /** Update animation mixer and switch idle/run based on velocity. Call every frame. */
  updateAnimation(dt: number) {
    if (!this.mixer) return
    this.mixer.update(dt)

    const vx = this.body.velocity.x
    const vz = this.body.velocity.z
    const speed = Math.sqrt(vx * vx + vz * vz)
    const wantRun = speed > MOVE_SPEED_THRESHOLD

    if (wantRun && this.currentAction === 'idle' && this.runAction && this.idleAction) {
      this.idleAction.stop()
      this.idleAction.setEffectiveWeight(0)
      this.runAction.reset().play()
      this.runAction.setEffectiveWeight(1)
      this.currentAction = 'run'
    } else if (!wantRun && this.currentAction === 'run' && this.runAction && this.idleAction) {
      this.runAction.stop()
      this.runAction.setEffectiveWeight(0)
      this.idleAction.reset().play()
      this.idleAction.setEffectiveWeight(1)
      this.currentAction = 'idle'
    }
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
    if (this.isCapsulePlaceholder && this.mesh instanceof THREE.Mesh) {
      this.mesh.geometry.dispose()
      ;(this.mesh.material as THREE.Material).dispose()
    } else {
      disposeObject3D(this.mesh)
    }
    this.mixer = null
    this.idleAction = null
    this.runAction = null
    world.removeBody(this.body)
  }
}
