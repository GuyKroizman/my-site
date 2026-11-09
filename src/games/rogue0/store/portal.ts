import type { FeaturePlacement } from '../tiles';
import { SHOP_FLOOR } from './shopStock.ts';

export type StorePortal = { x: number; y: number; approachX: number; approachY: number };
const DIRECTIONS = [[0, 1], [1, 0], [0, -1], [-1, 0]];

// Choose a wall adjoining reachable ground. The BFS excludes secret doors and
// chasms, so no portal can be stranded on a treasure island or behind a secret.
// Called on floor creation/restoration; an existing feature is never rerolled.
export function placeStorePortal(floor: number, map: number[][], features: FeaturePlacement[],
  spawn: { x: number; y: number }, random: () => number = Math.random): StorePortal | undefined {
  if (floor !== SHOP_FLOOR) return undefined;
  const existing = features.find(tile => tile.feature === 'portal');
  if (existing) {
    const step = DIRECTIONS.find(([dx, dy]) => map[existing.y + dy]?.[existing.x + dx] === 0);
    return step ? { x: existing.x, y: existing.y, approachX: existing.x + step[0], approachY: existing.y + step[1] } : undefined;
  }
  const occupied = new Map(features.map(tile => [`${tile.x},${tile.y}`, tile.feature]));
  const reachable = new Set<string>();
  const queue = [spawn];
  reachable.add(`${spawn.x},${spawn.y}`);
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i];
    for (const [dx, dy] of DIRECTIONS) {
      const x = point.x + dx, y = point.y + dy, key = `${x},${y}`;
      if (map[y]?.[x] !== 0 || reachable.has(key) || ['chasm', 'secretDoor'].includes(occupied.get(key) ?? '')) continue;
      reachable.add(key); queue.push({ x, y });
    }
  }
  const collect = (maxOpenings: number): StorePortal[] => {
    const found: StorePortal[] = [];
    for (const point of queue) {
      if (occupied.has(`${point.x},${point.y}`)) continue;
      for (const [dx, dy] of DIRECTIONS) {
        const x = point.x + dx, y = point.y + dy;
        if (map[y]?.[x] !== 1 || occupied.has(`${x},${y}`)) continue;
        const openings = DIRECTIONS.filter(([ox, oy]) => map[y + oy]?.[x + ox] === 0);
        if (openings.length <= maxOpenings) found.push({ x, y, approachX: point.x, approachY: point.y });
      }
    }
    return found;
  };
  let pool = collect(1);
  if (!pool.length) pool = collect(2);
  const distant = pool.filter(p => Math.abs(p.x - spawn.x) + Math.abs(p.y - spawn.y) >= 10);
  if (distant.length) pool = distant;
  if (!pool.length) return undefined;
  const chosen = pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))];
  features.push({ x: chosen.x, y: chosen.y, feature: 'portal', portal: 'closed' });
  return chosen;
}
