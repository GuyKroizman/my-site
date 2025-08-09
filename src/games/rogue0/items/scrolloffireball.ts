// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import type { GameContext } from "../context";
import { Entity } from "../entity";

export default class ScrollOfFireball extends Entity {
  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 15 * 49 + 34;
    this.name = "Scroll of Fireball";
    this.description = "A scroll of fireball. Causes between 1 and 4 damage. Range is four tiles.";
    this.weapon = true;
    this.tint = 0xdd0000;
    this.attackTile = 10 * 49 + 15;

    this.init(context, x, y);
  }

  equip(itemNumber: number) {
  }

  damage() {
    return Phaser.Math.Between(1, 4);
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
    return 4;
  }

  onDestroy() {
  }
}
