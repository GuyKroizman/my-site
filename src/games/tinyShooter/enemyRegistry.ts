import type { EnemyArchetype } from './enemyTypes'

const ENEMY_BODY_RADIUS = 0.75

export const enemyRegistry: Record<string, EnemyArchetype> = {
  roboScout: {
    id: 'roboScout',
    health: 100,
    moveSpeed: 2.5,
    height: 3.2,
    hitRadius: 1.5,
    knockbackDamping: 5,
    bodyRadius: ENEMY_BODY_RADIUS,
    model: {
      modelPath: '/tiny-shooter/robo-enemy-1.glb',
      walkAnimation: 'CharacterArmature|Walk',
      deathAnimation: 'CharacterArmature|Death',
      visualScaleCorrection: 800,
      visualFootContactOffset: 1130,
    },
  },
  heavyBot: {
    id: 'heavyBot',
    health: 80,
    moveSpeed: 3.4,
    height: 3.4,
    hitRadius: 1.4,
    knockbackDamping: 4.2,
    bodyRadius: ENEMY_BODY_RADIUS,
    model: {
      modelPath: '/tiny-shooter/robot-enemy-2.glb',
      walkAnimation: 'CharacterArmature|Walk',
      deathAnimation: 'CharacterArmature|Dead',
      visualScaleCorrection: 60,
      visualFootContactOffset: 85,
      forceOpaqueMaterials: true,
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
