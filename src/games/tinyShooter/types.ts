import type * as CANNON from 'cannon-es'
import type * as THREE from 'three'

export const GROUND_SIZE = 200
export const PLAYER_HEIGHT = 1.7
export const PLAYER_MASS = 80
export const PLAYER_SPEED = 8
export const PHYSICS_DT = 1 / 60
export const PHYSICS_SUBSTEPS = 3
export const PROJECTILE_SPEED = 50
export const PROJECTILE_RADIUS = 0.05
export const PROJECTILE_LENGTH = 0.6
export const PROJECTILE_LIFETIME = 5
export const MAX_PROJECTILES = 50
export const SHOOT_COOLDOWN = 0.15
export const MOUSE_SENSITIVITY = 0.002

export interface Projectile {
  mesh: THREE.Mesh
  body: CANNON.Body
  createdAt: number
}
