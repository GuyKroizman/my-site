import type * as THREE from 'three'
import type { Projectile } from './gameTypes'

export interface ActorUpdateContext {
  playerPosition: THREE.Vector3
  objectivePosition: THREE.Vector3
  objectiveRadius: number
  arenaSize: number
}

export interface PlayerContactEffect {
  damage: number
  cooldownSeconds: number
}

export interface ObjectiveContactEffect {
  damage: number
  cooldownSeconds: number
}

export interface LevelActor {
  readonly isAlive: boolean
  update(dt: number, context: ActorUpdateContext): void
  collectProjectileHits(projectiles: Projectile[]): number[]
  getPlayerContactEffect(playerPosition: THREE.Vector3): PlayerContactEffect | null
  getObjectiveContactEffect(objectivePosition: THREE.Vector3): ObjectiveContactEffect | null
  dispose(): void
}
