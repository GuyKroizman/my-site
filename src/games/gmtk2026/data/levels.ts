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

function fillGroundLayer(layer: LevelLayer) {
  const cols = layer[0].length

  for (let c = 0; c < cols; c++) {
    // Base grass on every ground cell
    addObject(layer, 0, c, { type: 'grass', scale: 0.8, offsetY: 24 })

    // Occasional rocks
    if (c % 17 === 3) {
      addObject(layer, 0, c, { type: 'rock', scale: 1.2, offsetX: 10, offsetY: 18 })
    }
  }
}

function fillBackgroundMountains(layer: LevelLayer) {
  const cols = layer[0].length
  for (let c = 0; c < cols; c += 12) {
    addObject(layer, 2, c, {
      type: 'mountain-far',
      scale: 2.5 + Math.random() * 0.5,
      offsetX: -16,
      offsetY: 32,
    })
  }
}

function fillClouds(layer: LevelLayer) {
  const cols = layer[0].length
  for (let c = 8; c < cols; c += 25 + Math.floor(Math.random() * 20)) {
    const row = 6 + Math.floor(Math.random() * 3)
    addObject(layer, row, c, {
      type: 'cloud',
      scale: 1.5 + Math.random(),
      offsetX: Math.random() * 40 - 20,
      offsetY: Math.random() * 20 - 10,
    })
  }
}

function fillForegroundTrees(layer: LevelLayer) {
  const cols = layer[0].length
  for (let c = 5; c < cols; c += 22 + Math.floor(Math.random() * 15)) {
    addObject(layer, 0, c, {
      type: Math.random() > 0.5 ? 'tree-1' : 'tree-2',
      scale: 1.8 + Math.random() * 0.6,
      offsetX: Math.random() * 20 - 10,
      offsetY: 24,
    })
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

// Sun
addObject(LEVEL.layers.sky, 9, 20, { type: 'sun', scale: 2, offsetX: 0, offsetY: 0 })

fillClouds(LEVEL.layers.sky)
fillBackgroundMountains(LEVEL.layers.background)
fillGroundLayer(LEVEL.layers.ground)
fillForegroundTrees(LEVEL.layers.foreground)
