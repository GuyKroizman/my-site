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
}
