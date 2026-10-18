// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity } from "../entity";
import dungeon from "../dungeon";

export default class LargeRation extends Entity {
  type: EntityType = "item";
  tier = 2;
  equipSlot: "consumable" = "consumable";

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 16 * 49 + 33;
    this.name = "Large Ration";
    this.description = "A large ration that restores 70 hunger.";
    this.consumable = true;
    this.identified = false;

    this.init(context, x, y);
  }

  get displayName(): string {
    return this.identified ? this.name : "?large ration";
  }

  equip() {
    if (!this.context.player) {
      return;
    }

    this.context.player.restoreHunger(70);
    dungeon.log(this.context, `You eat the ${this.name} and restore 70 hunger.`);
    this.context.player.removeItem(this);
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
