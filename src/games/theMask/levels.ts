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

// Level 4: Maze with turrets
const LEVEL_4 = parseGridLevel(`
..................
.9999.....9999....
.9..........9.t...
.9..t...........r.
.9..........9.....
.9999...r...9999..
..........t.......
.3..r.........3...
..................
.4............4..p
`, 4)

// Level 5: Rolie gauntlet
const LEVEL_5 = parseGridLevel(`
....................
.5.r....r....r....5.
....................
.3..t........t....3.
....................
.4.r....r....r....4.
....................
.3..t........t....3.
....................
.5.r....r....r....5.
....................
.6................p.
`, 4)

// Level 6: Heavy turret defense
const LEVEL_6 = parseGridLevel(`
......................
.9999..t..t..t..9999..
.9..................9.
.9..r..........r....9.
.9..................9.
....t....99....t......
.9..................9.
.9..r..........r....9.
.9..................9.
.9999..t..t..t..9999..
......................
.5..................p.
`, 4)

// Level 7: Final challenge
const LEVEL_7 = parseGridLevel(`
........................
.99999..t..t..t..99999..
.9....................9.
.9..r..t......t..r....9.
.9....................9.
.9....r........r......9.
......t...99...t........
.9....r........r......9.
.9....................9.
.9..r..t......t..r....9.
.9....................9.
.99999..t..t..t..99999..
........................
.6....................p.
`, 4)

/** All levels. Each level has its own arena dimensions derived from grid size. */
export const LEVELS: LevelConfig[] = [
  LEVEL_1,
  LEVEL_2,
  LEVEL_3,
  LEVEL_4,
  LEVEL_5,
  LEVEL_6,
  LEVEL_7,
]
