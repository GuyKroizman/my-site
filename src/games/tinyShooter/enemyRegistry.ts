import type { EnemyArchetype } from './enemyTypes'

const ENEMY_BODY_RADIUS = 0.03

export const enemyRegistry: Record<string, EnemyArchetype> = {
  roboScout: {
    id: 'roboScout',
    health: 100,
    moveSpeed: 0,
    height: 0.1281,
    hitRadius: 0.06,
    knockbackDamping: 5,
    bodyRadius: ENEMY_BODY_RADIUS,
    model: {
      modelPath: '/tiny-shooter/robo-enemy-1.glb',
      walkAnimation: 'CharacterArmature|Idle',
      deathAnimation: 'CharacterArmature|Death',
      visualScaleCorrection: 32.1,
      visualFootContactOffset: 0,
      useDirectScene: true,
    },
  },
  heavyBot: {
    id: 'heavyBot',
    health: 80,
    moveSpeed: 0,
    height: 0.1281,
    hitRadius: 0.06,
    knockbackDamping: 4.2,
    bodyRadius: ENEMY_BODY_RADIUS,
    model: {
      modelPath: '/tiny-shooter/robot-enemy-2.glb',
      walkAnimation: 'CharacterArmature|Idle',
      deathAnimation: 'CharacterArmature|Dead',
      visualScaleCorrection: 21.5,
      visualFootContactOffset: 0,
      useDirectScene: true,
    },
  },
}

export function getEnemyArchetype(enemyId: string): EnemyArchetype {
  const archetype = enemyRegistry[enemyId]
  if (!archetype) {
    throw new Error(`Unknown Tiny Shooter enemy archetype: ${enemyId}`)
  }

  return archetype
}
