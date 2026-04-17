import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { InputManager } from './InputManager'
import { ShotSound } from './ShotSound'
import {
  GROUND_SIZE,
  PLAYER_HEIGHT,
  PLAYER_MASS,
  PLAYER_SPEED,
  PHYSICS_DT,
  PHYSICS_SUBSTEPS,
  PROJECTILE_RADIUS,
  PROJECTILE_LENGTH,
  PROJECTILE_LIFETIME,
  MAX_PROJECTILES,
  SHOOT_COOLDOWN,
  MOUSE_SENSITIVITY,
  GAMEPAD_LOOK_SPEED,
  PLAYER_MAX_HEALTH,
  GIANT_DAMAGE,
  GIANT_DAMAGE_COOLDOWN,
  CURRENT_WEAPON,
} from './types'
import type { Projectile } from './types'
import type { GamepadStatus } from './InputManager'
import { Giant } from './Giant'
import { AnimatedEnemy } from './AnimatedEnemy'
import { IdleBehavior, PatrolBehavior } from './enemyBehaviors'
import { roboEnemyConfig, robotEnemy2Config } from './enemyConfigs'

const UP = new THREE.Vector3(0, 1, 0)
const ROBOT_ENEMY_2_SELECTED = {
  x: -18,
  z: -24,
  visualScaleCorrection: 60,
  visualFootContactOffset: 85,
} as const

export interface TinyShooterEngineOptions {
  onPointerLockChange?: (locked: boolean) => void
  onHealthChange?: (health: number) => void
  onGamepadStatusChange?: (status: GamepadStatus) => void
}

export class TinyShooterEngine {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private world: CANNON.World
  private playerBody: CANNON.Body
  private input: InputManager
  private sound: ShotSound
  private projectiles: Projectile[] = []
  private yaw = 0
  private pitch = 0
  private lastShotTime = 0
  private animFrameId = 0
  private isDisposed = false
  private container: HTMLElement

  private readonly tmpDir = new THREE.Vector3()
  private readonly tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ')

  private projectileGeometry: THREE.CylinderGeometry
  private projectileMaterial: THREE.MeshStandardMaterial
  private giant: Giant
  private enemies: AnimatedEnemy[] = []
  private health = PLAYER_MAX_HEALTH
  private lastDamageTime = 0
  private damageOverlay: HTMLDivElement
  private onHealthChange?: (health: number) => void

  constructor(container: HTMLElement, options?: TinyShooterEngineOptions) {
    this.container = container

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x87ceeb)

