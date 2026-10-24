// Shared base for the Phase 6 wands.
//
// Wands stay in the backpack and zap through targeting, never replacing
// the main weapon. Each valid zap consumes one charge, even on a miss.
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, identify } from "../entity";
import type { DamageType, StatusEffect } from "../effects";
import dungeon from "../dungeon";

export type WandConfig = {
  name: string;
  description: string;
  tile: number;
  attackTile: number;
  damageType: DamageType;
  charges: number;
  range?: number;
};

export default abstract class Wand extends Entity {
  type: EntityType = "item";
  tier = 1;

  identified = false;
  charges: number = 0;
  maxCharges: number = 0;
  wandRange: number = 5;

  // Category is intrinsic, not derived from the equipment slot: wands are
  // backpack tools, but remain recognizable before their magic is identified.
  get displayName(): string {
    return this.identified ? super.displayName : "Wand";
  }

  get unidentifiedTextureKey(): string {
    return "unknown-wand";
  }


  constructor(context: GameContext, config: WandConfig, x?: number, y?: number) {
    super();
    this.name = config.name;
    this.description = config.description;
    this.tile = config.tile;
    this.textureKey = `wand-${config.damageType}`;
    this.attackTile = config.attackTile;
    this.damageType = config.damageType;
    this.charges = config.charges;
    this.maxCharges = config.charges;
    this.wandRange = config.range ?? 5;

    this.init(context, x, y);
  }

  abstract get damageBounds(): readonly [number, number];
  abstract wandEffect(): StatusEffect;

  wandDamage(): number {
    const [min, max] = this.damageBounds;
    return Phaser.Math.Between(min, max);
  }

  get displayDescription(): string {
    const [min, max] = this.damageBounds;
    return `${this.description} Causes between ${min + this.level} and ${max + this.level} damage. Range is ${this.range()} tiles. Charges: ${this.charges}/${this.maxCharges}.`;
  }

  equip() {}

  unequip() {}

  // Restore this wand to full charges (used by Scroll of Recharging).
  refill(): void {
    this.charges = this.maxCharges;
  }

  damage() {
    // Wands reveal themselves on first successful zap, mirroring how potions
    // and scrolls identify on use.
    if (!this.identified) {
      identify(this);
    }

    if (this.charges <= 0) {
      dungeon.log(this.context, "The wand is spent.");
      return 0;
    }

    this.charges -= 1;
    if (this.charges === 0) {
      dungeon.log(this.context, "The wand is spent.");
    }

    return this.wandDamage() + this.level;
  }

  range() {
    return this.wandRange;
  }

  attack() {
    return 0;
  }

  protection() {
    return 0;
  }

  turn() {
  }

  refresh() {
  }

  isOver() {
    return true;
  }

  onDestroy() {
  }
}
