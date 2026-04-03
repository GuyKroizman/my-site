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

export type GroundCoverStyle =
  | 'texture'
  | 'grassTufts'

export interface BallDropConfig {
  dropTime: number  // seconds after race start to drop the ball
  x?: number        // optional X position (random on track if omitted)
  y?: number        // optional drop height (defaults to 15 if omitted)
  z?: number        // optional Z position (random on track if omitted)
}

export interface LevelConfig {
  id: number
  name: string // e.g., "Beginner's Oval"
  description: string
  cars: CarConfig[]
  winCondition: WinCondition
  requiredLaps: number
  /** Ground/grass theme for this level. Defaults to 'grass' if omitted. */
  groundTheme?: GroundTheme
  /** How the off-track ground is rendered. Defaults to 'texture' if omitted. */
  groundCoverStyle?: GroundCoverStyle
  /** Optional 80×60 grid: 60 strings, each up to 80 chars. Space = empty; other chars map via DECORATION_MODELS. */
  decorationRows?: string[]
  /** Ball drops during the race. Each entry spawns a ball at the configured time. */
  ballDrops?: BallDropConfig[]
}
