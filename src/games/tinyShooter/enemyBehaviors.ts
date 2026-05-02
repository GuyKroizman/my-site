import * as THREE from 'three'
import type { AnimatedEnemy } from './AnimatedEnemy'
import type { ActorUpdateContext } from './actorTypes'
import { GROUND_SIZE, PLAYER_BODY_RADIUS } from './constants'
import { canSeeTarget } from './enemyVision'
import type { EnemyArchetype, EnemySpawnBehaviorConfig } from './enemyTypes'

export interface EnemyBehavior {
  update(enemy: AnimatedEnemy, dt: number, context: ActorUpdateContext): void
  onPlayerShotHit(enemy: AnimatedEnemy, playerPosition: THREE.Vector3): void
}

const SEARCH_POINT_INSET = 12
const SEARCH_STOP_DISTANCE = 0.5

export class IdleBehavior implements EnemyBehavior {
  update(enemy: AnimatedEnemy, _dt: number, _context: ActorUpdateContext): void {
    enemy.setFocusTarget('objective')
  }

  onPlayerShotHit(_enemy: AnimatedEnemy, _playerPosition: THREE.Vector3): void {}
}

export class PatrolBehavior implements EnemyBehavior {
  private readonly patrolPoints: THREE.Vector3[]
  private patrolIndex = 1

  constructor(origin: { x: number; z: number }, patrolDistance: number) {
    this.patrolPoints = [
      new THREE.Vector3(origin.x - patrolDistance, 0, origin.z),
      new THREE.Vector3(origin.x + patrolDistance, 0, origin.z),
    ]
  }

  update(enemy: AnimatedEnemy, dt: number, _context: ActorUpdateContext): void {
    enemy.setFocusTarget('objective')
    const target = this.patrolPoints[this.patrolIndex]
    const reached = enemy.moveToward(target, dt)
    if (reached) {
      this.patrolIndex = (this.patrolIndex + 1) % this.patrolPoints.length
    }
  }

  onPlayerShotHit(_enemy: AnimatedEnemy, _playerPosition: THREE.Vector3): void {}
}

export class StrafeBehavior implements EnemyBehavior {
  private readonly center: THREE.Vector3
  private readonly direction: THREE.Vector3
  private readonly lateral: THREE.Vector3
  private readonly distance: number
  private time = 0

  constructor(origin: { x: number; z: number }, distance: number, headingDegrees = 0) {
    const heading = THREE.MathUtils.degToRad(headingDegrees)
    this.center = new THREE.Vector3(origin.x, 0, origin.z)
    this.direction = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading))
    this.lateral = new THREE.Vector3(this.direction.z, 0, -this.direction.x)
    this.distance = distance
  }

  update(enemy: AnimatedEnemy, dt: number, _context: ActorUpdateContext): void {
    enemy.setFocusTarget('objective')
    this.time += dt
    const forwardOffset = Math.sin(this.time * 0.9) * this.distance
    const lateralOffset = Math.sin(this.time * 1.8) * this.distance * 0.55
    const target = this.center
      .clone()
      .addScaledVector(this.direction, forwardOffset)
      .addScaledVector(this.lateral, lateralOffset)
    enemy.moveToward(target, dt)
  }

  onPlayerShotHit(_enemy: AnimatedEnemy, _playerPosition: THREE.Vector3): void {}
}

export class SeekObjectiveBehavior implements EnemyBehavior {
  private readonly playerTarget = new THREE.Vector3()
  private readonly objectiveTarget = new THREE.Vector3()
  private readonly searchCenter = new THREE.Vector3()
  private readonly searchCorners: THREE.Vector3[] = []
  private readonly disengageRangeSq: number
  private readonly playerContactRadius: number
  private readonly visionRange: number
  private readonly visionConeAngleDegrees: number
  private readonly origin: { x: number; z: number }
  private activeTarget: 'search' | 'player' | 'objective' = 'search'
  private forcedPlayerAggro = false
  private searchInitialized = false
  private searchCornerIndex = 0
  private searchStep = 1
  private headingToCenter = false

  constructor(origin: { x: number; z: number }, config: EnemyArchetype) {
    this.origin = origin
    this.disengageRangeSq = config.disengageRange * config.disengageRange
    this.playerContactRadius = config.playerContactRadius
    this.visionRange = config.vision.range
    this.visionConeAngleDegrees = config.vision.coneAngleDegrees
  }

  private initializeSearch(enemy: AnimatedEnemy, context: ActorUpdateContext): void {
    if (this.searchInitialized) {
      return
    }

    const halfArena = Math.min(context.arenaSize * 0.5, GROUND_SIZE * 0.5) - SEARCH_POINT_INSET
    this.searchCenter.set(0, 0, 0)
    this.searchCorners.push(
      new THREE.Vector3(-halfArena, 0, -halfArena),
      new THREE.Vector3(halfArena, 0, -halfArena),
      new THREE.Vector3(halfArena, 0, halfArena),
      new THREE.Vector3(-halfArena, 0, halfArena),
    )

    let nearestCornerIndex = 0
    let nearestCornerDistanceSq = Number.POSITIVE_INFINITY
    for (let index = 0; index < this.searchCorners.length; index++) {
      const corner = this.searchCorners[index]
      const dx = corner.x - this.origin.x
      const dz = corner.z - this.origin.z
      const distanceSq = dx * dx + dz * dz
      if (distanceSq < nearestCornerDistanceSq) {
        nearestCornerDistanceSq = distanceSq
        nearestCornerIndex = index
      }
    }

    const centerDx = this.searchCenter.x - this.origin.x
    const centerDz = this.searchCenter.z - this.origin.z
    const centerDistanceSq = centerDx * centerDx + centerDz * centerDz
    this.headingToCenter = centerDistanceSq < nearestCornerDistanceSq
    this.searchCornerIndex = nearestCornerIndex
    this.searchStep = enemy.getInstanceIndex() % 2 === 0 ? 1 : -1
    this.searchInitialized = true
  }

