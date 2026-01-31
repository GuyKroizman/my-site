import type { LevelConfig } from './types'

/** Seven levels. Each level has its own arena dimensions (halfX, halfZ). */
export const LEVELS: LevelConfig[] = [
  {
    halfX: 24,
    halfZ: 20,
    boxes: [
      { x: -10, z: -8, n: 3 },
      { x: 10, z: -6, n: 2 },
      { x: -6, z: 8, n: 3 },
      { x: 8, z: 10, n: 2 },
      { x: 0, z: 0, n: 2 },
      { x: -15, z: 0, n: 2 },
      { x: 14, z: -12, n: 3 },
      { x: -12, z: 14, n: 2 },
    ],
    turrets: [{ x: -8, z: -4 }],
    rolies: [{ x: 0, z: 0 }], // Center of arena
  },
  {
    halfX: 48,
    halfZ: 40,
    boxes: [
      { x: -22, z: -18, n: 12 },
      { x: -18, z: 28, n: 20 },
      { x: 26, z: -15, n: 50 },
      { x: 30, z: 25, n: 4 },
      { x: -28, z: -25, n: 9 },
      { x: 5, z: -22, n: 2 },
      { x: -25, z: 5, n: 6 },
      { x: 25, z: 28, n: 4 },
      { x: -35, z: -10, n: 4 },
      { x: 35, z: 15, n: 6 },
    ],
    turrets: [{ x: 10, z: 8 }, { x: -10, z: -8 }],
    rolies: [{ x: 30, z: 28 }, { x: -25, z: -22 }], // Spread out so player can see them before they charge
  },
  { halfX: 28, halfZ: 24, boxes: [], turrets: [] },
  { halfX: 32, halfZ: 28, boxes: [], turrets: [] },
  { halfX: 36, halfZ: 32, boxes: [], turrets: [] },
  { halfX: 40, halfZ: 36, boxes: [], turrets: [] },
  { halfX: 44, halfZ: 40, boxes: [], turrets: [] },
]
