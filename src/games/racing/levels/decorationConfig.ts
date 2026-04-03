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

/** Position offset in world units, applied on top of the grid cell center. For fine-tuning placement. */
export interface DecorationPosition {
  x?: number
  y?: number
  z?: number
}

export interface DecorationModelConfig {
  path: string
  scale?: number
  /** Rotation in radians. Use a number for Y-only (legacy), or { x, y, z } for per-axis. */
  rotation?: number | DecorationRotation
  /** Offset from grid cell center (world units). Use to fine-tune position. */
  position?: DecorationPosition
}

/** Character key → model config. Used by all levels; decoration grid rows reference these keys. */
export const DECORATION_MODELS: Record<string, DecorationModelConfig> = {
  p: { path: '/racing/models/Plant.glb', scale: 4 },
  m: { path: '/racing/models/Mushroom.glb', scale: 8, rotation: 0 },
  d: { path: '/racing/models/mushroom_dude.glb', scale: 14, rotation: { z: Math.PI / 2 }, position: { y: 0.5 } },
  t: { path: '/racing/models/trees.glb', scale: 18, position: { x: -140 } },
  r: { path: '/racing/models/Rock Large.glb', scale: 10 }
}
