import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import type { InputState } from './types'
import { ARENA_HALF_X, ARENA_HALF_Z, FLOOR_Y } from './types'

export const PLAYER_RADIUS = 0.4
export const PLAYER_HEIGHT = 1.2
/** Lower GLB model by this much so feet sit on floor (tune if model floats or sinks). */
const PLAYER_GLB_FLOOR_OFFSET = 0.52
const PLAYER_MASS = 80
/** Single source of truth for player max health; use this constant anywhere max health is needed. */
export const PLAYER_MAX_HEALTH = 100
export const PLAYER_DAMAGE_PER_HIT = 10
const PLAYER_HEALTH_BAR_WIDTH = 0.5
const PLAYER_HEALTH_BAR_HEIGHT = 0.1
/** Offset above player center (body.position.y). */
const PLAYER_HEALTH_BAR_Y_OFFSET = 0.9
/** Fixed rotation around Y (radians) so the bar is visible from the camera; 0 = along X, π/4 = diagonal. */
const PLAYER_HEALTH_BAR_Y_ROTATION = Math.PI / 4
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
  /** true = player bullet (damages turrets), false = enemy bullet */
  fromPlayer?: boolean
  /** Optional collision handler; remove in dispose to avoid leaks. */
  collisionHandler?: (e: { body: CANNON.Body }) => void
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
  /** Facing angle in radians (around Y). 0 = +Z, π = -Z (start facing opposite). */
  facingAngle: number = Math.PI
  private lastShootTime: number = 0
  private shootCooldown: number = DEFAULT_SHOOT_COOLDOWN
  private onShoot?: (spawn: BulletSpawn) => void
  private scene: THREE.Scene
  private mixer: THREE.AnimationMixer | null = null
  private idleAction: THREE.AnimationAction | null = null
  private runAction: THREE.AnimationAction | null = null
  private hitAction: THREE.AnimationAction | null = null
  private waveAction: THREE.AnimationAction | null = null
  private deathAction: THREE.AnimationAction | null = null
  private currentAction: 'idle' | 'run' | 'hit' | 'wave' | 'death' = 'idle'
  private _health = PLAYER_MAX_HEALTH
  private _maxHealth = PLAYER_MAX_HEALTH
  private healthBarContainer: THREE.Group
  private healthBarBg: THREE.Mesh
  private healthBarFill: THREE.Mesh

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
      linearDamping: 0.85,
      collisionFilterGroup: 1,
      collisionFilterMask: 1 | 2 | 4 | 8, // default (1), bullets (2), turrets (4), rolies (8)
    })
    world.addBody(this.body)

    this.mesh = new THREE.Group()
    this.mesh.position.set(position.x, position.y + PLAYER_HEIGHT / 2, position.z)
    scene.add(this.mesh)

    this.healthBarContainer = new THREE.Group()
    this.healthBarContainer.rotation.x = -Math.PI / 4
    this.healthBarContainer.rotation.y = PLAYER_HEALTH_BAR_Y_ROTATION
    const bgGeo = new THREE.PlaneGeometry(PLAYER_HEALTH_BAR_WIDTH, PLAYER_HEALTH_BAR_HEIGHT)
    this.healthBarBg = new THREE.Mesh(bgGeo, new THREE.MeshBasicMaterial({ color: 0x333333 }))
    this.healthBarBg.position.z = 0.01
    this.healthBarContainer.add(this.healthBarBg)
    const fillGeo = new THREE.PlaneGeometry(PLAYER_HEALTH_BAR_WIDTH - 0.04, PLAYER_HEALTH_BAR_HEIGHT - 0.04)
    this.healthBarFill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: 0x4caf50 }))
    this.healthBarFill.position.z = 0.02
    this.healthBarFill.scale.x = 1
    this.healthBarContainer.add(this.healthBarFill)
    scene.add(this.healthBarContainer)
  }

  /** Replace the current visual with a loaded model (e.g. GLB). Optionally pass animations for idle/run. */
  replaceVisual(model: THREE.Object3D, animations?: THREE.AnimationClip[]) {
    this.scene.remove(this.mesh)
    disposeObject3D(this.mesh)
    this.mixer = null
    this.idleAction = null
    this.runAction = null
    this.hitAction = null
    this.waveAction = null
    this.deathAction = null

    this.mesh = model
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
      const hitClip =
        animations.find((c) => c.name === 'HitReact' || c.name.endsWith('|HitReact')) ??
        animations.find((c) => c.name.toLowerCase().includes('hit'))
      if (hitClip) {
        this.hitAction = this.mixer.clipAction(hitClip)
        this.hitAction.setLoop(THREE.LoopOnce, 1)
        this.hitAction.clampWhenFinished = true
        this.hitAction.setEffectiveWeight(0)
        this.mixer.addEventListener('finished', this.onHitFinished)
      }
      const waveClip =
        animations.find((c) => c.name === 'CharacterArmature|Wave' || c.name === 'Wave' || c.name.endsWith('|Wave')) ??
        animations.find((c) => c.name.toLowerCase().includes('wave'))
      if (waveClip) {
        this.waveAction = this.mixer.clipAction(waveClip)
        this.waveAction.setLoop(THREE.LoopOnce, 1)
        this.waveAction.clampWhenFinished = true
        this.waveAction.setEffectiveWeight(0)
        this.mixer.addEventListener('finished', this.onWaveFinished)
      }
      const deathClip =
        animations.find((c) => c.name === 'CharacterArmature|Death' || c.name === 'Death' || c.name.endsWith('|Death')) ??
        animations.find((c) => c.name.toLowerCase().includes('death'))
      if (deathClip) {
        this.deathAction = this.mixer.clipAction(deathClip)
        this.deathAction.setLoop(THREE.LoopOnce, 1)
        this.deathAction.clampWhenFinished = true
        this.deathAction.setEffectiveWeight(0)
        this.mixer.addEventListener('finished', this.onDeathFinished)
      }
      this.currentAction = 'idle'
    }
  }

  getHealth(): number {
    return this._health
  }

  getMaxHealth(): number {
    return this._maxHealth
  }

  /** Reset health to max (e.g. on new level). */
  resetHealth() {
    this._health = this._maxHealth
  }

  /**
   * Apply damage. Returns new health after damage.
   * Does not play hit react or death; caller should check health and play animations.
   */
  takeDamage(amount: number): number {
    this._health = Math.max(0, this._health - amount)
    return this._health
  }

  /** Heal the player by the given amount, capped at max health. Returns new health. */
  heal(amount: number): number {
    this._health = Math.min(this._maxHealth, this._health + amount)
    return this._health
  }

  isDead(): boolean {
    return this._health <= 0
  }

  isPlayingDeath(): boolean {
    return this.currentAction === 'death'
  }

  /** Play death animation once; calls onComplete when finished (or immediately if no death clip). */
  playDeath(onComplete: () => void) {
    this.currentAction = 'death'
    if (this.idleAction) this.idleAction.setEffectiveWeight(0)
    if (this.runAction) this.runAction.setEffectiveWeight(0)
    if (this.hitAction) this.hitAction.setEffectiveWeight(0)
    if (this.waveAction) this.waveAction.setEffectiveWeight(0)
    if (this.deathAction) {
      this._deathOnComplete = onComplete
      this.deathAction.reset().play()
      this.deathAction.setEffectiveWeight(1)
    } else {
      onComplete()
    }
  }

  private _deathOnComplete: (() => void) | null = null

  private onDeathFinished = (e: { action: THREE.AnimationAction }) => {
    if (e.action !== this.deathAction) return
    this.deathAction?.setEffectiveWeight(0)
    const cb = this._deathOnComplete
    this._deathOnComplete = null
    cb?.()
  }

  /** Play Wave animation (e.g. level intro). */
  playWave() {
    if (!this.mixer || !this.waveAction) return
    this.currentAction = 'wave'
    if (this.idleAction) this.idleAction.setEffectiveWeight(0)
    if (this.runAction) this.runAction.setEffectiveWeight(0)
    this.waveAction.reset().play()
    this.waveAction.setEffectiveWeight(1)
  }

  /** Stop Wave and return to idle (call when level intro camera ends). */
  stopWave() {
    if (!this.waveAction) return
    this.waveAction.setEffectiveWeight(0)
    this.currentAction = 'idle'
    if (this.idleAction) {
      this.idleAction.reset().play()
      this.idleAction.setEffectiveWeight(1)
    }
    if (this.runAction) this.runAction.setEffectiveWeight(0)
  }

  private onHitFinished = (e: { action: THREE.AnimationAction }) => {
    if (e.action !== this.hitAction) return
    this.hitAction?.setEffectiveWeight(0)
    this.currentAction = 'idle'
    if (this.idleAction) {
      this.idleAction.reset().play()
      this.idleAction.setEffectiveWeight(1)
    }
    if (this.runAction) this.runAction.setEffectiveWeight(0)
  }

  private onWaveFinished = (e: { action: THREE.AnimationAction }) => {
    if (e.action !== this.waveAction) return
    this.stopWave()
  }

  /** Play hit reaction animation (e.g. when hit by turret bullet). */
  playHitReact() {
    if (!this.mixer || !this.hitAction) return
    if (this.currentAction === 'hit') return
    this.currentAction = 'hit'
    if (this.idleAction) this.idleAction.setEffectiveWeight(0)
    if (this.runAction) this.runAction.setEffectiveWeight(0)
    this.hitAction.reset().play()
    this.hitAction.setEffectiveWeight(1)
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
      collisionFilterMask: 1 | 2 | 4 | 8, // default (1), bullets (2), turrets (4), rolies (8)
    })
    world.addBody(bulletBody)
    const bulletMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BULLET_RADIUS, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffeb3b })
    )
    bulletMesh.castShadow = true
    bulletMesh.position.set(bulletBody.position.x, bulletBody.position.y, bulletBody.position.z)
    this.onShoot({ body: bulletBody, mesh: bulletMesh, createdAt: performance.now(), fromPlayer: true })
  }

  /** Sync visual from physics (call every frame). */
  syncMesh() {
    this.mesh.position.set(this.body.position.x, this.body.position.y, this.body.position.z)
    // GLB origin is at character center; lower so feet sit on floor (not floating).
    if (this.mesh.children.length > 0) {
      this.mesh.position.y = this.body.position.y - PLAYER_GLB_FLOOR_OFFSET
    }
    this.mesh.rotation.y = this.facingAngle

    this.healthBarContainer.position.set(
      this.body.position.x,
      this.body.position.y + PLAYER_HEALTH_BAR_Y_OFFSET,
      this.body.position.z
    )
    this.updateHealthBar()
  }

  private updateHealthBar() {
    const ratio = Math.max(0, this._health / this._maxHealth)
    this.healthBarFill.scale.x = ratio
    this.healthBarFill.position.x = -(1 - ratio) * (PLAYER_HEALTH_BAR_WIDTH - 0.04) / 2
      ; (this.healthBarFill.material as THREE.MeshBasicMaterial).color.setHex(
        ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xff9800 : 0xf44336
      )
  }

  /** Update animation mixer and switch idle/run based on velocity. Call every frame. */
  updateAnimation(dt: number) {
    if (!this.mixer) return
    this.mixer.update(dt)
    if (this.currentAction === 'hit' || this.currentAction === 'wave' || this.currentAction === 'death') return

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

  /** Clamp position to arena (called after physics step). Uses current level bounds when provided. */
  clampToArena(halfX: number = ARENA_HALF_X, halfZ: number = ARENA_HALF_Z) {
    const p = this.body.position
    const r = PLAYER_RADIUS
    if (p.x < -halfX + r) this.body.position.x = -halfX + r
    if (p.x > halfX - r) this.body.position.x = halfX - r
    if (p.z < -halfZ + r) this.body.position.z = -halfZ + r
    if (p.z > halfZ - r) this.body.position.z = halfZ - r
    if (p.y < FLOOR_Y + PLAYER_HEIGHT / 2) this.body.position.y = FLOOR_Y + PLAYER_HEIGHT / 2
  }

  dispose(scene: THREE.Scene, world: CANNON.World) {
    scene.remove(this.healthBarContainer)
    this.healthBarBg.geometry.dispose()
      ; (this.healthBarBg.material as THREE.Material).dispose()
    this.healthBarFill.geometry.dispose()
      ; (this.healthBarFill.material as THREE.Material).dispose()
    scene.remove(this.mesh)
    disposeObject3D(this.mesh)
    if (this.mixer) {
      this.mixer.removeEventListener('finished', this.onHitFinished)
      this.mixer.removeEventListener('finished', this.onWaveFinished)
      this.mixer.removeEventListener('finished', this.onDeathFinished)
    }
    this.mixer = null
    this.idleAction = null
    this.runAction = null
    this.hitAction = null
    this.waveAction = null
    this.deathAction = null
    world.removeBody(this.body)
  }
}
