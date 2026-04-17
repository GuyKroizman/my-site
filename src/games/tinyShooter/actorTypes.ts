import type * as THREE from 'three'
import type { Projectile } from './gameTypes'

export interface ActorUpdateContext {
  playerPosition: THREE.Vector3
  arenaSize: number
}

export interface PlayerContactEffect {
  damage: number
  cooldownSeconds: number
}

export interface LevelActor {
  readonly isAlive: boolean
  update(dt: number, context: ActorUpdateContext): void
  collectProjectileHits(projectiles: Projectile[]): number[]
  getPlayerContactEffect(playerPosition: THREE.Vector3): PlayerContactEffect | null
  dispose(): void
}
