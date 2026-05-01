import type * as THREE from 'three'
import type * as CANNON from 'cannon-es'
import { AnimatedEnemy } from './AnimatedEnemy'
import { Giant } from './Giant'
import { RobotSpawner } from './RobotSpawner'
import type { SpawnBoxHitSound } from './SpawnBoxHitSound'
import { createEnemyBehavior } from './enemyBehaviors'
import { getEnemyArchetype } from './enemyRegistry'
import type { LevelActor } from './actorTypes'
import type { ActorSpawnDefinition } from './levelTypes'

export interface LevelActorDependencies {
  spawnBoxHitSound: SpawnBoxHitSound
}

export function createLevelActor(
  spawn: ActorSpawnDefinition,
  world: CANNON.World,
  scene: THREE.Scene,
  dependencies: LevelActorDependencies,
): LevelActor {
  if (spawn.kind === 'giant') {
    return new Giant(world, scene, spawn.position)
  }

  if (spawn.kind === 'robotSpawner') {
    return new RobotSpawner(world, scene, spawn, dependencies.spawnBoxHitSound)
  }

  const archetype = getEnemyArchetype(spawn.enemyId)
  return new AnimatedEnemy(
    world,
    scene,
    spawn.position,
    archetype,
    createEnemyBehavior(spawn.position, spawn.behavior, archetype),
  )
}
