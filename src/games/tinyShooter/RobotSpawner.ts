import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { AnimatedEnemy } from './AnimatedEnemy'
import { PROJECTILE_RADIUS } from './constants'
import { createEnemyBehavior } from './enemyBehaviors'
import { getEnemyArchetype } from './enemyRegistry'
import type { EnemyArchetype } from './enemyTypes'
import type {
  ActorUpdateContext,
  LevelActor,
  ObjectiveContactEffect,
  PlayerBlockerSnapshot,
  PlayerContactEffect,
  SolidRobotSnapshot,
} from './actorTypes'
import type { Projectile } from './gameTypes'
import type { RobotSpawnerSpawnDefinition } from './levelTypes'
import type { SpawnBoxHitSound } from './SpawnBoxHitSound'

const BOX_SCALE = 0.75
const BOX_WIDTH = 10 * BOX_SCALE
const BOX_DEPTH = 10 * BOX_SCALE
const BOX_HEIGHT = 8 * BOX_SCALE
const BOX_BOTTOM_Y = 0.75
const BOX_CENTER_Y = BOX_BOTTOM_Y + BOX_HEIGHT / 2
const BOX_HALF_WIDTH = BOX_WIDTH / 2
const BOX_HALF_DEPTH = BOX_DEPTH / 2
const BOX_HALF_HEIGHT = BOX_HEIGHT / 2

const ASCEND_DURATION = 1.4
const HOLD_DURATION = 0.6
const STAGED_START_Y = -4.2
const STAGED_HOLD_Y = 1.25
const CORPSE_LINGER_SECONDS = 3

const RIPPLE_DURATION = 0.45
const MAX_RIPPLES = 8
const SHELL_OPACITY = 1 - (1 - 0.18) * 0.8
const EDGE_OPACITY = 1 - (1 - 0.65) * 0.8
const RIPPLE_INNER_RADIUS = 0.35 * BOX_SCALE
const RIPPLE_OUTER_RADIUS = 0.48 * BOX_SCALE

type StagedPhase = 'rising' | 'holding'

interface StagedRobot {
  enemy: AnimatedEnemy
  phase: StagedPhase
  elapsed: number
}

interface ReleasedRobot {
  enemy: AnimatedEnemy
  deadElapsed: number | null
  lastPlayerContactAt: number
  lastObjectiveContactAt: number
}

interface Ripple {
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
  elapsed: number
}

interface BoxImpact {
  point: THREE.Vector3
  normal: THREE.Vector3
}

export class RobotSpawner implements LevelActor {
  readonly isAlive = true

