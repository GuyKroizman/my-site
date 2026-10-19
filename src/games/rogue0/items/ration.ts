// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity } from "../entity";
import dungeon from "../dungeon";

export default class Ration extends Entity {
  type: EntityType = "item";
  tier = 1;
  equipSlot: "consumable" = "consumable";

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 14 * 49 + 34;
    this.name = "Ration of Food";
    this.description = "A ration of bread and dried food. Restores 35 hunger.";
    this.consumable = true;
    this.identified = true;

    this.init(context, x, y);
  }

  get displayName(): string {
    return this.identified ? this.name : "?ration";
  }

  equip() {
    if (!this.context.player) {
      return;
    }

    this.context.player.restoreHunger(35);
    dungeon.log(this.context, `You eat the ${this.name} and restore 35 hunger.`);
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
