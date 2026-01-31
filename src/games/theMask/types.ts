/** Input state from keyboard (arrows/WASD + Space) */
export interface InputState {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  shoot: boolean
}

export const DEFAULT_INPUT_STATE: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  shoot: false,
}

/** Mobile touch input: joystick = move, aim = shoot direction (when held, shoot in that direction) */
export interface TouchInputState {
  joystick: { x: number; y: number }
  aim: { x: number; y: number }
}

export const DEFAULT_TOUCH_INPUT_STATE: TouchInputState = {
  joystick: { x: 0, y: 0 },
  aim: { x: 0, y: 0 },
}

/** Default arena half-extents; used only as fallback for optional params (e.g. Player.clampToArena). Level dimensions are the source of truth. */
export const ARENA_HALF_X = 24
export const ARENA_HALF_Z = 20
export const FLOOR_Y = 0

/** Single pile: x,z = position, n = number of boxes stacked. */
export interface BoxPileConfig {
  x: number
  z: number
  n: number
}

/** Turret spawn position. */
export interface TurretConfig {
  x: number
  z: number
}

/** Rolie (exploding enemy) spawn position. */
export interface RolieConfig {
  x: number
  z: number
}

/** Level definition: boxes, turrets, rolies, and arena size (half-extents). Every level defines its own dimensions. */
export interface LevelConfig {
  boxes: BoxPileConfig[]
  turrets: TurretConfig[]
  /** Rolie enemies (wander then charge and explode). Default [] if omitted. */
  rolies?: RolieConfig[]
  /** Arena half-width (X). */
  halfX: number
  /** Arena half-depth (Z). */
  halfZ: number
  /** Player spawn position (optional; defaults to corner if not set). */
  playerStart?: { x: number; z: number }
}

/**
 * Parse an ASCII grid into a LevelConfig.
 *
 * Grid characters:
 * - `1-9` = box pile with that many boxes
 * - `t` or `T` = turret
 * - `r` or `R` = rolie
 * - `p` or `P` = player spawn
 * - `.` or space = empty
 *
 * @param grid Multi-line string. First row is far-Z (back of arena), last row is near-Z (front).
 *             Columns map left-to-right as -X to +X.
 * @param cellSize World units per grid cell (default 4).
 */
export function parseGridLevel(grid: string, cellSize = 4): LevelConfig {
  const rows = grid.split('\n').filter((line) => line.trim().length > 0)
  const numRows = rows.length
  const numCols = Math.max(...rows.map((r) => r.length))

  const halfX = (numCols * cellSize) / 2
  const halfZ = (numRows * cellSize) / 2

  const boxes: BoxPileConfig[] = []
  const turrets: TurretConfig[] = []
  const rolies: RolieConfig[] = []
  let playerStart: { x: number; z: number } | undefined

  for (let row = 0; row < numRows; row++) {
    const line = rows[row]
    for (let col = 0; col < line.length; col++) {
      const char = line[col]
      // Map grid position to world coordinates:
      // col 0 = left edge (-halfX + cellSize/2), col max = right edge
      // row 0 = back (-halfZ + cellSize/2), row max = front
      const x = -halfX + cellSize / 2 + col * cellSize
      const z = -halfZ + cellSize / 2 + row * cellSize

      if (char >= '1' && char <= '9') {
        boxes.push({ x, z, n: parseInt(char, 10) })
      } else if (char === 't' || char === 'T') {
        turrets.push({ x, z })
      } else if (char === 'r' || char === 'R') {
        rolies.push({ x, z })
      } else if (char === 'p' || char === 'P') {
        playerStart = { x, z }
      }
      // '.' or ' ' or any other char = empty
    }
  }

  return { halfX, halfZ, boxes, turrets, rolies, playerStart }
}
