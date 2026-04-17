import type * as CANNON from 'cannon-es'
import type * as THREE from 'three'
import type { GamepadStatus } from './InputManager'

export type TinyShooterPhase = 'playing' | 'level-complete' | 'victory' | 'game-over'

export interface Projectile {
  mesh: THREE.Mesh
  body: CANNON.Body
  createdAt: number
  damage: number
  knockback: number
}

export interface TinyShooterGameState {
  phase: TinyShooterPhase
  health: number
  pointerLocked: boolean
  gamepadStatus: GamepadStatus
  currentLevelId: string
  currentLevelName: string
  levelComplete: boolean
  victory: boolean
}
