/** World bounds for the decoration grid (same for all levels). Grid 80×60 maps onto this rectangle. */
export const DECORATION_BOUNDS = {
  minX: -50,
  maxX: 50,
  minZ: -40,
  maxZ: 40
}

/** Rotation in radians. Each axis is optional. */
export interface DecorationRotation {
  x?: number
  y?: number
  z?: number
}

export interface DecorationModelConfig {
  path: string
  scale?: number
  /** Rotation in radians. Use a number for Y-only (legacy), or { x, y, z } for per-axis. */
  rotation?: number | DecorationRotation
}

/** Character key → model config. Used by all levels; decoration grid rows reference these keys. */
export const DECORATION_MODELS: Record<string, DecorationModelConfig> = {
  p: { path: '/racing/models/Plant.glb', scale: 4 },
  m: { path: '/racing/models/Mushroom.glb', scale: 8, rotation: 0 },
  d: { path: '/racing/models/mushroom_dude.glb', scale: 12, rotation: { z: Math.PI / 2 } }
}
