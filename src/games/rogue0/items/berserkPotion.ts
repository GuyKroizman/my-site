// TypeScript errors after site migration - ignoring for game functionality
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
  actionPoints: number = 1;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.consumable = true;
    this.init(context, x, y);
  }

  equip() {
    if (!this.context.player) {
      return;
    }
    dungeon.log(this.context, `You drink the potion and feel as strong as a bear!`);
    this.active = true;
  }

  damage() {
    return 5;
  }

  turn() {
    if (this.active) {
      this.remainingTurns -= 1;
      if (this.remainingTurns <= 0) {
        this.context.player?.removeItem(this);
        removeEntity(this.context, this);
      }
    }
    this.actionPoints = 0;
  }

  refresh() {
    this.actionPoints = 1;
  }

  isOver() {
    return this.actionPoints === 0;
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
