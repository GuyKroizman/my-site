import type { EnemySpawnBehaviorConfig } from './enemyTypes'

export interface BaseActorSpawnDefinition {
  position: { x: number; z: number }
}

export interface AnimatedEnemySpawnDefinition extends BaseActorSpawnDefinition {
  kind: 'animatedEnemy'
  enemyId: string
  behavior: EnemySpawnBehaviorConfig
}

export interface GiantSpawnDefinition extends BaseActorSpawnDefinition {
  kind: 'giant'
}

export type ActorSpawnDefinition = AnimatedEnemySpawnDefinition | GiantSpawnDefinition

export interface LevelDefinition {
  id: string
  name: string
  playerSpawn: { x: number; z: number }
  arenaSize: number
  actors: ActorSpawnDefinition[]
  clearCondition: 'defeat-all'
  nextLevelId: string | null
}
