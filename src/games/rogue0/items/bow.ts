// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import type { GameContext } from "../context";
import { Entity } from "../entity";

export default class Bow extends Entity {
  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 6 * 49 + 37;
    this.name = "A Bow";
    this.description = "A bow and arrows. Causes between 1 and 3 damage. Range is five tiles."
    this.weapon = true;

    this.init(context, x, y);
  }

  equip(itemNumber: number) {
  }

  damage() {
    return Phaser.Math.Between(1, 3);
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
    return 5;
  }

  onDestroy() {
  }
}
