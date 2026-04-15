import {
  ENEMY_BODY_RADIUS,
  ROBO_ENEMY_HEALTH,
  ROBO_ENEMY_PATROL_SPEED,
  ROBO_ENEMY_PATROL_DISTANCE,
  ROBO_ENEMY_HEIGHT,
  ROBO_ENEMY_HIT_RADIUS,
  ROBO_ENEMY_KNOCKBACK_DAMPING,
} from './types'
import type { EnemyConfig } from './types'

export const roboEnemyConfig: EnemyConfig = {
  health: ROBO_ENEMY_HEALTH,
  patrolSpeed: ROBO_ENEMY_PATROL_SPEED,
  patrolDistance: ROBO_ENEMY_PATROL_DISTANCE,
  height: ROBO_ENEMY_HEIGHT,
  hitRadius: ROBO_ENEMY_HIT_RADIUS,
  knockbackDamping: ROBO_ENEMY_KNOCKBACK_DAMPING,
  bodyRadius: ENEMY_BODY_RADIUS,
  model: {
    modelPath: '/tiny-shooter/robo-enemy-1.glb',
    walkAnimation: 'CharacterArmature|Walk',
    deathAnimation: 'CharacterArmature|Death',
    visualScaleCorrection: 800,
    visualFootContactOffset: 1130,
  },
}

export const robotEnemy2Config: EnemyConfig = {
  health: 80,
  patrolSpeed: 3.4,
  patrolDistance: 7,
  height: 3.4,
  hitRadius: 1.4,
  knockbackDamping: 4.2,
  bodyRadius: ENEMY_BODY_RADIUS,
  model: {
    modelPath: '/tiny-shooter/robot-enemy-2.glb',
    walkAnimation: 'CharacterArmature|Walk',
    deathAnimation: 'CharacterArmature|Dead',
    visualScaleCorrection: 800,
    visualFootContactOffset: 1130,
    forceOpaqueMaterials: true,
  },
}