  private getSearchTarget(): THREE.Vector3 {
    return this.headingToCenter ? this.searchCenter : this.searchCorners[this.searchCornerIndex]
  }

  private advanceSearchTarget(): void {
    if (this.headingToCenter) {
      this.headingToCenter = false
      this.searchCornerIndex =
        (this.searchCornerIndex + this.searchStep + this.searchCorners.length) % this.searchCorners.length
      return
    }

    this.headingToCenter = true
  }

  private acquireSearchTarget(
    enemy: AnimatedEnemy,
    enemyPosition: THREE.Vector3,
    context: ActorUpdateContext,
  ): 'player' | 'objective' | null {
    const dx = context.playerPosition.x - enemyPosition.x
    const dz = context.playerPosition.z - enemyPosition.z
    const playerDistanceSq = dx * dx + dz * dz
    const objectiveDx = context.objectivePosition.x - enemyPosition.x
    const objectiveDz = context.objectivePosition.z - enemyPosition.z
    const objectiveDistanceSq = objectiveDx * objectiveDx + objectiveDz * objectiveDz
    const observerForward = enemy.getForwardDirection()
    const seesPlayer = canSeeTarget({
      observerPosition: enemyPosition,
      observerForward,
      target: {
        position: context.playerPosition,
        radius: PLAYER_BODY_RADIUS,
      },
      range: this.visionRange,
      coneAngleDegrees: this.visionConeAngleDegrees,
      blockers: context.visionBlockers,
    })
    const seesObjective = canSeeTarget({
      observerPosition: enemyPosition,
      observerForward,
      target: {
        position: context.objectivePosition,
        radius: context.objectiveRadius,
      },
      range: this.visionRange,
      coneAngleDegrees: this.visionConeAngleDegrees,
      blockers: context.visionBlockers,
    })

    if (seesPlayer && seesObjective) {
      return playerDistanceSq <= objectiveDistanceSq ? 'player' : 'objective'
    }

    if (seesPlayer) {
      return 'player'
    }

    if (seesObjective) {
      return 'objective'
    }

    return null
  }

  update(enemy: AnimatedEnemy, dt: number, context: ActorUpdateContext): void {
    this.initializeSearch(enemy, context)

    const enemyPosition = enemy.getPosition()
    const playerDx = context.playerPosition.x - enemyPosition.x
    const playerDz = context.playerPosition.z - enemyPosition.z
    const playerDistanceSq = playerDx * playerDx + playerDz * playerDz
    const objectiveDx = context.objectivePosition.x - enemyPosition.x
    const objectiveDz = context.objectivePosition.z - enemyPosition.z
    const objectiveDistanceSq = objectiveDx * objectiveDx + objectiveDz * objectiveDz

    if (this.activeTarget === 'player' && !this.forcedPlayerAggro && playerDistanceSq > this.disengageRangeSq) {
      this.activeTarget = 'search'
    } else if (this.activeTarget === 'objective' && objectiveDistanceSq > this.disengageRangeSq) {
      this.activeTarget = 'search'
    }

    if (this.activeTarget === 'search') {
      const acquiredTarget = this.acquireSearchTarget(enemy, enemyPosition, context)
      if (acquiredTarget) {
        this.activeTarget = acquiredTarget
        this.forcedPlayerAggro = false
      }
    }

    if (this.activeTarget === 'player') {
      enemy.setFocusTarget('player')
      this.playerTarget.set(context.playerPosition.x, 0, context.playerPosition.z)
      enemy.moveToward(this.playerTarget, dt, this.playerContactRadius)
      return
    }

    if (this.activeTarget === 'objective') {
      enemy.setFocusTarget('objective')
      this.objectiveTarget.set(context.objectivePosition.x, 0, context.objectivePosition.z)
      enemy.moveToward(this.objectiveTarget, dt, context.objectiveRadius)
      return
    }

    enemy.setFocusTarget('none')
    const searchTarget = this.getSearchTarget()
    if (enemy.moveToward(searchTarget, dt, SEARCH_STOP_DISTANCE)) {
      this.advanceSearchTarget()
    }
  }

  onPlayerShotHit(_enemy: AnimatedEnemy, _playerPosition: THREE.Vector3): void {
    this.activeTarget = 'player'
    this.forcedPlayerAggro = true
  }
}

export function createEnemyBehavior(
  origin: { x: number; z: number },
  config: EnemySpawnBehaviorConfig,
  enemyConfig?: EnemyArchetype,
): EnemyBehavior {
  switch (config.type) {
    case 'idle':
      return new IdleBehavior()
    case 'patrol':
      return new PatrolBehavior(origin, config.distance ?? 8)
    case 'strafe':
      return new StrafeBehavior(origin, config.distance ?? 6, config.headingDegrees ?? 0)
    case 'seekObjective':
      if (!enemyConfig) {
        throw new Error('seekObjective behavior requires an enemy archetype')
      }
      return new SeekObjectiveBehavior(origin, enemyConfig)
  }
}
