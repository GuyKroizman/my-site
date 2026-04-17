import type * as CANNON from 'cannon-es'
import type * as THREE from 'three'

export const GROUND_SIZE = 200
export const PLAYER_HEIGHT = 1.7
export const PLAYER_MASS = 80
export const PLAYER_SPEED = 8
export const PHYSICS_DT = 1 / 60
export const PHYSICS_SUBSTEPS = 3
export const PROJECTILE_SPEED = 120
export const PROJECTILE_RADIUS = 1
export const PROJECTILE_LENGTH = 20.0
export const PROJECTILE_LIFETIME = 8
export const MAX_PROJECTILES = 50
export const SHOOT_COOLDOWN = 0.5
export const MOUSE_SENSITIVITY = 0.002
export const GAMEPAD_DEADZONE = 0.2
export const GAMEPAD_LOOK_SPEED = 0.06

export const GIANT_HEIGHT = 34
export const GIANT_WALK_SPEED = 3
export const GIANT_WANDER_INTERVAL = 4
export const GIANT_AGGRO_RANGE = 50
export const GIANT_CHASE_SPEED = 5
export const GIANT_DAMAGE = 10
export const GIANT_DAMAGE_COOLDOWN = 1

export const ROBO_ENEMY_HEALTH = 100
export const ROBO_ENEMY_PATROL_SPEED = 2.5
export const ROBO_ENEMY_PATROL_DISTANCE = 10
export const ROBO_ENEMY_HEIGHT = 3.2
export const ROBO_ENEMY_HIT_RADIUS = 1.5
export const ROBO_ENEMY_KNOCKBACK_DAMPING = 5
export const ENEMY_BODY_RADIUS = 0.75

export interface EnemyModelConfig {
  modelPath: string
  walkAnimation: string
  deathAnimation: string
  visualScaleCorrection: number
  visualFootContactOffset: number
  useDirectScene?: boolean
  forceOpaqueMaterials?: boolean
}

export interface EnemyConfig {
  health: number
  patrolSpeed: number
  patrolDistance: number
  height: number
  hitRadius: number
  knockbackDamping: number
  bodyRadius: number
  model: EnemyModelConfig
}

export interface WeaponStats {
  damage: number
  knockback: number
  projectileSpeed: number
}

export const CURRENT_WEAPON: WeaponStats = {
  damage: 45,
  knockback: 16,
  projectileSpeed: PROJECTILE_SPEED,
}

export const PLAYER_MAX_HEALTH = 100

export interface Projectile {
  mesh: THREE.Mesh
  body: CANNON.Body
  createdAt: number
  damage: number
  knockback: number
}
