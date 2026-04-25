import type { EnemyArchetype } from './enemyTypes'

const ENEMY_BODY_RADIUS = 0.03

export const enemyRegistry: Record<string, EnemyArchetype> = {
  roboScout: {
    id: 'roboScout',
    health: 100,
    moveSpeed: 2.8,
    height: 0.1281,
    hitRadius: 0.06,
    knockbackDamping: 5,
    bodyRadius: ENEMY_BODY_RADIUS,
    aggroRange: 10,
    disengageRange: 14,
    playerContactRadius: 1.5,
    playerContactDamage: 8,
    playerContactCooldownSeconds: 0.8,
    objectiveContactDamage: 8,
    objectiveContactCooldownSeconds: 0.8,
    model: {
      modelPath: '/tiny-shooter/robo-enemy-1.glb',
      idleAnimation: 'CharacterArmature|Idle',
      walkAnimation: 'CharacterArmature|Walk',
      deathAnimation: 'CharacterArmature|Death',
      visualScaleCorrection: 32.1,
      visualFootContactOffset: 0,
      useDirectScene: true,
    },
  },
  heavyBot: {
    id: 'heavyBot',
    health: 80,
    moveSpeed: 2.1,
    height: 0.1281,
    hitRadius: 0.06,
    knockbackDamping: 4.2,
    bodyRadius: ENEMY_BODY_RADIUS,
    aggroRange: 9,
    disengageRange: 12,
    playerContactRadius: 1.5,
    playerContactDamage: 12,
    playerContactCooldownSeconds: 1,
    objectiveContactDamage: 12,
    objectiveContactCooldownSeconds: 1,
    model: {
      modelPath: '/tiny-shooter/robot-enemy-2.glb',
      idleAnimation: 'CharacterArmature|Idle',
      walkAnimation: 'CharacterArmature|Walk',
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
