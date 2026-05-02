import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { InputManager } from './InputManager'
import type { GamepadStatus } from './InputManager'
import { ShotSound } from './ShotSound'
import { SpawnBoxHitSound } from './SpawnBoxHitSound'
import { PlayerDamageSound } from './PlayerDamageSound'
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
  RADAR_RANGE_ARENA_FACTOR,
  MAX_PROJECTILES,
  SHOOT_COOLDOWN,
  MOUSE_SENSITIVITY,
  GAMEPAD_LOOK_SPEED,
} from './constants'
import { DEFAULT_WEAPON } from './weapons'
import type { Projectile, RadarBlip, RadarSnapshot, TinyShooterGameState, TinyShooterPhase } from './gameTypes'
import type { LevelActor, PlayerBlockerSnapshot, RadarTargetSnapshot, SolidRobotSnapshot, VisionBlockerSnapshot } from './actorTypes'
import type { LevelDefinition } from './levelTypes'
import { createLevelActor } from './actorFactory'
import { getFirstTinyShooterLevel, getLevelById } from './levels'

const UP = new THREE.Vector3(0, 1, 0)
const LEVEL_TRANSITION_DELAY_SECONDS = 1.4
const DAMAGE_FLASH_SECONDS = 0.24
const OBJECTIVE_HEIGHT = 1.85
const MIN_RADAR_RANGE = 1
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
  private readonly spawnBoxHitSound: SpawnBoxHitSound
  private readonly playerDamageSound: PlayerDamageSound
  private readonly projectileGeometry: THREE.CylinderGeometry
  private readonly projectileMaterial: THREE.MeshStandardMaterial
  private readonly damageOverlay: HTMLDivElement
  private readonly tmpDir = new THREE.Vector3()
  private readonly tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ')
  private readonly playerPosition = new THREE.Vector3()
  private readonly objectivePosition = new THREE.Vector3()
  private readonly objectiveRoot = new THREE.Group()
  private readonly objectiveCoreMaterial = new THREE.MeshStandardMaterial({
    color: 0xdafcff,
    emissive: 0x5df4ff,
    emissiveIntensity: 2.6,
    roughness: 0.15,
    metalness: 0.2,
  })
  private readonly objectiveShellMaterial = new THREE.MeshBasicMaterial({
    color: 0x6cf2ff,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  })
  private readonly objectiveRingMaterial = new THREE.MeshBasicMaterial({
    color: 0x7cf5ff,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  })
  private readonly objectiveCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.25, 0),
    this.objectiveCoreMaterial,
  )
  private readonly objectiveShell = new THREE.Mesh(
    new THREE.OctahedronGeometry(2.1, 0),
    this.objectiveShellMaterial,
  )
  private readonly objectiveRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.35, 0.08, 12, 48),
    this.objectiveRingMaterial,
  )
  private readonly objectiveLight = new THREE.PointLight(0x79f8ff, 3.6, 28, 2)
  private readonly playerContactTimes = new Map<LevelActor, number>()
  private readonly objectiveContactTimes = new Map<LevelActor, number>()

  private projectiles: Projectile[] = []
  private actors: LevelActor[] = []
  private currentLevel: LevelDefinition
  private phase: TinyShooterPhase = 'playing'
  private health = PLAYER_MAX_HEALTH
  private objectiveHealth = 0
  private objectiveMaxHealth = 0
  private gameOverReason: TinyShooterGameState['gameOverReason'] = null
  private pointerLocked = false
  private gamepadStatus: GamepadStatus = DEFAULT_GAMEPAD_STATUS
  private lastShotTime = 0
  private damageFlashUntil = 0
  private damageFlashStrength = 0
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
    this.scene.background = new THREE.Color(0xd9d9d9)

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
      'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity 0.06s;background:radial-gradient(circle at center, rgba(255,120,120,0.08) 0%, rgba(200,30,30,0.18) 52%, rgba(120,0,0,0.46) 100%);box-shadow:inset 0 0 140px rgba(150,0,0,0.45);z-index:15;'
    container.appendChild(this.damageOverlay)

    this.objectiveCore.castShadow = true
    this.objectiveCore.receiveShadow = true
    this.objectiveCore.position.y = OBJECTIVE_HEIGHT
    this.objectiveShell.position.y = OBJECTIVE_HEIGHT
    this.objectiveShell.renderOrder = 1
    this.objectiveRing.position.y = 0.08
    this.objectiveRing.rotation.x = Math.PI / 2
    this.objectiveRing.renderOrder = 1
    this.objectiveLight.position.set(0, OBJECTIVE_HEIGHT, 0)
    this.objectiveRoot.add(this.objectiveRing, this.objectiveShell, this.objectiveCore, this.objectiveLight)
    this.scene.add(this.objectiveRoot)

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
    this.spawnBoxHitSound = new SpawnBoxHitSound()
    this.playerDamageSound = new PlayerDamageSound()
    this.spawnBoxHitSound.prewarm()
    this.playerDamageSound.prewarm()

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

    this.scene.add(new THREE.HemisphereLight(0xd9d9d9, 0x444444, 0.3))

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
      objectiveHealth: this.objectiveHealth,
      objectiveMaxHealth: this.objectiveMaxHealth,
      gameOverReason: this.gameOverReason,
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

    const dx = this.currentLevel.objective.position.x - spawn.x
    const dz = this.currentLevel.objective.position.z - spawn.z
    this.yaw = dx === 0 && dz === 0 ? 0 : Math.atan2(-dx, -dz)
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
    this.playerContactTimes.clear()
    this.objectiveContactTimes.clear()
    this.currentLevel = level
    this.objectivePosition.set(level.objective.position.x, 0, level.objective.position.z)
    this.objectiveRoot.position.set(level.objective.position.x, 0, level.objective.position.z)
    this.objectiveHealth = level.objective.maxHealth
    this.objectiveMaxHealth = level.objective.maxHealth
    this.gameOverReason = null
    this.resetPlayer(level.playerSpawn)

    if (resetHealth) {
      this.health = PLAYER_MAX_HEALTH
      this.damageFlashUntil = 0
      this.damageFlashStrength = 0
    }

    this.actors = level.actors.map((spawn) => createLevelActor(spawn, this.world, this.scene, {
      spawnBoxHitSound: this.spawnBoxHitSound,
    }))
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
      previousPosition: spawnPos.clone(),
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

      projectile.previousPosition.copy(projectile.mesh.position)
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
    const playerBlockers = this.collectPlayerBlockers()

    if (length > 0) {
      moveX /= length
      moveZ /= length

      const sinYaw = Math.sin(this.yaw)
      const cosYaw = Math.cos(this.yaw)
      const worldX = moveX * cosYaw + moveZ * sinYaw
      const worldZ = -moveX * sinYaw + moveZ * cosYaw

      this.tryMovePlayer(worldX * PLAYER_SPEED * PHYSICS_DT, worldZ * PLAYER_SPEED * PHYSICS_DT, playerBlockers)
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

  private collectSolidRobots(): SolidRobotSnapshot[] {
    const solids: SolidRobotSnapshot[] = []
    for (const actor of this.actors) {
      solids.push(...actor.getSolidRobots())
    }

    return solids
  }

  private collectPlayerBlockers(): PlayerBlockerSnapshot[] {
    const blockers: PlayerBlockerSnapshot[] = []
    for (const actor of this.actors) {
      blockers.push(...actor.getPlayerBlockers())
    }

    return blockers
  }

  private collectVisionBlockers(): VisionBlockerSnapshot[] {
    const blockers: VisionBlockerSnapshot[] = []
    for (const actor of this.actors) {
      blockers.push(...actor.getVisionBlockers())
    }

    return blockers
  }

  private tryMovePlayer(
    deltaX: number,
    deltaZ: number,
    playerBlockers: readonly PlayerBlockerSnapshot[],
  ): void {
    if (Math.abs(deltaX) < 0.000001 && Math.abs(deltaZ) < 0.000001) {
      return
    }

    const nextX = this.playerBody.position.x + deltaX
    const nextZ = this.playerBody.position.z + deltaZ
    if (!this.isPlayerPositionBlocked(nextX, nextZ, playerBlockers)) {
      this.playerBody.position.x = nextX
      this.playerBody.position.z = nextZ
      return
    }

    const prioritizeX = Math.abs(deltaX) >= Math.abs(deltaZ)
    if (this.tryMovePlayerAxis(prioritizeX ? deltaX : 0, prioritizeX ? 0 : deltaZ, playerBlockers)) {
      return
    }

    this.tryMovePlayerAxis(prioritizeX ? 0 : deltaX, prioritizeX ? deltaZ : 0, playerBlockers)
  }

  private tryMovePlayerAxis(
    deltaX: number,
    deltaZ: number,
    playerBlockers: readonly PlayerBlockerSnapshot[],
  ): boolean {
    if (Math.abs(deltaX) < 0.000001 && Math.abs(deltaZ) < 0.000001) {
      return false
    }

    const nextX = this.playerBody.position.x + deltaX
    const nextZ = this.playerBody.position.z + deltaZ
    if (this.isPlayerPositionBlocked(nextX, nextZ, playerBlockers)) {
      return false
    }

    this.playerBody.position.x = nextX
    this.playerBody.position.z = nextZ
    return true
  }

  private isPlayerPositionBlocked(
    playerX: number,
    playerZ: number,
    playerBlockers: readonly PlayerBlockerSnapshot[],
  ): boolean {
    for (const blocker of playerBlockers) {
      const nearestX = THREE.MathUtils.clamp(playerX, blocker.minX, blocker.maxX)
      const nearestZ = THREE.MathUtils.clamp(playerZ, blocker.minZ, blocker.maxZ)
      const dx = playerX - nearestX
      const dz = playerZ - nearestZ
      if (dx * dx + dz * dz < PLAYER_BODY_RADIUS * PLAYER_BODY_RADIUS) {
        return true
      }
    }

    return false
  }

  private updateActors(): void {
    this.playerPosition.set(this.camera.position.x, 0, this.camera.position.z)
    const visionBlockers = this.collectVisionBlockers()

    for (const actor of this.actors) {
      const solidRobots = this.collectSolidRobots()
      actor.update(PHYSICS_DT, {
        playerPosition: this.playerPosition,
        objectivePosition: this.objectivePosition,
        objectiveRadius: this.currentLevel.objective.radius,
        arenaSize: this.currentLevel.arenaSize,
        solidRobots,
        visionBlockers,
      })
    }
  }

  private buildAvailableProjectiles(consumed: Set<number>): { projectiles: Projectile[]; indices: number[] } {
    const availableProjectiles: Projectile[] = []
    const availableIndices: number[] = []

    for (let index = 0; index < this.projectiles.length; index++) {
      if (consumed.has(index)) continue
      availableProjectiles.push(this.projectiles[index])
      availableIndices.push(index)
    }

    return {
      projectiles: availableProjectiles,
      indices: availableIndices,
    }
  }

  private resolveProjectileHits(): void {
    const hitIndices = new Set<number>()

    for (const actor of this.actors) {
      const available = this.buildAvailableProjectiles(hitIndices)
      for (const localIndex of actor.collectProjectileHits(available.projectiles)) {
        const projectileIndex = available.indices[localIndex]
        if (projectileIndex !== undefined) {
          hitIndices.add(projectileIndex)
        }
      }
    }

    const sortedHitIndices = [...hitIndices].sort((left, right) => right - left)
    for (const index of sortedHitIndices) {
      this.removeProjectileAt(index)
    }
  }

  private applyPlayerDamage(amount: number, nowSeconds: number): void {
    if (this.phase !== 'playing') return

    this.health = Math.max(0, this.health - amount)
    this.damageFlashUntil = nowSeconds + DAMAGE_FLASH_SECONDS
    this.damageFlashStrength = Math.max(
      this.damageFlashStrength,
      THREE.MathUtils.clamp(0.28 + amount / 24, 0.32, 0.78),
    )
    this.playerDamageSound.play()
    this.emitState()

    if (this.health === 0) {
      this.gameOverReason = 'player-dead'
      this.setPhase('game-over')
    }
  }

  private updatePlayerContacts(now: number): void {
    if (this.phase !== 'playing') return

    const nowSeconds = now / 1000
    for (const actor of this.actors) {
      const effect = actor.getPlayerContactEffect(this.playerPosition)
      if (!effect) continue

      const lastContactAt = this.playerContactTimes.get(actor) ?? Number.NEGATIVE_INFINITY
      if (nowSeconds - lastContactAt < effect.cooldownSeconds) continue

      this.playerContactTimes.set(actor, nowSeconds)
      this.applyPlayerDamage(effect.damage, nowSeconds)
      if (this.health === 0) {
        return
      }
    }
  }

  private applyObjectiveDamage(amount: number): void {
    if (this.phase !== 'playing') return

    this.objectiveHealth = Math.max(0, this.objectiveHealth - amount)
    this.emitState()

    if (this.objectiveHealth === 0) {
      this.gameOverReason = 'objective-destroyed'
      this.setPhase('game-over')
    }
  }

  private updateObjectiveContacts(now: number): void {
    if (this.phase !== 'playing') return

    const nowSeconds = now / 1000
    for (const actor of this.actors) {
      const effect = actor.getObjectiveContactEffect(this.objectivePosition)
      if (!effect) continue

      const lastContactAt = this.objectiveContactTimes.get(actor) ?? Number.NEGATIVE_INFINITY
      if (nowSeconds - lastContactAt < effect.cooldownSeconds) continue

      this.objectiveContactTimes.set(actor, nowSeconds)
      this.applyObjectiveDamage(effect.damage)
      if (this.objectiveHealth === 0) {
        return
      }
    }
  }

  private updateDamageOverlay(now: number): void {
    const nowSeconds = now / 1000
    if (nowSeconds >= this.damageFlashUntil) {
      this.damageFlashStrength = 0
      this.damageOverlay.style.opacity = '0'
      return
    }

    const remainingRatio = (this.damageFlashUntil - nowSeconds) / DAMAGE_FLASH_SECONDS
    const opacity = THREE.MathUtils.clamp(remainingRatio * this.damageFlashStrength, 0, 0.85)
    this.damageOverlay.style.opacity = opacity.toFixed(3)
  }

  private updateObjectiveVisual(now: number): void {
    const time = now / 1000
    const pulse = 1 + Math.sin(time * 3.2) * 0.08
    this.objectiveCore.scale.setScalar(pulse)
    this.objectiveShell.scale.setScalar(1.04 + Math.sin(time * 2.4) * 0.1)
    this.objectiveRing.scale.setScalar(1.02 + Math.sin(time * 2.1) * 0.04)
    this.objectiveCoreMaterial.emissiveIntensity = 2.4 + Math.sin(time * 3.2) * 0.5
    this.objectiveShellMaterial.opacity = 0.18 + (Math.sin(time * 2.4) + 1) * 0.06
    this.objectiveRingMaterial.opacity = 0.58 + (Math.sin(time * 2.4) + 1) * 0.08
    this.objectiveLight.intensity = 3.3 + (Math.sin(time * 3.2) + 1) * 0.45
  }

  private getRadarRange(): number {
    return Math.max(this.currentLevel.arenaSize * RADAR_RANGE_ARENA_FACTOR, MIN_RADAR_RANGE)
  }

  private createRadarBlip(
    targetPosition: THREE.Vector3,
    kind: RadarBlip['kind'],
    radarRange: number,
    playerX: number,
    playerZ: number,
  ): RadarBlip | null {
    const deltaX = targetPosition.x - playerX
    const deltaZ = targetPosition.z - playerZ
    const distanceToTarget = Math.hypot(deltaX, deltaZ)

    if (distanceToTarget > radarRange) {
      return null
    }

    const rightX = Math.cos(this.yaw)
    const rightZ = -Math.sin(this.yaw)
    const forwardX = -Math.sin(this.yaw)
    const forwardZ = -Math.cos(this.yaw)

    return {
      kind,
      x: (deltaX * rightX + deltaZ * rightZ) / radarRange,
      y: -(deltaX * forwardX + deltaZ * forwardZ) / radarRange,
    }
  }

  private collectRadarTargets(): RadarTargetSnapshot[] {
    const radarTargets: RadarTargetSnapshot[] = []
    for (const actor of this.actors) {
      radarTargets.push(...actor.getRadarTargets())
    }

    return radarTargets
  }

  getRadarSnapshot(): RadarSnapshot {
    const radarRange = this.getRadarRange()
    const playerX = this.playerBody.position.x
    const playerZ = this.playerBody.position.z
    const blips: RadarBlip[] = []
    const objectiveBlip = this.createRadarBlip(
      this.objectivePosition,
      'objective',
      radarRange,
      playerX,
      playerZ,
    )

    if (objectiveBlip) {
      blips.push(objectiveBlip)
    }

    for (const radarTarget of this.collectRadarTargets()) {
      const enemyBlip = this.createRadarBlip(
        radarTarget.position,
        radarTarget.kind,
        radarRange,
        playerX,
        playerZ,
      )
      if (enemyBlip) {
        blips.push(enemyBlip)
      }
    }

    return {
      range: radarRange,
      blips,
    }
  }

  private evaluateLevelProgress(now: number): void {
    if (this.phase === 'game-over' || this.phase === 'victory') return
    if (this.currentLevel.clearCondition === 'survival') return

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
    this.updateObjectiveContacts(now)
    this.updateDamageOverlay(now)
    this.updateObjectiveVisual(now)
    this.evaluateLevelProgress(now)

    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.isDisposed = true
    cancelAnimationFrame(this.animFrameId)
    window.removeEventListener('resize', this.handleResize)

    this.input.dispose()
    this.sound.dispose()
    this.spawnBoxHitSound.dispose()
    this.playerDamageSound.dispose()
    this.clearProjectiles()
    this.clearActors()
    this.damageOverlay.remove()
    this.scene.remove(this.objectiveRoot)

    this.projectileGeometry.dispose()
    this.projectileMaterial.dispose()
    this.objectiveCore.geometry.dispose()
    this.objectiveShell.geometry.dispose()
    this.objectiveRing.geometry.dispose()
    this.objectiveCoreMaterial.dispose()
    this.objectiveShellMaterial.dispose()
    this.objectiveRingMaterial.dispose()

    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement)
    }
    this.renderer.dispose()
  }
}
