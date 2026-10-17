// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity } from "../entity";

export default class Hammer extends Entity {
  type: EntityType = "item";
  tier = 1;
  equipSlot: "weapon" = "weapon";

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 7 * 49 + 37;
    this.name = "A war hammer";
    this.description = "A basic war hammer. Causes between 3 and 8 damage.";

    this.init(context, x, y);
}

    equip() {
    }

    damage() {
      return Phaser.Math.Between(3, 8) + this.level;
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
