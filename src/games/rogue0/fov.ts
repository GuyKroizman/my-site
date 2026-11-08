// Field-of-view and line-of-sight helpers for tile-based maps.
// `map` is a 2D array where 0 = walkable, 1 = wall.
//
// Closed doors and tall grass hide tiles beyond them, but each stays visible
// itself: you see into a grass tile or a doorway, never past it.
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

export type ProjectileTerrain = Pick<Terrain, 'getDoorState' | 'getTileState'>;

// Physical blocking for a projectile is stricter than sight: a closed door or
// a disguised secret door stops a bolt even when it does not hide the tile.
// Tall grass is transparent to projectiles, and chasms do not block the path.
export function blocksProjectile(
  map: number[][],
  x: number,
  y: number,
  terrain?: ProjectileTerrain
): boolean {
  if (map[y]?.[x] === undefined) return true;
  if (map[y][x] === 1) return true;
  const state = terrain?.getTileState?.(x, y);
  return state?.feature === 'secretDoor' || terrain?.getDoorState?.(x, y) === 'closed';
}

// A wand bolt travels in a straight line regardless of the current field of
// view, so darkness and unlit rooms do not gate a zap. Only solid obstructions
// along the line (walls, closed doors, secret doors) stop it.
export function hasClearProjectilePath(
  map: number[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  terrain?: ProjectileTerrain
): boolean {
  if (map[y0]?.[x0] === undefined || map[y1]?.[x1] === undefined) return false;
  const points = bresenhamLine(x0, y0, x1, y1);
  // The origin is the caster's own tile; the destination is included so a
  // closed door or wall cannot be targeted and cannot hide a free shot.
  for (let i = 1; i < points.length; i++) {
    if (blocksProjectile(map, points[i][0], points[i][1], terrain)) return false;
  }
  return true;
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

// Tall grass is opaque from the inside too: an occupant sees the adjacent
// tiles but nothing beyond them. Magical Sight ignores this (see computeFOV).
function standingInGrass(terrain: SightTerrain | undefined, x: number, y: number): boolean {
  return terrain?.getTileState(x, y)?.feature === 'grass';
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
  // visible angular interval at opaque tiles. Walls and grass expose their own
  // tile while stopping the scan. No special corner veto: an adjacent doorway
  // remains visible beside its jamb. Floor sight is reciprocal.
  const engulfedInGrass = standingInGrass(terrain, px, py);
  const sight = engulfedInGrass ? 1 : r;
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const transform = (depth: number, column: number): [number, number] => {
      if (quadrant === 0) return [px + column, py - depth];
      if (quadrant === 1) return [px + depth, py + column];
      if (quadrant === 2) return [px + column, py + depth];
      return [px - depth, py + column];
    };
    const scan = (depth: number, start: number, end: number): void => {
      if (depth > sight || start > end) return;
      let previousWall: boolean | undefined;
      const first = Math.floor(depth * start + 0.5);
      const last = Math.ceil(depth * end - 0.5);
      for (let column = first; column <= last; column++) {
        const [x, y] = transform(depth, column);
        const wall = blocksSight(map, x, y, terrain);
        // The scan never goes past depth 1 inside grass, which already keeps
        // every candidate within the surrounding ring (Chebyshev distance 1).
        const inRange = engulfedInGrass || depth * depth + column * column <= sight * sight;
        if (map[y]?.[x] !== undefined && inRange &&
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
  return visible;
}
