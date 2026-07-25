export interface LevelObject {
  type: string
  scale?: number
  rotation?: number
  offsetX?: number
  offsetY?: number
  flipX?: boolean
  tint?: number
}

export type LevelCell = LevelObject[] | null
export type LevelLayer = LevelCell[][]

export interface LevelData {
  cellSize: number
  rows: number
  cols: number
  layers: Record<string, LevelLayer>
}

export function emptyLayer(rows: number, cols: number): LevelLayer {
  return Array.from({ length: rows }, () => Array(cols).fill(null))
}

export function addObject(
  layer: LevelLayer,
  row: number,
  col: number,
  obj: LevelObject
) {
  if (row < 0 || row >= layer.length || col < 0 || col >= layer[0].length) return
  if (!layer[row][col]) layer[row][col] = []
  layer[row][col]!.push(obj)
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Season zones by column (157 cols @ 64px = ~10,048px world)
// Evenly split into four ~2500px bands so each season covers a quarter of the journey.
// Switch points: 0→Spring, 2560→Summer, 4992→Autumn, 7552→Winter
const SEASON_ZONES = [
  { startCol: 0, endCol: 39, season: 'spring' as const },
  { startCol: 40, endCol: 78, season: 'summer' as const },
  { startCol: 79, endCol: 117, season: 'autumn' as const },
  { startCol: 118, endCol: 156, season: 'winter' as const },
]

function getSeason(col: number): 'spring' | 'summer' | 'autumn' | 'winter' {
  for (const z of SEASON_ZONES) {
    if (col >= z.startCol && col <= z.endCol) return z.season
  }
  return 'spring'
}

/** Boundary columns where seasons switch. Large objects are kept away from these
 *  so a tree from one zone doesn't visually spill into the next. */
const BOUNDARY_COLS = [39, 78, 117]
const BOUNDARY_BUFFER = 4

function isNearBoundary(col: number): boolean {
  return BOUNDARY_COLS.some((b) => Math.abs(col - b) <= BOUNDARY_BUFFER)
}

const ASSETS: Record<
  'spring' | 'summer' | 'autumn' | 'winter',
  Record<string, string[]>
> = {
  spring: {
    grass: ['grass-1', 'grass-2', 'grass-3', 'grass-4'],
    rock: ['rock-1', 'rock-2', 'rock-3', 'rock-4'],
    tree: ['tree-blossom-1', 'tree-blossom-2', 'tree-blossom-3'],
    bush: ['bush-flowers-1', 'bush-flowers-2', 'bush-flowers-3', 'bush-flowers-4'],
    prop: ['flowers-1', 'flowers-2', 'flowers-3', 'flowers-4'],
    background: ['tree-blossom-1', 'tree-blossom-2', 'tree-blossom-3'],
  },
  summer: {
    grass: ['grass-gold-1', 'grass-gold-2', 'grass-gold-3', 'grass-gold-4'],
    rock: ['rock-yellow-1', 'rock-yellow-2', 'rock-yellow-3', 'rock-yellow-4'],
    tree: ['tree-green-1', 'tree-green-3'],
    bush: ['wheat-bush-small', 'wheat-bush-medium', 'wheat-bush-large'],
    prop: ['wheat-sheaf-small', 'wheat-sheaf-medium', 'wheat-sheaf-large', 'corn-stalk-bottom-small'],
    background: ['tree-green-1', 'tree-green-3'],
  },
  autumn: {
    grass: ['grass-autumn-1', 'grass-autumn-3', 'grass-autumn-4'],
    rock: ['rock-moss-1', 'rock-moss-2', 'rock-moss-4'],
    tree: ['tree-autumn-small', 'tree-autumn-large', 'tree-autumn-bare'],
    bush: ['bush-autumn-1', 'bush-autumn-2', 'grass-wheat-autumn'],
    prop: ['leaf-pile', 'leaves-scattered'],
    background: ['tree-autumn-small', 'tree-autumn-large', 'tree-autumn-bare'],
  },
  winter: {
    grass: ['grass-ice-1', 'grass-ice-2'],
    rock: ['rock-snow-1'],
    tree: ['tree-pine-small', 'tree-pine-medium', 'tree-pine-large'],
    bush: ['branches-bare', 'bush-thorny-ice'],
    prop: [],
    background: ['tree-pine-small', 'tree-pine-medium', 'tree-pine-large'],
  },
}

function fillGroundLayer(layer: LevelLayer) {
  const cols = layer[0].length
  for (let c = 0; c < cols; c++) {
    const season = getSeason(c)
    const pool = ASSETS[season]

    // Grass on every ground cell
    addObject(layer, 0, c, {
      type: pick(pool.grass),
      scale: 0.7 + Math.random() * 0.4,
      offsetY: 26,
    })

    // Occasional rocks
    if (c % 17 === 3) {
      addObject(layer, 0, c, {
        type: pick(pool.rock),
        scale: 0.9 + Math.random() * 0.5,
        offsetX: 8 + Math.random() * 8,
        offsetY: 20,
      })
    }

    // Scattered ground props (flowers, wheat sheaves, leaf piles, crystals)
    if (c % 11 === 5) {
      addObject(layer, 0, c, {
        type: pick(pool.prop),
        scale: 0.7 + Math.random() * 0.4,
        offsetX: Math.random() * 16 - 8,
        offsetY: 22,
      })
    }
  }
}

function fillBackground(layer: LevelLayer) {
  const cols = layer[0].length
  for (let c = 0; c < cols; c += 10 + Math.floor(Math.random() * 8)) {
    if (isNearBoundary(c)) continue
    const season = getSeason(c)
    addObject(layer, 2, c, {
      type: pick(ASSETS[season].background),
      scale: 2.0 + Math.random() * 0.8,
      offsetX: -20 + Math.random() * 10,
      offsetY: 30 + Math.random() * 10,
    })
  }
}

function fillForeground(layer: LevelLayer) {
  const cols = layer[0].length
  for (let c = 4; c < cols; c += 18 + Math.floor(Math.random() * 14)) {
    if (isNearBoundary(c)) continue
    const season = getSeason(c)
    const pool = ASSETS[season]
    if (Math.random() > 0.35) {
      addObject(layer, 0, c, {
        type: pick(pool.tree),
        scale: 1.4 + Math.random() * 0.8,
        offsetX: Math.random() * 20 - 10,
        offsetY: 26,
      })
    } else {
      addObject(layer, 0, c, {
        type: pick(pool.bush),
        scale: 1.0 + Math.random() * 0.6,
        offsetX: Math.random() * 20 - 10,
        offsetY: 22,
      })
    }
  }
}

// Level grid: row 0 is the ground surface, rows increase upward.
// World y for an object = groundTop - (row * cellSize + halfCell + offsetY)
export const LEVEL: LevelData = {
  cellSize: 64,
  rows: 12,
  cols: 157,
  layers: {
    sky: emptyLayer(12, 157),
    background: emptyLayer(12, 157),
    ground: emptyLayer(12, 157),
    foreground: emptyLayer(12, 157),
  },
}

fillGroundLayer(LEVEL.layers.ground)
fillBackground(LEVEL.layers.background)
fillForeground(LEVEL.layers.foreground)
