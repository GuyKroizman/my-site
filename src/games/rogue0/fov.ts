// Field-of-view and line-of-sight helpers for tile-based maps.
// `map` is a 2D array where 0 = walkable, 1 = wall.
//
// Closed doors hide tiles beyond them, but the door itself stays visible.
import type { Terrain } from './terrain';

export type SightTerrain = Pick<Terrain, 'getDoorState' | 'getTileState' | 'isGrassConcealed'>;
// Omitted terrain means a bare base map, never an implicit active run.

export type VisionParameters = {
  baseRadius?: number;
  dark?: boolean;
  torch?: boolean;
  magicalSight?: boolean;
  mindVision?: boolean;
  blinded?: boolean;
};

export function resolveVision(parameters: VisionParameters = {}) {
  return {
    radius: parameters.blinded ? 0 : parameters.magicalSight ? 12
      : parameters.dark && !parameters.torch ? 4 : (parameters.baseRadius ?? 8),
    ignoreObstacles: !!parameters.magicalSight && !parameters.blinded,
    mindVision: !!parameters.mindVision
  };
}

export function blocksSight(map: number[][], x: number, y: number, terrain?: SightTerrain): boolean {
  if (map[y]?.[x] === undefined) return true;
  const state = terrain?.getTileState(x, y);
  if (state?.blocksSight !== undefined) return state.blocksSight;
  return map[y][x] === 1 || terrain?.getDoorState(x, y) === "closed" || state?.feature === "grass";
}

export function bresenhamLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;

  while (true) {
    points.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }

  return points;
}

export function hasLineOfSight(
  map: number[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  terrain?: SightTerrain
): boolean {
  if (map[y0]?.[x0] === undefined || map[y1]?.[x1] === undefined) return false;
  return computeFOV(map, x0, y0, Math.ceil(Math.hypot(x1 - x0, y1 - y0)), false, terrain).has(`${x1},${y1}`);
}

export function canSee(
  map: number[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  terrain?: SightTerrain
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (dx * dx + dy * dy > radius * radius) return false;
  if (terrain?.isGrassConcealed(x1, y1, x0, y0)) return false;
  return hasLineOfSight(map, x0, y0, x1, y1, terrain);
}

// Tall grass hides the ground and everything standing in it, but the wall
// standing past a patch of grass is still seen above the blades. Reveal such
// opaque tiles when the only thing blocking their sight line is grass.
function isGrassTile(terrain: SightTerrain | undefined, x: number, y: number): boolean {
  return terrain?.getTileState(x, y)?.feature === 'grass';
}

function hiddenOnlyByGrass(
  map: number[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  terrain?: SightTerrain
): boolean {
  const line = bresenhamLine(x0, y0, x1, y1);
  let crossedGrass = false;
  for (let i = 1; i < line.length - 1; i++) {
    const [x, y] = line[i];
    if (!blocksSight(map, x, y, terrain)) continue;
    if (!isGrassTile(terrain, x, y)) return false;
    crossedGrass = true;
  }
  return crossedGrass;
}

function revealOpaqueBeyondGrass(
  map: number[][],
  px: number,
  py: number,
  radius: number,
  terrain: SightTerrain | undefined,
  visible: Set<string>
): void {
  for (let y = Math.max(0, py - radius); y <= Math.min(map.length - 1, py + radius); y++) {
    for (let x = Math.max(0, px - radius); x <= Math.min(map[y].length - 1, px + radius); x++) {
      const key = `${x},${y}`;
      if (visible.has(key)) continue;
      if ((x - px) ** 2 + (y - py) ** 2 > radius * radius) continue;
      if (!blocksSight(map, x, y, terrain) || isGrassTile(terrain, x, y)) continue;
      if (hiddenOnlyByGrass(map, px, py, x, y, terrain)) visible.add(key);
    }
  }
}

export function computeFOV(
  map: number[][],
  px: number,
  py: number,
  radius: number = 8,
  ignoreObstacles = false,
  terrain?: SightTerrain
): Set<string> {
  const visible = new Set<string>();
  const r = Number.isFinite(radius) ? Math.max(0, Math.floor(radius)) : 0;

  if (map[py]?.[px] === undefined) return visible;
  visible.add(`${px},${py}`);
  if (ignoreObstacles) {
    for (let y = Math.max(0, py - r); y <= Math.min(map.length - 1, py + r); y++) {
      for (let x = Math.max(0, px - r); x <= Math.min(map[y].length - 1, px + r); x++) {
        if ((x - px) ** 2 + (y - py) ** 2 <= r * r) visible.add(`${x},${y}`);
      }
    }
    return visible;
  }

  // Symmetric shadowcasting: scan four 90-degree quadrants, splitting the
  // visible angular interval at opaque tiles. Walls expose their faces while
  // floor centers must lie within the interval. No special corner veto: an
  // adjacent doorway remains visible beside its jamb. Floor sight is reciprocal.
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const transform = (depth: number, column: number): [number, number] => {
      if (quadrant === 0) return [px + column, py - depth];
      if (quadrant === 1) return [px + depth, py + column];
      if (quadrant === 2) return [px + column, py + depth];
      return [px - depth, py + column];
    };
    const scan = (depth: number, start: number, end: number): void => {
      if (depth > r || start > end) return;
      let previousWall: boolean | undefined;
      const first = Math.floor(depth * start + 0.5);
      const last = Math.ceil(depth * end - 0.5);
      for (let column = first; column <= last; column++) {
        const [x, y] = transform(depth, column);
        const wall = blocksSight(map, x, y, terrain);
        if (map[y]?.[x] !== undefined && depth * depth + column * column <= r * r &&
            (wall || (column >= depth * start && column <= depth * end))) {
          visible.add(`${x},${y}`);
        }
        const slope = (column - 0.5) / depth;
        if (previousWall === true && !wall) start = slope;
        if (previousWall === false && wall) scan(depth + 1, start, slope);
        previousWall = wall;
      }
      if (previousWall === false) scan(depth + 1, start, end);
    };
    scan(1, -1, 1);
  }
  revealOpaqueBeyondGrass(map, px, py, r, terrain, visible);
  return visible;
}
