// Shared base for the Phase 6 wands.
//
// A wand is a ranged weapon with finite `charges`. It deals its damage through
// `damage()` (the same path melee weapons use) and, while it has charges left,
// contributes an on-hit status effect by patching the equipped hero's
// `onHitEffects()` for as long as it stays equipped. At 0 charges it deals no
// damage and logs that the wand is spent.
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
  equipSlot: "weapon" = "weapon";
  identified = false;
  charges: number = 0;
  maxCharges: number = 0;
  wandRange: number = 5;

  private originalOnHitEffects: (() => StatusEffect[]) | undefined;

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

  abstract wandDamage(): number;
  abstract wandEffect(): StatusEffect;

  equip() {
    const player = this.context.player;
    if (!player) return;

    this.originalOnHitEffects = player.onHitEffects;
    player.onHitEffects = () => this.hitEffects();
  }

  unequip() {
    const player = this.context.player;
    if (player && this.originalOnHitEffects) {
      player.onHitEffects = this.originalOnHitEffects;
      this.originalOnHitEffects = undefined;
    }
  }

  private hitEffects(): StatusEffect[] {
    return this.charges > 0 ? [this.wandEffect()] : [];
  }

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
