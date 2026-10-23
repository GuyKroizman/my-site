import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity } from "../entity";
import dungeon from "../dungeon";

// Keep the teleport destination out of the columns hidden under the UI
// sidebar (matches the constant used by scene0's spawn logic).
const MAX_VISIBLE_X = 67;

export default class ScrollOfTeleport extends Entity {
  textureKey = "scroll-teleport";
  type: EntityType = "item";
  tier = 1;
  equipSlot: "consumable" = "consumable";
  identified = false;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 15 * 49 + 38;
    this.name = "Scroll of Teleport";
    this.description = "Teleports you to a random walkable tile.";
    this.consumable = true;

    this.init(context, x, y);
  }

  equip() {
    const player = this.context.player;
    if (!player) return;

    const map = this.context.currentLevel;
    if (!map) {
      dungeon.log(this.context, "The scroll fizzles.");
      player.removeItem(this);
      removeEntity(this.context, this);
      return;
    }

    const occupied = new Set<string>();
    for (const e of this.context.entities) {
      if (e.sprite && e.x !== undefined && e.y !== undefined) {
        occupied.add(`${e.x},${e.y}`);
      }
    }

    const candidates: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[0].length; x++) {
        if (x >= MAX_VISIBLE_X) continue;
        if (map[y][x] !== 0) continue;
        if (occupied.has(`${x},${y}`)) continue;
        if (x === this.context.stairsX && y === this.context.stairsY) continue;
        candidates.push({ x, y });
      }
    }

    if (candidates.length === 0) {
      dungeon.log(this.context, "The scroll fizzles — nowhere to teleport to.");
    } else if (player.x !== undefined && player.y !== undefined) {
      const dest = candidates[Math.floor(Math.random() * candidates.length)];
      player.x = dest.x;
      player.y = dest.y;
      if (player.sprite && this.context.map) {
        player.sprite.setPosition(
          this.context.map.tileToWorldX(dest.x)!,
          this.context.map.tileToWorldY(dest.y)!
        );
      }
      dungeon.log(this.context, "You are teleported elsewhere.");
    }

    player.removeItem(this);
    removeEntity(this.context, this);
  }

  damage() {
    return 0;
  }

  turn() {
  }

  refresh() {
  }

  isOver() {
    return true;
  }

  attack(): number {
    return 0;
  }

  protection(): number {
    return 0;
  }

  range(): number {
    return 0;
  }

  onDestroy() {
  }
}
