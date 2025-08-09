// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import type { GameContext } from "../context";
import { Entity } from "../entity";

export default class Axe extends Entity {
  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 7 * 49 + 39;
    this.name = "An Axe";
    this.description = "A basic axe. Causes between 2 and 7 damage.";
    this.weapon = true;

    this.init(context, x, y);
  }

  equip(itemNumber: number) {
  }

  damage() {
    return Phaser.Math.Between(2, 7);
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
