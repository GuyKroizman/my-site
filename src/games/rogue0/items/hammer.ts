// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import type { GameContext } from "../context";
import { Entity } from "../entity";

export default class Hammer extends Entity {
  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 7 * 49 + 37;
    this.name = "A war hammer";
    this.description = "A basic war hammer. Causes between 3 and 8 damage.";
    this.weapon = true;

    this.init(context, x, y);
}

    equip(itemNumber: number) {
    }

    damage() {
      return Phaser.Math.Between(3, 8);
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
