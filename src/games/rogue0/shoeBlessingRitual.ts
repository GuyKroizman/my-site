import type { GameContext } from './context.ts';
import type { Entity } from './entity.ts';
import { removeEntity } from './entity.ts';
import { terrainFor } from './terrain.ts';
import dungeon from './dungeon.ts';
import Shoe from './items/Shoe.ts';
import BlessedShoe from './items/BlessedShoe.ts';
import BerserkPotion from './items/berserkPotion.ts';
import PotionOfHealing from './items/PotionOfHealing.ts';
import { placeFloorItem } from './itemPresentation.ts';

function isValidRitualTile(context: GameContext, x: number, y: number): boolean {
  const level = context.currentLevel;
  if (!level?.length || level[y]?.[x] !== 0) return false;
  if (terrainFor(context).isBlocking(x, y)) return false;
  return true;
}

function itemsAt(context: GameContext, x: number, y: number): Entity[] {
  return context.entities.filter(entity => entity.type === 'item' && entity.x === x && entity.y === y);
}

function findAt<T extends Entity>(context: GameContext, x: number, y: number, ctor: new (...args: any[]) => T): T | undefined {
  return itemsAt(context, x, y).find(item => item instanceof ctor) as T | undefined;
}

export function tryBlessShoeRitual(context: GameContext, placed: Entity): boolean {
  if (!placed || placed.x === undefined || placed.y === undefined) return false;
  const level = context.currentLevel;
  if (!level?.length) return false;

  const centers: Array<{ x: number; y: number; shoe: Entity }> = [];
  if (placed instanceof Shoe && !(placed instanceof BlessedShoe)) {
    centers.push({ x: placed.x, y: placed.y, shoe: placed });
  } else if (placed instanceof BerserkPotion) {
    for (const [dx, dy] of [[1, 0], [-1, 0]] as const) {
      const shoe = findAt(context, placed.x + dx, placed.y + dy, Shoe);
      if (shoe && !(shoe instanceof BlessedShoe)) centers.push({ x: shoe.x!, y: shoe.y!, shoe });
    }
  } else if (placed instanceof PotionOfHealing) {
    for (const [dx, dy] of [[0, 1], [0, -1]] as const) {
      const shoe = findAt(context, placed.x + dx, placed.y + dy, Shoe);
      if (shoe && !(shoe instanceof BlessedShoe)) centers.push({ x: shoe.x!, y: shoe.y!, shoe });
    }
  } else {
    return false;
  }

  for (const center of centers) {
    const { x, y, shoe } = center;
    const positions = [[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    if (!positions.every(([px, py]) => isValidRitualTile(context, px, py))) continue;
    const left = findAt(context, x - 1, y, BerserkPotion);
    const right = findAt(context, x + 1, y, BerserkPotion);
    const above = findAt(context, x, y - 1, PotionOfHealing);
    const below = findAt(context, x, y + 1, PotionOfHealing);
    if (!left || !right || !above || !below) continue;

    // Simple animation: flash at center if scene available.
    const scene = context.scene as any;
    const map = context.map as any;
    if (scene && map) {
      const wx = map.tileToWorldX(x)! + 8;
      const wy = map.tileToWorldY(y)! + 8;
      const circle = scene.add.circle(wx, wy, 18, 0xfff3b0, 0.7).setDepth(300);
      scene.tweens.add({ targets: circle, alpha: 0, scale: 2.2, duration: 450, onComplete: () => circle.destroy() });
    }

    for (const reagent of [left, right, above, below]) {
      reagent.sprite?.destroy?.();
      reagent.sprite = undefined;
      removeEntity(context, reagent);
    }
    shoe.sprite?.destroy?.();
    shoe.sprite = undefined;
    removeEntity(context, shoe);
    const blessed = new BlessedShoe(context, x, y);
    context.entities.push(blessed);
    placeFloorItem(blessed as unknown as Entity);
    dungeon.log(context, 'The ritual is complete. The Boot becomes a Blessed Boot!');
    context.saveNow?.();
    return true;
  }
  return false;
}