  private readonly scene: THREE.Scene
  private readonly world: CANNON.World
  private readonly config: EnemyArchetype
  private readonly group = new THREE.Group()
  private readonly playerBlocker: PlayerBlockerSnapshot
  private readonly shellMaterial = new THREE.MeshBasicMaterial({
    color: 0x86f7ff,
    transparent: true,
    opacity: SHELL_OPACITY,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  private readonly edgeMaterial = new THREE.LineBasicMaterial({
    color: 0xb6fcff,
    transparent: true,
    opacity: EDGE_OPACITY,
  })
  private readonly rippleGeometry = new THREE.RingGeometry(RIPPLE_INNER_RADIUS, RIPPLE_OUTER_RADIUS, 32)
  private readonly baseRippleNormal = new THREE.Vector3(0, 0, 1)
  private readonly center: THREE.Vector3
  private readonly boxGeometries: THREE.BufferGeometry[] = []
  private readonly tmpStart = new THREE.Vector3()
  private readonly tmpEnd = new THREE.Vector3()
  private readonly tmpDir = new THREE.Vector3()

  private spawnCountdown: number
  private stagedRobot: StagedRobot | null = null
  private releasedRobots: ReleasedRobot[] = []
  private ripples: Ripple[] = []

  constructor(
    world: CANNON.World,
    scene: THREE.Scene,
    private readonly spawn: RobotSpawnerSpawnDefinition,
    private readonly hitSound: SpawnBoxHitSound,
  ) {
    this.scene = scene
    this.world = world
    this.config = getEnemyArchetype(spawn.enemyId)
    this.center = new THREE.Vector3(spawn.position.x, BOX_CENTER_Y, spawn.position.z)
    this.playerBlocker = {
      minX: spawn.position.x - BOX_HALF_WIDTH,
      maxX: spawn.position.x + BOX_HALF_WIDTH,
      minZ: spawn.position.z - BOX_HALF_DEPTH,
      maxZ: spawn.position.z + BOX_HALF_DEPTH,
    }
    this.spawnCountdown = spawn.initialDelaySeconds
    this.group.position.copy(this.center)
    this.scene.add(this.group)
    this.buildBox()
  }

  private buildBox(): void {
    const topGeometry = new THREE.PlaneGeometry(BOX_WIDTH, BOX_DEPTH)
    this.boxGeometries.push(topGeometry)
    const top = new THREE.Mesh(topGeometry, this.shellMaterial)
    top.rotation.x = Math.PI / 2
    top.position.y = BOX_HALF_HEIGHT
    this.group.add(top)

    const frontGeometry = new THREE.PlaneGeometry(BOX_WIDTH, BOX_HEIGHT)
    this.boxGeometries.push(frontGeometry)
    const front = new THREE.Mesh(frontGeometry, this.shellMaterial)
    front.position.z = BOX_HALF_DEPTH
    this.group.add(front)

    const backGeometry = new THREE.PlaneGeometry(BOX_WIDTH, BOX_HEIGHT)
    this.boxGeometries.push(backGeometry)
    const back = new THREE.Mesh(backGeometry, this.shellMaterial)
    back.rotation.y = Math.PI
    back.position.z = -BOX_HALF_DEPTH
    this.group.add(back)

    const leftGeometry = new THREE.PlaneGeometry(BOX_DEPTH, BOX_HEIGHT)
    this.boxGeometries.push(leftGeometry)
    const left = new THREE.Mesh(leftGeometry, this.shellMaterial)
    left.rotation.y = Math.PI / 2
    left.position.x = -BOX_HALF_WIDTH
    this.group.add(left)

    const rightGeometry = new THREE.PlaneGeometry(BOX_DEPTH, BOX_HEIGHT)
    this.boxGeometries.push(rightGeometry)
    const right = new THREE.Mesh(rightGeometry, this.shellMaterial)
    right.rotation.y = -Math.PI / 2
    right.position.x = BOX_HALF_WIDTH
    this.group.add(right)

    const frameGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(BOX_WIDTH, BOX_HEIGHT, BOX_DEPTH))
    this.boxGeometries.push(frameGeometry)
    const frame = new THREE.LineSegments(
      frameGeometry,
      this.edgeMaterial,
    )
    this.group.add(frame)
  }

  private spawnRobot(): void {
    if (this.stagedRobot) return

    const enemy = new AnimatedEnemy(
      this.world,
      this.scene,
      this.spawn.position,
      this.config,
      createEnemyBehavior(this.spawn.position, this.spawn.behavior, this.config),
    )
    enemy.root.position.set(this.spawn.position.x, STAGED_START_Y, this.spawn.position.z)

    this.stagedRobot = {
      enemy,
      phase: 'rising',
      elapsed: 0,
    }
  }

  private releaseStagedRobot(): void {
    if (!this.stagedRobot) return

    this.stagedRobot.enemy.root.position.set(this.spawn.position.x, 0, this.spawn.position.z)
    this.releasedRobots.push({
      enemy: this.stagedRobot.enemy,
      deadElapsed: null,
      lastPlayerContactAt: Number.NEGATIVE_INFINITY,
      lastObjectiveContactAt: Number.NEGATIVE_INFINITY,
    })
    this.stagedRobot = null
  }

  private updateSpawnTimer(dt: number): void {
    if (this.stagedRobot) return

    this.spawnCountdown -= dt
    while (this.spawnCountdown <= 0 && !this.stagedRobot) {
      this.spawnRobot()
      this.spawnCountdown += this.spawn.releaseIntervalSeconds
    }
  }

  private updateStagedRobot(dt: number, context: ActorUpdateContext): void {
    if (!this.stagedRobot) return

    this.stagedRobot.elapsed += dt
    if (this.stagedRobot.phase === 'rising') {
      const progress = Math.min(1, this.stagedRobot.elapsed / ASCEND_DURATION)
      this.stagedRobot.enemy.root.position.set(
        this.spawn.position.x,
        THREE.MathUtils.lerp(STAGED_START_Y, STAGED_HOLD_Y, progress),
        this.spawn.position.z,
      )

      if (progress >= 1) {
        this.stagedRobot.phase = 'holding'
        this.stagedRobot.elapsed = 0
      }
      return
    }

    if (this.stagedRobot.elapsed >= HOLD_DURATION && this.canReleaseStagedRobot(context)) {
      this.releaseStagedRobot()
    }
  }

  private canReleaseStagedRobot(context: ActorUpdateContext): boolean {
    for (const robot of context.solidRobots) {
      const combinedRadius = this.config.bodyRadius + robot.radius
      const dx = this.spawn.position.x - robot.position.x
      const dz = this.spawn.position.z - robot.position.z
      if (dx * dx + dz * dz < combinedRadius * combinedRadius) {
        return false
      }
    }

    return true
  }

  private updateReleasedRobots(dt: number, context: ActorUpdateContext): void {
    for (let index = this.releasedRobots.length - 1; index >= 0; index--) {
      const robot = this.releasedRobots[index]
      robot.enemy.update(dt, context)

      if (!robot.enemy.dead) {
        continue
      }

      robot.deadElapsed = (robot.deadElapsed ?? 0) + dt
      if (robot.deadElapsed < CORPSE_LINGER_SECONDS) {
        continue
      }

      robot.enemy.dispose()
      this.releasedRobots.splice(index, 1)
    }
  }

  private updateRipples(dt: number): void {
    for (let index = this.ripples.length - 1; index >= 0; index--) {
      const ripple = this.ripples[index]
      ripple.elapsed += dt
      const progress = Math.min(1, ripple.elapsed / RIPPLE_DURATION)
      const scale = 1 + progress * 5.2
      ripple.mesh.scale.setScalar(scale)
      ripple.material.opacity = (1 - progress) * 0.65

      if (progress < 1) {
        continue
      }

      this.scene.remove(ripple.mesh)
      ripple.material.dispose()
      this.ripples.splice(index, 1)
    }
  }

  update(dt: number, context: ActorUpdateContext): void {
    this.updateSpawnTimer(dt)
    this.updateStagedRobot(dt, context)
    this.updateReleasedRobots(dt, context)
    this.updateRipples(dt)
  }

  private buildAvailableProjectiles(
    projectiles: Projectile[],
    consumed: Set<number>,
  ): { projectiles: Projectile[]; indices: number[] } {
    const availableProjectiles: Projectile[] = []
    const availableIndices: number[] = []

    for (let index = 0; index < projectiles.length; index++) {
      if (consumed.has(index)) continue
      availableProjectiles.push(projectiles[index])
      availableIndices.push(index)
    }

    return {
      projectiles: availableProjectiles,
      indices: availableIndices,
    }
  }

  private intersectShell(projectile: Projectile): BoxImpact | null {
    this.tmpStart.copy(projectile.previousPosition).sub(this.center)
    this.tmpEnd.set(
      projectile.body.position.x - this.center.x,
      projectile.body.position.y - this.center.y,
      projectile.body.position.z - this.center.z,
    )

    const dir = this.tmpDir.copy(this.tmpEnd).sub(this.tmpStart)
    const min = new THREE.Vector3(
      -BOX_HALF_WIDTH - PROJECTILE_RADIUS,
      -BOX_HALF_HEIGHT - PROJECTILE_RADIUS,
      -BOX_HALF_DEPTH - PROJECTILE_RADIUS,
    )
    const max = new THREE.Vector3(
      BOX_HALF_WIDTH + PROJECTILE_RADIUS,
      BOX_HALF_HEIGHT + PROJECTILE_RADIUS,
      BOX_HALF_DEPTH + PROJECTILE_RADIUS,
    )

    let entry = 0
    let exit = 1
    const normal = new THREE.Vector3()

    const startValues = [this.tmpStart.x, this.tmpStart.y, this.tmpStart.z]
    const dirValues = [dir.x, dir.y, dir.z]
    const minValues = [min.x, min.y, min.z]
    const maxValues = [max.x, max.y, max.z]

    for (let axis = 0; axis < 3; axis++) {
      const start = startValues[axis]
      const delta = dirValues[axis]
      const axisMin = minValues[axis]
      const axisMax = maxValues[axis]

      if (Math.abs(delta) < 0.000001) {
        if (start < axisMin || start > axisMax) {
          return null
        }
        continue
      }

      let t1 = (axisMin - start) / delta
      let t2 = (axisMax - start) / delta
      let axisNormal = 0

      if (t1 > t2) {
        const tmp = t1
        t1 = t2
        t2 = tmp
        axisNormal = 1
      } else {
        axisNormal = -1
      }

      if (t1 > entry) {
        entry = t1
        normal.set(0, 0, 0)
        if (axis === 0) normal.x = axisNormal
        if (axis === 1) normal.y = axisNormal
        if (axis === 2) normal.z = axisNormal
      }

      exit = Math.min(exit, t2)
      if (entry > exit) {
        return null
      }
    }

    if (entry < 0 || entry > 1 || normal.y < 0) {
      return null
    }

    const centerHit = projectile.previousPosition.clone().lerp(
      new THREE.Vector3(
        projectile.body.position.x,
        projectile.body.position.y,
        projectile.body.position.z,
      ),
      entry,
    )
    const impactPoint = centerHit.sub(normal.clone().multiplyScalar(PROJECTILE_RADIUS - 0.02))

    return {
      point: impactPoint,
      normal,
    }
  }

  private addRipple(impact: BoxImpact): void {
    if (this.ripples.length >= MAX_RIPPLES) {
      const oldest = this.ripples.shift()
      if (oldest) {
        this.scene.remove(oldest.mesh)
        oldest.material.dispose()
      }
    }

    const material = new THREE.MeshBasicMaterial({
      color: 0xe8ffff,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(this.rippleGeometry, material)
    mesh.position.copy(impact.point).addScaledVector(impact.normal, 0.04)
    mesh.quaternion.setFromUnitVectors(this.baseRippleNormal, impact.normal)
    this.scene.add(mesh)
    this.ripples.push({
      mesh,
      material,
      elapsed: 0,
    })
  }

  collectProjectileHits(projectiles: Projectile[]): number[] {
    const consumed = new Set<number>()

    for (const robot of this.releasedRobots) {
      const available = this.buildAvailableProjectiles(projectiles, consumed)
      for (const localIndex of robot.enemy.collectProjectileHits(available.projectiles)) {
        const projectileIndex = available.indices[localIndex]
        if (projectileIndex !== undefined) {
          consumed.add(projectileIndex)
        }
      }
    }

    for (let index = 0; index < projectiles.length; index++) {
      if (consumed.has(index)) continue

      const impact = this.intersectShell(projectiles[index])
      if (!impact) continue

      consumed.add(index)
      this.addRipple(impact)
      this.hitSound.play()
    }

    return [...consumed]
  }

  getPlayerContactEffect(playerPosition: THREE.Vector3): PlayerContactEffect | null {
    const nowSeconds = performance.now() / 1000
    let totalDamage = 0

    for (const robot of this.releasedRobots) {
      const effect = robot.enemy.getPlayerContactEffect(playerPosition)
      if (!effect) continue
      if (nowSeconds - robot.lastPlayerContactAt < effect.cooldownSeconds) continue

      robot.lastPlayerContactAt = nowSeconds
      totalDamage += effect.damage
    }

    return totalDamage > 0
      ? { damage: totalDamage, cooldownSeconds: 0 }
      : null
  }

  getObjectiveContactEffect(objectivePosition: THREE.Vector3): ObjectiveContactEffect | null {
    const nowSeconds = performance.now() / 1000
    let totalDamage = 0

    for (const robot of this.releasedRobots) {
      const effect = robot.enemy.getObjectiveContactEffect(objectivePosition)
      if (!effect) continue
      if (nowSeconds - robot.lastObjectiveContactAt < effect.cooldownSeconds) continue

      robot.lastObjectiveContactAt = nowSeconds
      totalDamage += effect.damage
    }

    return totalDamage > 0
      ? { damage: totalDamage, cooldownSeconds: 0 }
      : null
  }

  getSolidRobots(): readonly SolidRobotSnapshot[] {
    const solids: SolidRobotSnapshot[] = []
    for (const robot of this.releasedRobots) {
      solids.push(...robot.enemy.getSolidRobots())
    }

    return solids
  }

  getPlayerBlockers(): readonly PlayerBlockerSnapshot[] {
    return [this.playerBlocker]
  }

  dispose(): void {
    if (this.stagedRobot) {
      this.stagedRobot.enemy.dispose()
      this.stagedRobot = null
    }

    for (const robot of this.releasedRobots) {
      robot.enemy.dispose()
    }
    this.releasedRobots = []

    for (const ripple of this.ripples) {
      this.scene.remove(ripple.mesh)
      ripple.material.dispose()
    }
    this.ripples = []

    this.scene.remove(this.group)
    for (const geometry of this.boxGeometries) {
      geometry.dispose()
    }
    this.rippleGeometry.dispose()
    this.shellMaterial.dispose()
    this.edgeMaterial.dispose()
  }
}
