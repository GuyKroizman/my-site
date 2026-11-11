// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity } from "../entity";
import { SHOCKBOLT_TEXTURE } from '../projectileTextures';

export default class ScrollOfLightning extends Entity {
  type: EntityType = "item";
  textureKey = "scroll-lightning";
  tier = 1;
  equipSlot: "weapon" = "weapon";

  constructor(context: GameContext, x?: number, y?: number) {
    super();

    this.name = "Scroll of Lightning";
    this.attackTile = 1;
    this.projectileTexture = SHOCKBOLT_TEXTURE;
    this.damageType = "shock";

    this.init(context, x, y);
  }

  equip() {
  }

  get baseDescription(): string {
    return `Causes between ${1 + this.level} and ${2 + this.level} damage. Range is ${this.range()} tiles.`;
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
