// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity } from "../entity";

export default class ScrollOfFireball extends Entity {
  type: EntityType = "item";
  textureKey = "scroll-fireball";
  tier = 1;
  equipSlot: "weapon" = "weapon";

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 15 * 49 + 33;
    this.name = "Scroll of Fireball";
    this.attackTile = 10 * 49 + 15;
    this.damageType = "fire";

    this.init(context, x, y);
  }

  equip() {
  }

  get displayDescription(): string {
    return `A scroll of fireball. Causes between ${1 + this.level} and ${4 + this.level} damage. Range is ${this.range()} tiles.`;
  }

  damage() {
    return Phaser.Math.Between(1, 4) + this.level;
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
