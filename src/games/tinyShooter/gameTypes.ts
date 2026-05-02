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
  previousPosition: THREE.Vector3
}

export interface RadarBlip {
  kind: 'objective' | 'enemy'
  x: number
  y: number
}

export interface RadarSnapshot {
  range: number
  blips: RadarBlip[]
}

export interface TinyShooterGameState {
  phase: TinyShooterPhase
  health: number
  objectiveHealth: number
  objectiveMaxHealth: number
  gameOverReason: 'player-dead' | 'objective-destroyed' | null
  pointerLocked: boolean
  gamepadStatus: GamepadStatus
  currentLevelId: string
  currentLevelName: string
  levelComplete: boolean
  victory: boolean
}
