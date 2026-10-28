// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity } from "../entity";

export default class Hammer extends Entity {
  type: EntityType = "item";
  tier = 1;
  usesStrength = true;
  equipSlot: "weapon" = "weapon";
  attackDelay = 1.5;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 7 * 49 + 37;
    this.name = "A war hammer";

    this.init(context, x, y);
}

    equip() {
    }

    get baseDescription(): string {
      return `A basic war hammer. Causes between ${3 + this.level} and ${8 + (this.tier + 1) * this.level} damage. Upgrades add +1 minimum and +${this.tier + 1} maximum damage. Slow attack (${this.attackDelay} time).`;
    }

    damage() {
      return Phaser.Math.Between(3 + this.level, 8 + (this.tier + 1) * this.level);
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
