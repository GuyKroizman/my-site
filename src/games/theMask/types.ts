/** Input state from keyboard or touch (D-Pad + Shoot) */
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

/** Arena bounds (half-extents from center). Physics walls at ±x, ±z. */
export const ARENA_HALF_X = 12
export const ARENA_HALF_Z = 10
export const FLOOR_Y = 0
