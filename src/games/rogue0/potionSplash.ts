import { bresenhamLine, hasClearProjectilePath, blocksProjectile } from './fov.ts';
import type { Terrain } from './terrain.ts';

export type SplashCell = { x: number; y: number };

// Even-sized splashes put the impact in the upper-left of the central four
// cells: offsets -1..2 on each axis. Solid terrain clips the splash, not grass.
export function potionSplashCells(
  map: number[][], terrain: Terrain, x: number, y: number,
  fromX: number, fromY: number
): { origin: SplashCell; cells: SplashCell[] } {
  let origin = { x, y };
  if (!map.length) return { origin, cells: [] };
  const sourceX = Number.isFinite(fromX) ? fromX : x;
  const sourceY = Number.isFinite(fromY) ? fromY : y;
  if (blocksProjectile(map, x, y, terrain)) {
    // A bottle against a closed door breaks on the thrower's side; it must not
    // open the door or leak its contents into the room beyond it.
    const line = bresenhamLine(sourceX, sourceY, x, y);
    const previous = line[Math.max(0, line.length - 2)];
    origin = { x: previous[0], y: previous[1] };
  }
  const cells: SplashCell[] = [];
  for (let cy = y - 1; cy <= y + 2; cy++) {
    for (let cx = x - 1; cx <= x + 2; cx++) {
      if (map[cy]?.[cx] !== 0 || terrain.getFeature(cx, cy) === 'chasm' ||
          blocksProjectile(map, cx, cy, terrain) ||
          !hasClearProjectilePath(map, origin.x, origin.y, cx, cy, terrain)) continue;
      cells.push({ x: cx, y: cy });
    }
  }
  return { origin, cells };
}
