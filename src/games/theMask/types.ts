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

/** Arena bounds (half-extents from center). Physics walls at ±x, ±z. 4x area = 2x linear. */
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

/** Level definition: boxes and turrets. */
export interface LevelConfig {
  boxes: BoxPileConfig[]
  turrets: TurretConfig[]
}