    const aspect = container.clientWidth / container.clientHeight
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(this.renderer.domElement)

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(10, 20, 10)
    this.scene.add(dirLight)
    this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.3))

    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })

    this.setupGround()

    this.playerBody = new CANNON.Body({
      mass: PLAYER_MASS,
      shape: new CANNON.Sphere(0.4),
      position: new CANNON.Vec3(-10, PLAYER_HEIGHT / 2 + 0.4, -10),
      fixedRotation: true,
      linearDamping: 0.9,
    })
    this.world.addBody(this.playerBody)

    this.projectileGeometry = new THREE.CylinderGeometry(
      PROJECTILE_RADIUS,
      PROJECTILE_RADIUS,
      PROJECTILE_LENGTH,
      8
    )
    this.projectileMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xff8800, emissiveIntensity: 1.5 })

    this.giant = new Giant(this.world, this.scene, { x: 60, z: 60 })
    this.enemies = [
      new AnimatedEnemy(
        this.world,
        this.scene,
        { x: -10, z: -18 },
        roboEnemyConfig,
        new PatrolBehavior({ x: -10, z: -18 }, roboEnemyConfig.patrolDistance),
      ),
      new AnimatedEnemy(
        this.world,
        this.scene,
        { x: ROBOT_ENEMY_2_SELECTED.x, z: ROBOT_ENEMY_2_SELECTED.z },
        {
          ...robotEnemy2Config,
          model: {
            ...robotEnemy2Config.model,
            visualScaleCorrection: ROBOT_ENEMY_2_SELECTED.visualScaleCorrection,
            visualFootContactOffset: ROBOT_ENEMY_2_SELECTED.visualFootContactOffset,
          },
        },
        new IdleBehavior(),
      ),
    ]

    this.damageOverlay = document.createElement('div')
    this.damageOverlay.style.cssText =
      'position:absolute;inset:0;pointer-events:none;background:rgba(255,0,0,0);transition:background 0.05s;z-index:15;'
    container.appendChild(this.damageOverlay)

    this.onHealthChange = options?.onHealthChange

    this.input = new InputManager(this.renderer.domElement)
    this.input.onPointerLockChange = options?.onPointerLockChange
    this.input.onGamepadStatusChange = options?.onGamepadStatusChange

    this.sound = new ShotSound()

    window.addEventListener('resize', this.handleResize)

    this.animate()
  }

  private setupGround(): void {
    const groundBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
    })
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    this.world.addBody(groundBody)

    const floorGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE)
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333 })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = 0
    this.scene.add(floor)

    const grid = new THREE.GridHelper(GROUND_SIZE, GROUND_SIZE / 2, 0x555555, 0x444444)
    grid.position.y = 0.01
    this.scene.add(grid)
  }

  private handleResize = (): void => {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  private spawnProjectile(): void {
    if (this.projectiles.length >= MAX_PROJECTILES) {
      const oldest = this.projectiles.shift()!
      this.world.removeBody(oldest.body)
      this.scene.remove(oldest.mesh)
    }

    const dir = this.tmpDir.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize()

    const mesh = new THREE.Mesh(this.projectileGeometry, this.projectileMaterial)
    mesh.quaternion.setFromUnitVectors(UP, dir)
    const spawnPos = this.camera.position.clone().add(dir.clone().multiplyScalar(1.0))
    mesh.position.copy(spawnPos)
    this.scene.add(mesh)

    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Sphere(PROJECTILE_RADIUS),
      position: new CANNON.Vec3(spawnPos.x, spawnPos.y, spawnPos.z),
    })
    body.velocity.set(
      dir.x * CURRENT_WEAPON.projectileSpeed,
      dir.y * CURRENT_WEAPON.projectileSpeed,
      dir.z * CURRENT_WEAPON.projectileSpeed
    )
    this.world.addBody(body)

    this.projectiles.push({
      body,
      mesh,
      createdAt: performance.now(),
      damage: CURRENT_WEAPON.damage,
      knockback: CURRENT_WEAPON.knockback,
    })

    this.sound.play()
  }

  private updateProjectiles(): void {
    const now = performance.now()
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      const age = (now - p.createdAt) / 1000

      if (age > PROJECTILE_LIFETIME || p.body.position.y < -5) {
        this.world.removeBody(p.body)
        this.scene.remove(p.mesh)
        this.projectiles.splice(i, 1)
        continue
      }

      p.mesh.position.set(p.body.position.x, p.body.position.y, p.body.position.z)
    }
  }

  private animate = (): void => {
    if (this.isDisposed) return
    this.animFrameId = requestAnimationFrame(this.animate)
    this.input.update()

    if (this.input.isLocked()) {
      const { dx, dy } = this.input.consumeMouseDelta()
      this.yaw -= dx * MOUSE_SENSITIVITY
      this.pitch -= dy * MOUSE_SENSITIVITY
    }

    this.playerBody.velocity.x = 0
    this.playerBody.velocity.z = 0
    this.world.step(PHYSICS_DT, PHYSICS_DT, PHYSICS_SUBSTEPS)

    const inputState = this.input.getState()
    this.yaw -= inputState.lookX * GAMEPAD_LOOK_SPEED
    this.pitch -= inputState.lookY * GAMEPAD_LOOK_SPEED
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch))

    let moveX = inputState.moveX
    let moveZ = inputState.moveZ
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ)
    if (len > 0) {
      moveX /= len
      moveZ /= len

      const sinY = Math.sin(this.yaw)
      const cosY = Math.cos(this.yaw)
      const worldX = moveX * cosY + moveZ * sinY
      const worldZ = -moveX * sinY + moveZ * cosY

      this.playerBody.position.x += worldX * PLAYER_SPEED * PHYSICS_DT
      this.playerBody.position.z += worldZ * PLAYER_SPEED * PHYSICS_DT
    }

    this.camera.position.set(
      this.playerBody.position.x,
      this.playerBody.position.y + PLAYER_HEIGHT / 2,
      this.playerBody.position.z
    )
    this.tmpEuler.set(this.pitch, this.yaw, 0)
    this.camera.quaternion.setFromEuler(this.tmpEuler)

    if (inputState.shooting) {
      const now = performance.now() / 1000
      if (now - this.lastShotTime >= SHOOT_COOLDOWN) {
        this.lastShotTime = now
        this.spawnProjectile()
      }
    }

    this.updateProjectiles()
    this.giant.update(PHYSICS_DT, this.camera.position)
    for (const enemy of this.enemies) {
      enemy.update(PHYSICS_DT)
    }

    const hitSet = new Set<number>()
    if (!this.giant.dead) {
      for (const idx of this.giant.checkProjectileHits(this.projectiles)) {
        hitSet.add(idx)
      }
    }
    for (const enemy of this.enemies) {
      if (enemy.dead) continue
      for (const idx of enemy.checkProjectileHits(this.projectiles)) {
        hitSet.add(idx)
      }
    }
    if (hitSet.size > 0) {
      const sorted = [...hitSet].sort((a, b) => b - a)
      for (const idx of sorted) {
        const p = this.projectiles[idx]
        this.world.removeBody(p.body)
        this.scene.remove(p.mesh)
        this.projectiles.splice(idx, 1)
      }
    }

    // Giant collision with player
    if (!this.giant.dead) {
      const gdx = this.playerBody.position.x - this.giant.body.position.x
      const gdz = this.playerBody.position.z - this.giant.body.position.z
      const giantCollisionRadius = 4.0
      if (gdx * gdx + gdz * gdz < giantCollisionRadius * giantCollisionRadius) {
        const now = performance.now() / 1000
        if (now - this.lastDamageTime >= GIANT_DAMAGE_COOLDOWN) {
          this.lastDamageTime = now
          this.health = Math.max(0, this.health - GIANT_DAMAGE)
          this.onHealthChange?.(this.health)
          this.damageOverlay.style.background = 'rgba(255,0,0,0.4)'
          setTimeout(() => {
            this.damageOverlay.style.background = 'rgba(255,0,0,0)'
          }, 150)
        }
      }
    }

    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.isDisposed = true
    cancelAnimationFrame(this.animFrameId)
    window.removeEventListener('resize', this.handleResize)

    this.input.dispose()
    this.sound.dispose()

    this.giant.dispose(this.scene, this.world)
    for (const enemy of this.enemies) {
      enemy.dispose()
    }
    this.damageOverlay.remove()

    for (const p of this.projectiles) {
      this.world.removeBody(p.body)
      this.scene.remove(p.mesh)
    }
    this.projectiles.length = 0

    this.projectileGeometry.dispose()
    this.projectileMaterial.dispose()

    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement)
    }
    this.renderer.dispose()
  }
}
