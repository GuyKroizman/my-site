import type { LevelConfig } from './types'
import { parseGridLevel } from './types'

/**
 * Start at this level when the game runs (0-based).
 * Change this to test a specific level, e.g. 2 for level 3.
 */
export const START_LEVEL = 0

/**
 * Grid-based level definitions.
 *
 * Characters:
 *   1-9 = box pile (number = stack height)
 *   t/T = turret
 *   r/R = rolie
 *   p/P = player spawn
 *   .   = empty
 *
 * Grid layout:
 *   - First row = back of arena (far -Z)
 *   - Last row = front of arena (near +Z)
 *   - Left column = left side (-X)
 *   - Right column = right side (+X)
 *
 * Cell size is 4 world units by default.
 */

// Level 1: Simple intro level
const LEVEL_1 = parseGridLevel(`
............
.3........2.
....t.......
.2....9.....
............
.....9999.3.
............
.3........p.
`, 4)

// Level 2: Two turrets, two rolies
const LEVEL_2 = parseGridLevel(`
....9999999...
.4..r.....9...
......t.......
.3....3....t..
..........r...
...t....9.....
.2........5.44
.........6....
.r.....94...p.
`, 4)

// Level 3: Harder level with more enemies
const LEVEL_3 = parseGridLevel(`
................
.5.r..t.....4.r.
................
.3....4.....3...
....r...........
.3..t...t...3...
................
.4....4.....4...
.r..........6...
.5.....t....5..p
`, 4)

/** All levels. Each level has its own arena dimensions derived from grid size. */
export const LEVELS: LevelConfig[] = [
  LEVEL_1,
  LEVEL_2,
  LEVEL_3,
  // Empty placeholder levels (can be converted to grid later)
  { halfX: 32, halfZ: 28, boxes: [], turrets: [] },
  { halfX: 36, halfZ: 32, boxes: [], turrets: [] },
  { halfX: 40, halfZ: 36, boxes: [], turrets: [] },
  { halfX: 44, halfZ: 40, boxes: [], turrets: [] },
]
