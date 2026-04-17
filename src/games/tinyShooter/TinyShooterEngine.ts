import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { InputManager } from './InputManager'
import type { GamepadStatus } from './InputManager'
import { ShotSound } from './ShotSound'
import {
  GROUND_SIZE,
  PLAYER_BODY_RADIUS,
  PLAYER_HEIGHT,
  PLAYER_MASS,
  PLAYER_MAX_HEALTH,
  PLAYER_SPEED,
  PHYSICS_DT,
  PHYSICS_SUBSTEPS,
  PROJECTILE_LENGTH,
  PROJECTILE_LIFETIME,
  PROJECTILE_RADIUS,
  MAX_PROJECTILES,
  SHOOT_COOLDOWN,
  MOUSE_SENSITIVITY,
  GAMEPAD_LOOK_SPEED,
} from './constants'
import { DEFAULT_WEAPON } from './weapons'
import type { Projectile, TinyShooterGameState, TinyShooterPhase } from './gameTypes'
import type { LevelActor } from './actorTypes'
import type { LevelDefinition } from './levelTypes'
import { createLevelActor } from './actorFactory'
import { getFirstTinyShooterLevel, getLevelById } from './levels'

const UP = new THREE.Vector3(0, 1, 0)
const LEVEL_TRANSITION_DELAY_SECONDS = 1.4
const DAMAGE_FLASH_SECONDS = 0.15
const DEFAULT_GAMEPAD_STATUS: GamepadStatus = {
  connected: false,
  active: false,
  id: null,
}

export interface TinyShooterEngineOptions {
  initialLevelId?: string
  onStateChange?: (state: TinyShooterGameState) => void
}

export class TinyShooterEngine {
  private readonly container: HTMLElement
  private readonly onStateChange?: (state: TinyShooterGameState) => void
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly renderer: THREE.WebGLRenderer
  private readonly world: CANNON.World
  private readonly playerBody: CANNON.Body
  private readonly input: InputManager
  private readonly sound: ShotSound
  private readonly projectileGeometry: THREE.CylinderGeometry
  private readonly projectileMaterial: THREE.MeshStandardMaterial
  private readonly damageOverlay: HTMLDivElement
  private readonly tmpDir = new THREE.Vector3()
  private readonly tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ')
  private readonly playerPosition = new THREE.Vector3()

  private projectiles: Projectile[] = []
  private actors: LevelActor[] = []
  private currentLevel: LevelDefinition
  private phase: TinyShooterPhase = 'playing'
  private health = PLAYER_MAX_HEALTH
  private pointerLocked = false
  private gamepadStatus: GamepadStatus = DEFAULT_GAMEPAD_STATUS
  private lastShotTime = 0
  private lastDamageTime = 0
  private damageFlashUntil = 0
  private phaseChangedAt = performance.now()
  private yaw = 0
  private pitch = 0
  private animFrameId = 0
  private isDisposed = false

  constructor(container: HTMLElement, options: TinyShooterEngineOptions = {}) {
    this.container = container
    this.onStateChange = options.onStateChange
    this.currentLevel = options.initialLevelId
      ? getLevelById(options.initialLevelId)
      : getFirstTinyShooterLevel()

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x87ceeb)

