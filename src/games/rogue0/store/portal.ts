import type { FeaturePlacement } from '../tiles';
import { isShopFloor } from './shopStock.ts';

export type StorePortal = { x: number; y: number; approachX: number; approachY: number };
const DIRECTIONS = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const;
const key = (x: number, y: number) => `${x},${y}`;

function approachFor(x: number, y: number, map: number[][]): { x: number; y: number } | undefined {
  // Front first: the door faces the viewer (south). Any other free side is a
  // valid fallback for an older/awkward placement, and the hero can always bump
  // from the side they are standing on.
  if (map[y + 1]?.[x] === 0) return { x, y: y + 1 };
  for (const [dx, dy] of DIRECTIONS) {
    if (map[y + dy]?.[x + dx] === 0) return { x: x + dx, y: y + dy };
  }
  return undefined;
}

// A free-standing door in an open room tile. It is walkable ground in the map
// but the feature blocks occupancy, so actors route around it and can stand
// behind it. Front art faces south; the back has its own panel.
export function placeStorePortal(
  floor: number,
  map: number[][],
  features: FeaturePlacement[],
  spawn: { x: number; y: number },
  options: { random?: () => number; avoid?: readonly { x: number; y: number }[] } = {}
): StorePortal | undefined {
  if (!isShopFloor(floor)) return undefined;
  const random = options.random ?? Math.random;
  const avoid = new Set((options.avoid ?? []).map(point => key(point.x, point.y)));
  avoid.add(key(spawn.x, spawn.y));

  const existingIndex = features.findIndex(tile => tile.feature === 'portal');
  let carryOpen = false;
  if (existingIndex >= 0) {
    const existing = features[existingIndex];
    const approach = map[existing.y]?.[existing.x] === 0
      ? approachFor(existing.x, existing.y, map) : undefined;
    if (approach) {
      return { x: existing.x, y: existing.y, approachX: approach.x, approachY: approach.y };
    }
    // Migrate an older wall-mounted portal: drop it and choose a room tile.
    carryOpen = existing.portal === 'open';
    features.splice(existingIndex, 1);
  }

  const occupied = new Map(features.map(tile => [key(tile.x, tile.y), tile.feature]));
  const reachable = new Set<string>();
  const queue = [spawn];
  reachable.add(key(spawn.x, spawn.y));
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i];
    for (const [dx, dy] of DIRECTIONS) {
      const x = point.x + dx, y = point.y + dy, id = key(x, y);
      if (map[y]?.[x] !== 0 || reachable.has(id) || ['chasm', 'secretDoor'].includes(occupied.get(id) ?? '')) continue;
      reachable.add(id); queue.push({ x, y });
    }
  }

  const clear = (x: number, y: number, radius: number): boolean => {
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (map[ny]?.[nx] !== 0 || occupied.has(key(nx, ny))) return false;
    }
    return true;
  };
  const openness = (x: number, y: number): number => {
    let count = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (map[y + dy]?.[x + dx] === 0 && !occupied.has(key(x + dx, y + dy))) count++;
    }
    return count;
  };

  let candidates = queue.filter(point => !occupied.has(key(point.x, point.y)) &&
    !avoid.has(key(point.x, point.y)) && clear(point.x, point.y, 1));
  // A small room may not fit a full 3x3 clear ring; keep all four cardinal
  // neighbours free so the hero can still reach the front and walk behind.
  if (!candidates.length) candidates = queue.filter(point => {
    if (occupied.has(key(point.x, point.y)) || avoid.has(key(point.x, point.y))) return false;
    return DIRECTIONS.every(([dx, dy]) => map[point.y + dy]?.[point.x + dx] === 0 &&
      !occupied.has(key(point.x + dx, point.y + dy)));
  });
  if (!candidates.length) return undefined;
  const best = Math.max(...candidates.map(point => openness(point.x, point.y)));
  const openCenters = candidates.filter(point => openness(point.x, point.y) >= best - 2);
  const distant = openCenters.filter(point =>
    Math.abs(point.x - spawn.x) + Math.abs(point.y - spawn.y) >= 10);
  const pool = distant.length ? distant : openCenters;
  const chosen = pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))];
  features.push({ x: chosen.x, y: chosen.y, feature: 'portal', portal: carryOpen ? 'open' : 'closed' });
  return { x: chosen.x, y: chosen.y, approachX: chosen.x, approachY: chosen.y + 1 };
}
