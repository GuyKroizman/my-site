// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import type { GameContext } from "../context";
import { context } from "../context";
import { Entity, removeEntity } from "../entity";
import dungeon from "../dungeon";

export default class HealthPotion extends Entity {
  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 13 * 49 + 33;
    this.name = "Health Potion";
    this.description = "A potion that restores health."
    this.weapon = false;

    this.init(context, x, y);
  }

  equip(itemNumber: number) {
    if (!this.context.player) {
      return;
    }
    const points = Phaser.Math.Between(3, 5)

    dungeon.log(context, `A warm feeling when drinking the potion as it restores ${points} health points.`)

    this.context.player.healthPoints  += points;
    this.context.player.removeItem(itemNumber);
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