    const aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1)
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1))
    container.appendChild(this.renderer.domElement)

    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })
    this.setupScene()

    this.playerBody = new CANNON.Body({
      mass: PLAYER_MASS,
      shape: new CANNON.Sphere(PLAYER_BODY_RADIUS),
      position: new CANNON.Vec3(0, PLAYER_HEIGHT / 2 + PLAYER_BODY_RADIUS, 0),
      fixedRotation: true,
      linearDamping: 0.9,
    })
    this.world.addBody(this.playerBody)

    this.projectileGeometry = new THREE.CylinderGeometry(
      PROJECTILE_RADIUS,
      PROJECTILE_RADIUS,
      PROJECTILE_LENGTH,
      8,
    )
    this.projectileMaterial = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      emissive: 0xff8800,
      emissiveIntensity: 1.5,
    })

    this.damageOverlay = document.createElement('div')
    this.damageOverlay.style.cssText =
      'position:absolute;inset:0;pointer-events:none;background:rgba(255,0,0,0);transition:background 0.05s;z-index:15;'
    container.appendChild(this.damageOverlay)

    this.input = new InputManager(this.renderer.domElement)
    this.input.onPointerLockChange = (locked) => {
      this.pointerLocked = locked
      this.emitState()
    }
    this.input.onGamepadStatusChange = (status) => {
      this.gamepadStatus = status
      this.emitState()
    }

    this.sound = new ShotSound()

    this.loadLevel(this.currentLevel, true)
    window.addEventListener('resize', this.handleResize)
    this.emitState()
    this.animate()
  }

  private setupScene(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6))

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(10, 20, 10)
    this.scene.add(dirLight)

    this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.3))

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
    this.scene.add(floor)

    const grid = new THREE.GridHelper(GROUND_SIZE, GROUND_SIZE / 2, 0x555555, 0x444444)
    grid.position.y = 0.01
    this.scene.add(grid)
  }

  private handleResize = (): void => {
    const width = Math.max(this.container.clientWidth, 1)
    const height = Math.max(this.container.clientHeight, 1)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  private emitState(): void {
    this.onStateChange?.({
      phase: this.phase,
      health: this.health,
      pointerLocked: this.pointerLocked,
      gamepadStatus: this.gamepadStatus,
      currentLevelId: this.currentLevel.id,
      currentLevelName: this.currentLevel.name,
      levelComplete: this.phase === 'level-complete',
      victory: this.phase === 'victory',
    })
  }

  private setPhase(phase: TinyShooterPhase): void {
    if (this.phase === phase) return

    this.phase = phase
    this.phaseChangedAt = performance.now()
    this.emitState()
  }

  private resetPlayer(spawn: { x: number; z: number }): void {
    this.playerBody.position.set(spawn.x, PLAYER_HEIGHT / 2 + PLAYER_BODY_RADIUS, spawn.z)
    this.playerBody.velocity.set(0, 0, 0)
    this.playerBody.angularVelocity.set(0, 0, 0)
    this.yaw = 0
    this.pitch = 0
  }

  private clearProjectiles(): void {
    for (const projectile of this.projectiles) {
      this.world.removeBody(projectile.body)
      this.scene.remove(projectile.mesh)
    }
    this.projectiles = []
  }

  private clearActors(): void {
    for (const actor of this.actors) {
      actor.dispose()
    }
    this.actors = []
  }

  private loadLevel(level: LevelDefinition, resetHealth: boolean): void {
    this.clearProjectiles()
    this.clearActors()
    this.currentLevel = level
    this.resetPlayer(level.playerSpawn)

    if (resetHealth) {
      this.health = PLAYER_MAX_HEALTH
      this.lastDamageTime = 0
    }

    this.actors = level.actors.map((spawn) => createLevelActor(spawn, this.world, this.scene))
    this.setPhase('playing')
  }

  private spawnProjectile(): void {
    if (this.projectiles.length >= MAX_PROJECTILES) {
      this.removeProjectileAt(0)
    }

    const direction = this.tmpDir.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize()
    const spawnPos = this.camera.position.clone().addScaledVector(direction, 1)

    const mesh = new THREE.Mesh(this.projectileGeometry, this.projectileMaterial)
    mesh.quaternion.setFromUnitVectors(UP, direction)
    mesh.position.copy(spawnPos)
    this.scene.add(mesh)

    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Sphere(PROJECTILE_RADIUS),
      position: new CANNON.Vec3(spawnPos.x, spawnPos.y, spawnPos.z),
    })
    body.velocity.set(
      direction.x * DEFAULT_WEAPON.projectileSpeed,
      direction.y * DEFAULT_WEAPON.projectileSpeed,
      direction.z * DEFAULT_WEAPON.projectileSpeed,
    )
    this.world.addBody(body)

    this.projectiles.push({
      mesh,
      body,
      createdAt: performance.now(),
      damage: DEFAULT_WEAPON.damage,
      knockback: DEFAULT_WEAPON.knockback,
    })

    this.sound.play()
  }

  private removeProjectileAt(index: number): void {
    const projectile = this.projectiles[index]
    if (!projectile) return

    this.world.removeBody(projectile.body)
    this.scene.remove(projectile.mesh)
    this.projectiles.splice(index, 1)
  }

  private updateProjectiles(now: number): void {
    for (let index = this.projectiles.length - 1; index >= 0; index--) {
      const projectile = this.projectiles[index]
      const ageSeconds = (now - projectile.createdAt) / 1000

      if (ageSeconds > PROJECTILE_LIFETIME || projectile.body.position.y < -5) {
        this.removeProjectileAt(index)
        continue
      }

      projectile.mesh.position.set(
        projectile.body.position.x,
        projectile.body.position.y,
        projectile.body.position.z,
      )
    }
  }

  private updateLook(): void {
    if (this.input.isLocked()) {
      const { dx, dy } = this.input.consumeMouseDelta()
      this.yaw -= dx * MOUSE_SENSITIVITY
      this.pitch -= dy * MOUSE_SENSITIVITY
    }

    const inputState = this.input.getState()
    this.yaw -= inputState.lookX * GAMEPAD_LOOK_SPEED
    this.pitch -= inputState.lookY * GAMEPAD_LOOK_SPEED
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch))
  }

  private updateMovement(): void {
    const inputState = this.input.getState()
    let moveX = inputState.moveX
    let moveZ = inputState.moveZ
    const length = Math.hypot(moveX, moveZ)

    if (length > 0) {
      moveX /= length
      moveZ /= length

      const sinYaw = Math.sin(this.yaw)
      const cosYaw = Math.cos(this.yaw)
      const worldX = moveX * cosYaw + moveZ * sinYaw
      const worldZ = -moveX * sinYaw + moveZ * cosYaw

      this.playerBody.position.x += worldX * PLAYER_SPEED * PHYSICS_DT
      this.playerBody.position.z += worldZ * PLAYER_SPEED * PHYSICS_DT
    }

    this.camera.position.set(
      this.playerBody.position.x,
      this.playerBody.position.y + PLAYER_HEIGHT / 2,
      this.playerBody.position.z,
    )
    this.tmpEuler.set(this.pitch, this.yaw, 0)
    this.camera.quaternion.setFromEuler(this.tmpEuler)
  }

  private updateCombat(now: number): void {
    const inputState = this.input.getState()
    if (!inputState.shooting || this.phase !== 'playing') return

    const nowSeconds = now / 1000
    if (nowSeconds - this.lastShotTime < SHOOT_COOLDOWN) return

    this.lastShotTime = nowSeconds
    this.spawnProjectile()
  }

  private updateActors(): void {
    this.playerPosition.set(
      this.camera.position.x,
      this.camera.position.y,
      this.camera.position.z,
    )

    for (const actor of this.actors) {
      actor.update(PHYSICS_DT, {
        playerPosition: this.playerPosition,
        arenaSize: this.currentLevel.arenaSize,
      })
    }
  }

  private resolveProjectileHits(): void {
    const hitIndices = new Set<number>()

    for (const actor of this.actors) {
      for (const index of actor.collectProjectileHits(this.projectiles)) {
        hitIndices.add(index)
      }
    }

    const sortedHitIndices = [...hitIndices].sort((left, right) => right - left)
    for (const index of sortedHitIndices) {
      this.removeProjectileAt(index)
    }
  }

  private applyDamage(amount: number, nowSeconds: number): void {
    this.health = Math.max(0, this.health - amount)
    this.lastDamageTime = nowSeconds
    this.damageFlashUntil = nowSeconds + DAMAGE_FLASH_SECONDS
    this.emitState()

    if (this.health === 0) {
      this.setPhase('game-over')
    }
  }

  private updatePlayerContacts(now: number): void {
    if (this.phase !== 'playing') return

    const nowSeconds = now / 1000
    const playerPosition = this.camera.position

    for (const actor of this.actors) {
      const effect = actor.getPlayerContactEffect(playerPosition)
      if (!effect) continue
      if (nowSeconds - this.lastDamageTime < effect.cooldownSeconds) continue

      this.applyDamage(effect.damage, nowSeconds)
      break
    }
  }

  private updateDamageOverlay(now: number): void {
    const nowSeconds = now / 1000
    this.damageOverlay.style.background =
      nowSeconds < this.damageFlashUntil ? 'rgba(255,0,0,0.4)' : 'rgba(255,0,0,0)'
  }

  private evaluateLevelProgress(now: number): void {
    if (this.phase === 'game-over' || this.phase === 'victory') return

    const levelCleared = this.actors.every((actor) => !actor.isAlive)
    if (!levelCleared) return

    if (this.currentLevel.nextLevelId === null) {
      this.setPhase('victory')
      return
    }

    this.setPhase('level-complete')
    const elapsedSeconds = (now - this.phaseChangedAt) / 1000
    if (elapsedSeconds < LEVEL_TRANSITION_DELAY_SECONDS) return

    this.loadLevel(getLevelById(this.currentLevel.nextLevelId), false)
  }

  private animate = (): void => {
    if (this.isDisposed) return

    this.animFrameId = requestAnimationFrame(this.animate)
    const now = performance.now()

    this.input.update()
    this.updateLook()

    this.playerBody.velocity.x = 0
    this.playerBody.velocity.z = 0
    this.world.step(PHYSICS_DT, PHYSICS_DT, PHYSICS_SUBSTEPS)

    if (this.phase === 'playing') {
      this.updateMovement()
      this.updateCombat(now)
    } else {
      this.camera.position.set(
        this.playerBody.position.x,
        this.playerBody.position.y + PLAYER_HEIGHT / 2,
        this.playerBody.position.z,
      )
      this.tmpEuler.set(this.pitch, this.yaw, 0)
      this.camera.quaternion.setFromEuler(this.tmpEuler)
    }

    this.updateProjectiles(now)
    this.updateActors()
    this.resolveProjectileHits()
    this.updatePlayerContacts(now)
    this.updateDamageOverlay(now)
    this.evaluateLevelProgress(now)

    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.isDisposed = true
    cancelAnimationFrame(this.animFrameId)
    window.removeEventListener('resize', this.handleResize)

    this.input.dispose()
    this.sound.dispose()
    this.clearProjectiles()
    this.clearActors()
    this.damageOverlay.remove()

    this.projectileGeometry.dispose()
    this.projectileMaterial.dispose()

    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement)
    }
    this.renderer.dispose()
  }
}
