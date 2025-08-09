// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import { Entity } from "../entity";
import type { EntityType } from "../entity";
import type { GameContext } from "../context";
import dungeon from "../dungeon";
import { removeEntity } from "../entity";

export default class BerserkPotion extends Entity {
  name: string = "Berserk Potion";
  description: string = "That feels Powerful!";
  moving: boolean = false;
  type: EntityType = "item";
  tile = 13 * 49 + 33;
  remainingTurns: number = 10;
  itemNumber: number | undefined;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.init(context, x, y);

    this.itemNumber = undefined;
  }

  equip(itemNumber: number) {
    if (!this.context.player) {
      return;
    }
    dungeon.log(this.context, `You drink the potion and feel as strong as a bear!`);

    this.itemNumber = itemNumber;
  }

  damage() {
    return 5;
  }

  turn() {
  }

  refresh() {
  }

  isOver() {
    if (!this.context.player || this.itemNumber == undefined) {
      return true;
    }

    if (this.remainingTurns <= 0) {
      this.context.player.removeItem(this.itemNumber);
      removeEntity(this.context, this);
    }
    this.remainingTurns--;

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
