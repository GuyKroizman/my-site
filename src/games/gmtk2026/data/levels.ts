export interface LevelObject {
  type: string
  scale?: number
  rotation?: number
  offsetX?: number
  offsetY?: number
  flipX?: boolean
  tint?: number
}

/** Character → object config lookup table.
 *  Each character in a layer row maps to a LevelObject that the renderer spawns.
 *  Space ' ' = empty cell. */
export const TILE_MAP: Record<string, LevelObject> = {
  // Spring ─────────────────────────────────────────
  '.': { type: 'grass-1', scale: 0.7, offsetY: 26 },
  ',': { type: 'grass-2', scale: 0.9, offsetY: 26 },
  ';': { type: 'grass-3', scale: 1.0, offsetY: 26 },
  ':': { type: 'grass-4', scale: 1.2, offsetY: 26 },
  r: { type: 'rock-1', scale: 0.9, offsetY: 20 },
  R: { type: 'rock-4', scale: 1.3, offsetY: 20 },
  t: { type: 'tree-blossom-1', scale: 1.4, offsetY: 26 },
  T: { type: 'tree-blossom-3', scale: 1.9, offsetY: 26 },
  b: { type: 'bush-flowers-2', scale: 1.0, offsetY: 22 },
  B: { type: 'barn', scale: 0.7, offsetY: 0 },
  f: { type: 'flowers-1', scale: 0.8, offsetY: 22 },

  // Summer ─────────────────────────────────────────
  g: { type: 'grass-gold-1', scale: 0.7, offsetY: 26 },
  G: { type: 'grass-gold-4', scale: 1.2, offsetY: 26 },
  y: { type: 'rock-yellow-1', scale: 0.9, offsetY: 20 },
  Y: { type: 'rock-yellow-4', scale: 1.3, offsetY: 20 },
  e: { type: 'tree-green-1', scale: 1.4, offsetY: 26 },
  E: { type: 'tree-green-3', scale: 1.9, offsetY: 26 },
  w: { type: 'wheat-bush-small', scale: 1.0, offsetY: 22 },
  W: { type: 'wheat-bush-large', scale: 1.4, offsetY: 22 },
  s: { type: 'wheat-sheaf-small', scale: 0.8, offsetY: 22 },
  c: { type: 'corn-stalk-bottom-small', scale: 1.0, offsetY: 22 },

  // Autumn ─────────────────────────────────────────
  a: { type: 'grass-autumn-1', scale: 0.7, offsetY: 26 },
  A: { type: 'grass-autumn-4', scale: 1.2, offsetY: 26 },
  m: { type: 'rock-moss-1', scale: 0.9, offsetY: 20 },
  M: { type: 'rock-moss-4', scale: 1.3, offsetY: 20 },
  u: { type: 'tree-autumn-small', scale: 1.4, offsetY: 26 },
  U: { type: 'tree-autumn-large', scale: 1.9, offsetY: 26 },
  n: { type: 'tree-autumn-bare', scale: 1.6, offsetY: 26 },
  h: { type: 'bush-autumn-1', scale: 1.0, offsetY: 22 },
  l: { type: 'leaf-pile', scale: 0.8, offsetY: 22 },
  L: { type: 'leaves-scattered', scale: 0.9, offsetY: 22 },

  // Winter ─────────────────────────────────────────
  i: { type: 'grass-ice-1', scale: 0.7, offsetY: 26 },
  I: { type: 'grass-ice-4', scale: 1.2, offsetY: 26 },
  o: { type: 'rock-snow-1', scale: 0.9, offsetY: 20 },
  O: { type: 'rock-snow-4', scale: 1.3, offsetY: 20 },
  p: { type: 'tree-pine-small', scale: 1.4, offsetY: 26 },
  P: { type: 'tree-pine-large', scale: 1.9, offsetY: 26 },
  d: { type: 'branches-bare', scale: 1.0, offsetY: 22 },
  D: { type: 'bush-thorny-ice', scale: 1.2, offsetY: 22 },
  x: { type: 'crystal-ice-small', scale: 0.8, offsetY: 22 },
  X: { type: 'crystal-ice-large', scale: 1.0, offsetY: 22 },
  S: { type: 'snow-mound', scale: 1.1, offsetY: 22 },
}

export interface LevelData {
  cellSize: number
  rows: number
  cols: number
  layers: Record<string, string[]> // each string is one row; each char is a TILE_MAP key (space = empty)
}

// Season zones by column (157 cols @ 64px = ~10,048px world)
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

/** Boundary columns where seasons switch. Large objects are kept away. */
const BOUNDARY_COLS = [39, 78, 117]
const BOUNDARY_BUFFER = 4

function isNearBoundary(col: number): boolean {
  return BOUNDARY_COLS.some((b) => Math.abs(col - b) <= BOUNDARY_BUFFER)
}

function emptyLayer(rows: number, cols: number): string[] {
  return Array.from({ length: rows }, () => ' '.repeat(cols))
}

function setChar(layer: string[], row: number, col: number, char: string) {
  if (row < 0 || row >= layer.length) return
  const s = layer[row]
  if (col < 0 || col >= s.length) return
  layer[row] = s.slice(0, col) + char + s.slice(col + 1)
}

function pickChar(str: string): string {
  return str[Math.floor(Math.random() * str.length)]
}

/** Character pools per season. The generator picks from these strings. */
const CHARS: Record<
  'spring' | 'summer' | 'autumn' | 'winter',
  Record<string, string>
> = {
  spring: {
    grass: '.,:;',
    rock: 'rR',
    tree: 'tT',
    bush: 'b',
    prop: 'f',
    background: 'tT',
  },
  summer: {
    grass: 'gG',
    rock: 'yY',
    tree: 'eE',
    bush: 'wW',
    prop: 'sSc',
    background: 'eE',
  },
  autumn: {
    grass: 'aA',
    rock: 'mM',
    tree: 'uUn',
    bush: 'h',
    prop: 'lL',
    background: 'uUn',
  },
  winter: {
    grass: 'iI',
    rock: 'oO',
    tree: 'pP',
    bush: 'dD',
    prop: 'xXS',
    background: 'pP',
  },
}

function fillGroundLayer(layer: string[]) {
  const cols = layer[0].length
  for (let c = 0; c < cols; c++) {
    const season = getSeason(c)
    const pool = CHARS[season]

    // Grass on every ground cell
    setChar(layer, 0, c, pickChar(pool.grass))

    // Occasional rocks
    if (c % 17 === 3) {
      setChar(layer, 0, c, pickChar(pool.rock))
    }

    // Scattered ground props
    if (c % 11 === 5) {
      setChar(layer, 0, c, pickChar(pool.prop))
    }
  }
}

function fillBackground(layer: string[]) {
  const cols = layer[0].length
  for (let c = 0; c < cols; c += 10 + Math.floor(Math.random() * 8)) {
    if (isNearBoundary(c)) continue
    const season = getSeason(c)
    setChar(layer, 2, c, pickChar(CHARS[season].background))
  }
}

function fillForeground(layer: string[]) {
  const cols = layer[0].length
  for (let c = 4; c < cols; c += 18 + Math.floor(Math.random() * 14)) {
    if (isNearBoundary(c)) continue
    const season = getSeason(c)
    const pool = CHARS[season]
    if (Math.random() > 0.35) {
      setChar(layer, 0, c, pickChar(pool.tree))
    } else {
      setChar(layer, 0, c, pickChar(pool.bush))
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

// One prominent barn in the middle of the summer zone
setChar(LEVEL.layers.background, 3, 55, 'B')
