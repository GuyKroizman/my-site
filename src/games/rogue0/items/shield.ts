// TypeScript errors after site migration - ignoring for game functionality
import type { EntityType } from "../entity";
import { Entity } from "../entity";
import type { GameContext } from "../context";

export default class Shield extends Entity {
  type: EntityType = "item";
  tier = 1;
  usesStrength = true;
  equipSlot: "armor" = "armor";

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 776;
    this.name = "A Shield";

    this.init(context, x, y);
  }

  equip() {
  }


  get baseDescription(): string {
    return `A basic shield. Gives +${this.protection()} protection.`;
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
    return 1 + this.level;
  }

  range(): number {
    return 0;
  }

  onDestroy() {
  }
}
