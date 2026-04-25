import * as THREE from 'three'
import type { AnimatedEnemy } from './AnimatedEnemy'
import type { ActorUpdateContext } from './actorTypes'
import type { EnemyArchetype, EnemySpawnBehaviorConfig } from './enemyTypes'

export interface EnemyBehavior {
  update(enemy: AnimatedEnemy, dt: number, context: ActorUpdateContext): void
}

export class IdleBehavior implements EnemyBehavior {
  update(enemy: AnimatedEnemy, _dt: number, _context: ActorUpdateContext): void {
    enemy.setFocusTarget('objective')
  }
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
}

export class SeekObjectiveBehavior implements EnemyBehavior {
  private readonly playerTarget = new THREE.Vector3()
  private readonly objectiveTarget = new THREE.Vector3()
  private readonly aggroRangeSq: number
  private readonly disengageRangeSq: number
  private readonly playerContactRadius: number
  private chasingPlayer = false

  constructor(config: EnemyArchetype) {
    this.aggroRangeSq = config.aggroRange * config.aggroRange
    this.disengageRangeSq = config.disengageRange * config.disengageRange
    this.playerContactRadius = config.playerContactRadius
  }

  update(enemy: AnimatedEnemy, dt: number, context: ActorUpdateContext): void {
    const enemyPosition = enemy.getPosition()
    const dx = context.playerPosition.x - enemyPosition.x
    const dz = context.playerPosition.z - enemyPosition.z
    const playerDistanceSq = dx * dx + dz * dz

    if (this.chasingPlayer) {
      this.chasingPlayer = playerDistanceSq <= this.disengageRangeSq
    } else {
      this.chasingPlayer = playerDistanceSq <= this.aggroRangeSq
    }

    if (this.chasingPlayer) {
      enemy.setFocusTarget('player')
      this.playerTarget.set(context.playerPosition.x, 0, context.playerPosition.z)
      enemy.moveToward(this.playerTarget, dt, this.playerContactRadius)
      return
    }

    enemy.setFocusTarget('objective')
    this.objectiveTarget.set(context.objectivePosition.x, 0, context.objectivePosition.z)
    enemy.moveToward(this.objectiveTarget, dt, context.objectiveRadius)
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
      return new SeekObjectiveBehavior(enemyConfig)
  }
}
