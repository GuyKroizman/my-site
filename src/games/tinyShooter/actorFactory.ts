import type * as THREE from 'three'
import type * as CANNON from 'cannon-es'
import { AnimatedEnemy } from './AnimatedEnemy'
import { Giant } from './Giant'
import { createEnemyBehavior } from './enemyBehaviors'
import { getEnemyArchetype } from './enemyRegistry'
import type { LevelActor } from './actorTypes'
import type { ActorSpawnDefinition } from './levelTypes'

export function createLevelActor(
  spawn: ActorSpawnDefinition,
  world: CANNON.World,
  scene: THREE.Scene,
): LevelActor {
  if (spawn.kind === 'giant') {
    return new Giant(world, scene, spawn.position)
  }

  const archetype = getEnemyArchetype(spawn.enemyId)
  return new AnimatedEnemy(
    world,
    scene,
    spawn.position,
    archetype,
    createEnemyBehavior(spawn.position, spawn.behavior),
  )
}
