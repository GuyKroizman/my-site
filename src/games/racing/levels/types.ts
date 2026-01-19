import { CarCharacteristics } from '../Car'

export interface CarConfig {
  x: number
  z: number
  color: number
  name: string
  isPlayer: boolean
  characteristics: CarCharacteristics
}

export interface WinCondition {
  // Player must finish in this position or better to advance (1 = first, 2 = top 2, 3 = top 3)
  maxPosition: number
}

export interface LevelConfig {
  id: number
  name: string // e.g., "Beginner's Oval"
  description: string
  cars: CarConfig[]
  winCondition: WinCondition
  requiredLaps: number
}
