import type { Entity } from './entity';
import type { GameContext } from './context';
import type { Direction } from './heroControlTypes';

export function isHostile(entity: Entity): boolean {
  return entity.type === 'enemy' && !entity.isDecoy;
}

export function hostileAtTile(context: GameContext, x: number, y: number): Entity | undefined {
  return (context.entities ?? []).find(entity =>
    isHostile(entity) && (entity.healthPoints ?? 0) > 0 && !!entity.sprite &&
    entity.x === x && entity.y === y);
}

/** Large sprites (the scaled Bone Lord) extend beyond their logical tile. A
 * click anywhere inside that art should pick the actor, not the empty floor it
 * happens to overlap. Tile hits are checked first by the caller, so ordinary
 * entities keep their exact-cell behaviour. */
export function entityAtPointer(
  context: GameContext, worldX: number, worldY: number
): Entity | undefined {
  let chosen: Entity | undefined;
  let chosenRank = -1;
  let chosenDepth = -Infinity;
  for (const entity of context.entities ?? []) {
    const sprite = entity.sprite;
    if (!sprite || sprite.visible === false) continue;
    const bounds = sprite.getBounds?.();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) continue;
    if (worldX < bounds.x || worldX > bounds.x + bounds.width ||
        worldY < bounds.y || worldY > bounds.y + bounds.height) continue;
    const hostile = isHostile(entity) && (entity.healthPoints ?? 0) > 0;
    const rank = hostile ? 2 : entity.type === 'item' ? 1 : 0;
    const depth = sprite.depth ?? 0;
    if (rank > chosenRank || (rank === chosenRank && depth > chosenDepth)) {
      chosen = entity;
      chosenRank = rank;
      chosenDepth = depth;
    }
  }
  return chosen;
}

export function pickupMessage(entity: Entity): string {
  const label = entity.displayName;
  if (entity.goldAmount > 0) return `You picked up ${label}.`;
  const article = /^[aeiou]/i.test(label) ? 'an' : 'a';
  return `You picked up ${article} ${label}.`;
}

export function cursorDirection(key: string): Direction | undefined {
  switch (key) {
    case 'Home': case 'u': return { dx: -1, dy: -1 };
    case 'PageUp': case 'i': return { dx: 1, dy: -1 };
    case 'End': case 'n': return { dx: -1, dy: 1 };
    case 'PageDown': case 'm': return { dx: 1, dy: 1 };
    case 'ArrowLeft': case 'h': return { dx: -1, dy: 0 };
    case 'ArrowRight': case 'l': return { dx: 1, dy: 0 };
    case 'ArrowUp': case 'k': return { dx: 0, dy: -1 };
    case 'ArrowDown': case 'j': return { dx: 0, dy: 1 };
    default: return undefined;
  }
}
