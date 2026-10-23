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
    this.description = "A scroll of fireball. Causes between 1 and 4 damage. Range is four tiles.";
    this.attackTile = 10 * 49 + 15;
    this.damageType = "fire";

    this.init(context, x, y);
  }

  equip() {
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
