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

export function pickupMessage(entity: Entity): string {
  const label = entity.displayName;
  if (entity.goldAmount > 0) return `You picked up ${label}.`;
  const article = /^[aeiou]/i.test(label) ? 'an' : 'a';
  return `You picked up ${article} ${label}.`;
}

export function cursorDirection(key: string): Direction | undefined {
  switch (key) {
    case 'Home': return { dx: -1, dy: -1 };
    case 'PageUp': return { dx: 1, dy: -1 };
    case 'End': return { dx: -1, dy: 1 };
    case 'PageDown': return { dx: 1, dy: 1 };
    case 'ArrowLeft': case 'h': return { dx: -1, dy: 0 };
    case 'ArrowRight': case 'l': return { dx: 1, dy: 0 };
    case 'ArrowUp': case 'k': return { dx: 0, dy: -1 };
    case 'ArrowDown': case 'j': return { dx: 0, dy: 1 };
    default: return undefined;
  }
}
