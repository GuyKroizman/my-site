import type { Entity } from './entity';
import type { GameContext } from './context';
import { randomWalkableTiles } from './mapgen.ts';
import { terrainFor } from './terrain.ts';
import { placeFloorItem } from './itemPresentation.ts';

// A chasm is a chute, not a bin. Anything that falls in - a thrown item, a
// stack dropped in mid-air, or an enemy dragged over the edge - lands at a
// random walkable spot on the next floor down instead of being destroyed. The
// queue is keyed by the receiving floor, so a fall resolves when that floor is
// first generated or revisited.
export function stashChasmFallen(context: GameContext, item: Entity): boolean {
  const targetFloor = (context.floor ?? 1) + 1;
  // The abyss under the final floor has no landing spot.
  if (targetFloor > (context.maxFloor ?? 25)) return false;

  // The item has no tile on this floor any more. Drop its sprite here; the
  // floor change only cleans up entities that are still on the map.
  item.sprite?.destroy();
  item.sprite = undefined;

  const queue = context.chasmFallenItems ?? (context.chasmFallenItems = new Map());
  const pending = queue.get(targetFloor);
  if (pending) pending.push(item);
  else queue.set(targetFloor, [item]);
  return true;
}

// Places everything the chasm swallowed on the floor above. `reserved` holds
// tiles already used by generated content, the stairs and the arrival point.
// If the floor is packed, later items share a walkable tile rather than
// vanishing through the world.
export function placeChasmFallen(
  context: GameContext,
  map: number[][],
  reserved: Set<string>,
  maxX?: number
): Entity[] {
  const queue = context.chasmFallenItems;
  const pending = queue?.get(context.floor);
  if (!queue || !pending?.length) return [];
  queue.delete(context.floor);

  const terrain = terrainFor(context);
  const preferred = randomWalkableTiles(map, pending.length, reserved, maxX, terrain);
  const fallback = randomWalkableTiles(map, pending.length, new Set(), maxX, terrain);

  const placed: Entity[] = [];
  for (let i = 0; i < pending.length; i++) {
    const spot = preferred[i] ?? fallback[i];
    if (!spot) {
      // A fixture map with no walkable tile at all has nowhere to land: keep
      // the rest queued instead of deleting the items.
      queue.set(context.floor, pending.slice(i));
      break;
    }
    const item = pending[i];
    item.context = context;
    item.x = spot.x;
    item.y = spot.y;
    if (!context.entities.includes(item)) context.entities.push(item);
    placeFloorItem(item);
    placed.push(item);
  }

  return placed;
}
