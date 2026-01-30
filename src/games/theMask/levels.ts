import type { LevelConfig } from './types'

/** Seven levels. Level 1 has current-style boxes + one turret; others are placeholders for later design. */
export const LEVELS: LevelConfig[] = [
  {
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
  },
  { boxes: [], turrets: [] },
  { boxes: [], turrets: [] },
  { boxes: [], turrets: [] },
  { boxes: [], turrets: [] },
  { boxes: [], turrets: [] },
  { boxes: [], turrets: [] },
]
