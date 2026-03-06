import { CarCharacteristics } from '../Car'

export interface CarConfig {
  x: number
  z: number
  color: number
  name: string
  isPlayer: boolean
  characteristics: CarCharacteristics
  modelPath?: string
}

export interface WinCondition {
  // Player must finish in this position or better to advance (1 = first, 2 = top 2, 3 = top 3)
  maxPosition: number
}

/** Ground/grass visual theme for the level (off-track and infield). */
export type GroundTheme =
  | 'grass'      // default green
  | 'dry'        // yellow-brown dry grass
  | 'sand'       // sandy desert
  | 'snow'       // white/grey snow
  | 'dirt'       // brown dirt
  | 'autumn'     // orange/rust autumn grass

export interface LevelConfig {
  id: number
  name: string // e.g., "Beginner's Oval"
  description: string
  cars: CarConfig[]
  winCondition: WinCondition
  requiredLaps: number
  /** Ground/grass theme for this level. Defaults to 'grass' if omitted. */
  groundTheme?: GroundTheme
  /** Optional 80×60 grid: 60 strings, each up to 80 chars. Space = empty; other chars map via DECORATION_MODELS. */
  decorationRows?: string[]
}
