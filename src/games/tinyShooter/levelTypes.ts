import type { EnemySpawnBehaviorConfig } from './enemyTypes'

export interface BaseActorSpawnDefinition {
  position: { x: number; z: number }
}

export interface ObjectiveDefinition {
  position: { x: number; z: number }
  radius: number
  maxHealth: number
}

export interface AnimatedEnemySpawnDefinition extends BaseActorSpawnDefinition {
  kind: 'animatedEnemy'
  enemyId: string
  behavior: EnemySpawnBehaviorConfig
}

export interface GiantSpawnDefinition extends BaseActorSpawnDefinition {
  kind: 'giant'
}

export interface RobotSpawnerSpawnDefinition extends BaseActorSpawnDefinition {
  kind: 'robotSpawner'
  enemyId: string
  behavior: EnemySpawnBehaviorConfig
  releaseIntervalSeconds: number
  initialDelaySeconds: number
}

export type ActorSpawnDefinition =
  | AnimatedEnemySpawnDefinition
  | GiantSpawnDefinition
  | RobotSpawnerSpawnDefinition

export interface LevelDefinition {
  id: string
  name: string
  playerSpawn: { x: number; z: number }
  objective: ObjectiveDefinition
  arenaSize: number
  actors: ActorSpawnDefinition[]
  clearCondition: 'defeat-all' | 'survival'
  nextLevelId: string | null
}
