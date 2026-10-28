// TypeScript errors after site migration - ignoring for game functionality
import type { EntityType } from "../entity";
import { Entity } from "../entity";
import type { GameContext } from "../context";

export default class LongSword extends Entity {
  name: string = "A Long Sword";
  get baseDescription(): string {
    return `A long sword. Causes between ${4 + this.level} and ${8 + (this.tier + 1) * this.level} damage. Upgrades add +1 minimum and +${this.tier + 1} maximum damage.`;
  }
  tile = 329;
  tier = 1;
  usesStrength = true;
  equipSlot: "weapon" = "weapon";
  healthPoints: number = 0;
  moving: boolean = false;
  type: EntityType = "item";

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.init(context, x, y);
  }

  equip() {

  }

  damage() {
    return Phaser.Math.Between(4 + this.level, 8 + (this.tier + 1) * this.level);
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
