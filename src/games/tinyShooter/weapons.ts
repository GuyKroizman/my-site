import { PROJECTILE_SPEED } from './constants'

export interface WeaponStats {
  damage: number
  knockback: number
  projectileSpeed: number
}

export const DEFAULT_WEAPON: WeaponStats = {
  damage: 45,
  knockback: 16,
  projectileSpeed: PROJECTILE_SPEED,
}
