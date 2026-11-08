// Footprint-aware placement helpers shared by floor generation, scenario
// spawning, chasm drops and save restoration.
//
// Everything is expressed as anchors (`x,y` in the same meaning as Entity.x/y)
// plus a Footprint. Callers own the reserved-cell set so a wide body blocks all
// of its cells, not only its anchor.
import { TILE_FOOTPRINT, footprintTiles } from './footprint.ts';
import type { Footprint } from './footprint.ts';

export type PlacementCell = { x: number; y: number };
export type PlacementTerrain = { isBlocking(x: number, y: number): boolean };
export type PlacementBlocked = (x: number, y: number) => boolean;

const open: PlacementBlocked = () => false;

export function reserveFootprint(
  reserved: Set<string>, footprint: Footprint, x: number, y: number
): void {
  for (const [tx, ty] of footprintTiles(footprint, x, y)) reserved.add(`${tx},${ty}`);
}

/** Can the whole rectangle stand at this anchor on the generated floor? */
export function footprintIsFree(
  level: number[][],
  footprint: Footprint,
  x: number,
  y: number,
  maxX: number = Number.POSITIVE_INFINITY,
  terrain?: PlacementTerrain,
  blocked: PlacementBlocked = open
): boolean {
  for (const [tx, ty] of footprintTiles(footprint, x, y)) {
    if (tx < 0 || ty < 0 || ty >= level.length || tx >= level[0].length) return false;
    if (tx >= maxX) return false;
    if (level[ty][tx] !== 0) return false;
    if (terrain?.isBlocking(tx, ty)) return false;
    if (blocked(tx, ty)) return false;
  }
  return true;
}

/** Take the next candidate anchor that fits the footprint, advancing a cursor. */
export function takeFootprintPlacement(
  candidates: readonly PlacementCell[],
  cursor: { index: number },
  footprint: Footprint,
  level: number[][],
  maxX: number = Number.POSITIVE_INFINITY,
  terrain?: PlacementTerrain,
  blocked: PlacementBlocked = open
): PlacementCell | undefined {
  while (cursor.index < candidates.length) {
    const candidate = candidates[cursor.index++];
    if (footprintIsFree(level, footprint, candidate.x, candidate.y, maxX, terrain, blocked)) {
      return candidate;
    }
  }
  return undefined;
}

/** Deterministic row-major fallback. Used when a floor could not fit its quota. */
export function firstFreeFootprintAnchor(
  level: number[][],
  footprint: Footprint = TILE_FOOTPRINT,
  maxX: number = Number.POSITIVE_INFINITY,
  terrain?: PlacementTerrain,
  blocked: PlacementBlocked = open
): PlacementCell | undefined {
  for (let y = 0; y < level.length; y++) {
    for (let x = 0; x < Math.min(level[y].length, maxX); x++) {
      if (footprintIsFree(level, footprint, x, y, maxX, terrain, blocked)) return { x, y };
    }
  }
  return undefined;
}

/** Nearest fully-valid anchor to a saved position. Used to repair old saves. */
export function nearestFreeFootprintAnchor(
  level: number[][],
  footprint: Footprint,
  fromX: number,
  fromY: number,
  maxX: number = Number.POSITIVE_INFINITY,
  terrain?: PlacementTerrain,
  blocked: PlacementBlocked = open
): PlacementCell | undefined {
  let best: PlacementCell | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let y = 0; y < level.length; y++) {
    for (let x = 0; x < Math.min(level[y].length, maxX); x++) {
      const distance = Math.hypot(x - fromX, y - fromY);
      if (distance >= bestDistance) continue;
      if (!footprintIsFree(level, footprint, x, y, maxX, terrain, blocked)) continue;
      best = { x, y };
      bestDistance = distance;
    }
  }
  return best;
}
