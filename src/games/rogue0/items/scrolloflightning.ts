// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity } from "../entity";

export default class ScrollOfLightning extends Entity {
  type: EntityType = "item";
  textureKey = "scroll-lightning";
  tier = 1;
  equipSlot: "weapon" = "weapon";

  constructor(context: GameContext, x?: number, y?: number) {
    super();

    this.tile = 15 * 49 + 34;
    this.name = "Scroll of Lightning";
    this.attackTile = 413;
    this.damageType = "shock";

    this.init(context, x, y);
  }

  equip() {
  }

  get displayDescription(): string {
    return `A scroll of lightning. Causes between ${1 + this.level} and ${2 + this.level} damage. Range is ${this.range()} tiles.`;
  }

  damage() {
    return Phaser.Math.Between(1, 2) + this.level;
  }

  turn() {
  }

  refresh() {
  }
  isOver(): boolean {
    return true;
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
