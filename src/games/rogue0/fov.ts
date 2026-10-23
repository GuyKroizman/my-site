// Field-of-view and line-of-sight helpers for tile-based maps.
// `map` is a 2D array where 0 = walkable, 1 = wall.
//
// Closed doors hide tiles beyond them, but the door itself stays visible.
import { getDoorState, getTileState } from "./tiles";

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

export function blocksSight(map: number[][], x: number, y: number): boolean {
  if (map[y]?.[x] === undefined) return true;
  const state = getTileState(x, y);
  if (state?.blocksSight !== undefined) return state.blocksSight;
  return map[y][x] === 1 || getDoorState(x, y) === "closed" || state?.feature === "grass";
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
  y1: number
): boolean {
  if (map[y0]?.[x0] === undefined || map[y1]?.[x1] === undefined) return false;
  // Canonical direction removes Bresenham tie-breaking asymmetry.
  const reverse = x0 > x1 || (x0 === x1 && y0 > y1);
  const points = reverse ? bresenhamLine(x1, y1, x0, y0).reverse()
    : bresenhamLine(x0, y0, x1, y1);

  const opaque = (x: number, y: number) => blocksSight(map, x, y);

  // Do not peek diagonally across the edge of a pillar or closed doorway.
  // Otherwise circling a single-tile pillar never reliably breaks sight.
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i];
    const [prevX, prevY] = points[i - 1];
    if (x !== prevX && y !== prevY &&
        (opaque(x, prevY) || opaque(prevX, y))) return false;
    // Endpoints themselves stay visible, including walls and closed doors.
    if (i < points.length - 1 && opaque(x, y)) return false;
  }

  return true;
}

export function canSee(
  map: number[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (dx * dx + dy * dy > radius * radius) return false;
  return hasLineOfSight(map, x0, y0, x1, y1);
}

export function computeFOV(
  map: number[][],
  px: number,
  py: number,
  radius: number = 8,
  ignoreObstacles = false
): Set<string> {
  const visible = new Set<string>();
  const r = Number.isFinite(radius) ? Math.max(0, Math.floor(radius)) : 0;

  for (let y = py - r; y <= py + r; y++) {
    for (let x = px - r; x <= px + r; x++) {
      if (x < 0 || y < 0 || y >= map.length || x >= map[y].length) continue;

      const dx = x - px;
      const dy = y - py;
      if (dx * dx + dy * dy > r * r) continue;

      if (ignoreObstacles || hasLineOfSight(map, px, py, x, y)) {
        visible.add(`${x},${y}`);
      }
    }
  }

  return visible;
}
