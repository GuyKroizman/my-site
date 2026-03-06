/** World bounds for the decoration grid (same for all levels). Grid 80×60 maps onto this rectangle. */
export const DECORATION_BOUNDS = {
  minX: -50,
  maxX: 50,
  minZ: -40,
  maxZ: 40
}

export interface DecorationModelConfig {
  path: string
  scale?: number
  rotation?: number
}

/** Character key → model config. Used by all levels; decoration grid rows reference these keys. */
export const DECORATION_MODELS: Record<string, DecorationModelConfig> = {
  p: { path: '/racing/models/Plant.glb', scale: 4 },
  m: { path: '/racing/models/Mushroom.glb', scale: 8, rotation: 0 }
}
