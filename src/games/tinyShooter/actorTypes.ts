import type * as THREE from 'three'
import type { Projectile } from './gameTypes'

export interface SolidRobotSnapshot {
  id: string
  position: THREE.Vector3
  radius: number
}

export interface PlayerBlockerSnapshot {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface RadarTargetSnapshot {
  kind: 'enemy'
  position: THREE.Vector3
}

export interface ActorUpdateContext {
  playerPosition: THREE.Vector3
  objectivePosition: THREE.Vector3
  objectiveRadius: number
  arenaSize: number
  solidRobots: readonly SolidRobotSnapshot[]
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
  getSolidRobots(): readonly SolidRobotSnapshot[]
  getRadarTargets(): readonly RadarTargetSnapshot[]
  getPlayerBlockers(): readonly PlayerBlockerSnapshot[]
  dispose(): void
}
