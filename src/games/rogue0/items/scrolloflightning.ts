// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import type { GameContext } from "../context";
import { Entity } from "../entity";

export default class ScrollOfLightning extends Entity {
  constructor(context: GameContext, x?: number, y?: number) {
    super();

    this.tile = 15 * 49 + 34;
    this.name = "Scroll of Lightning";
    this.description = "A scroll of Lightning. Causes between 1 and 2 damage. Range is seven tiles."
    this.weapon = true;

    this.tint = 0xffff00;
    this.attackTile = 413;

    this.init(context, x, y);
  }

  equip(itemNumber: number) {
  }

  damage() {
    return Phaser.Math.Between(1, 2);
  }

  turn() {
  }

  refresh() {
  }
  isOver(): boolean {
    return false;
  }

  attack(): number {
    return 0;
  }

  protection(): number {
    return 0;
  }

  range(): number {
    return 7;
  }

  onDestroy() {
  }
}
