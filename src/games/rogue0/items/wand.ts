// Shared base for the Phase 6 wands.
//
// Wands stay in the backpack and zap through targeting, never replacing
// the main weapon. Each valid zap consumes one charge, even on a miss.
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity } from "../entity";
import type { DamageType, StatusEffect } from "../effects";
import dungeon from "../dungeon";

export type WandConfig = {
  name: string;
  description: string;
  /** Truthy marker: the attack is ranged. The visible bolt comes from
   * `projectileTexture`, so this never selects atlas art. */
  attackTile: number;
  projectileTexture?: string;
  damageType: DamageType;
  charges: number;
};

export default abstract class Wand extends Entity {
  type: EntityType = "item";
  tier = 1;

  protected locallyIdentified = false;
  charges: number = 0;
  maxCharges: number = 0;
  // Pre-scaling charge capacity; maxCharges is derived from this plus level.
  baseMaxCharges: number = 0;
  // Ordinary wands are 1. Fire-fusing two wands adds their values, so two
  // singles make 2 and a ×2 fused with a single makes 3. Damage and charge
  // capacity are multiplied by this value; missing values in older saves
  // mean 1.
  fusionCount: number = 1;
  // Stored with the item so partial recharge survives saves and floor travel.
  private rechargeProgress = 0;
  readonly rechargeInterval = 20;

  // Category is intrinsic, not derived from the equipment slot: wands are
  // backpack tools, but remain recognizable before their magic is identified.
  get fusionPower(): number {
    const count = Number(this.fusionCount);
    return Number.isFinite(count) && count > 1 ? Math.floor(count) : 1;
  }

  get displayName(): string {
    const base = this.identified
      ? super.displayName
      : `Wand “${this.unidentifiedName}” ?`;
    return this.fusionPower > 1 ? `${base} ×${this.fusionPower}` : base;
  }

  get unidentifiedTextureKey(): string {
    return "unknown-wand";
  }

  // Badge shown beside the wand in quick slots. An unidentified wand keeps its
  // remaining zaps hidden, matching the unknown kind and upgrade level.
  get chargeBadge(): string {
    return this.identified ? `${this.charges}` : "";
  }


  constructor(context: GameContext, config: WandConfig, x?: number, y?: number) {
    super();
    this.name = config.name;
    this.description = config.description;
    this.textureKey = `wand-${config.damageType}`;
    this.attackTile = config.attackTile;
    this.projectileTexture = config.projectileTexture ?? this.projectileTexture;
    this.damageType = config.damageType;
    this.charges = config.charges;
    this.maxCharges = config.charges;
    this.baseMaxCharges = config.charges;

    this.init(context, x, y);
  }

  abstract get damageBounds(): readonly [number, number];
  wandEffect(): StatusEffect | undefined { return undefined; }

  // Utility wands can replace damage resolution with their own impact.
  applySpecialImpact(_caster: Entity, _target: Entity): boolean { return false; }

  // Most wands apply one status; frost applies the freeze and the slow.
  // Zap impact uses this list, single-effect callers use `wandEffect`.
  wandEffects(): StatusEffect[] {
    const effect = this.wandEffect();
    return effect ? [effect] : [];
  }

  wandDamage(): number {
    const [min, max] = this.damageBounds;
    return Math.round(Phaser.Math.Between(min, max) * this.fusionPower);
  }

  // Wands may specialise against particular foes; the fire wand is super
  // effective against ice-elemental enemies. The base wand deals normal damage.
  wandDamageMultiplier(_target: Entity): number {
    return 1;
  }

  // Whether a successful zap arcs into adjacent actors. Only the lightning wand
  // chains; other wands hit a single target.
  arcsToAdjacent(): boolean {
    return false;
  }

  get baseDescription(): string {
    const [min, max] = this.damageBounds;
    const power = this.fusionPower;
    return `${this.description} Causes between ${(min + this.level) * power} and ${(max + this.level) * power} damage. Charges: ${this.charges}/${this.maxCharges}.`;
  }

  equip() {}

  unequip() {}

  // Keep maxCharges in sync with the upgrade level. Older saves predate
  // charge scaling and recorded maxCharges as the base value, so derive from
  // those saves rather than leaving upgraded wands at their base capacity.
  reconcileChargeScaling(): void {
    if (this.baseMaxCharges == null || Number.isNaN(this.baseMaxCharges)) {
      this.baseMaxCharges = this.maxCharges ?? 3;
    }
    this.maxCharges = (this.baseMaxCharges + this.level) * this.fusionPower;
    if (this.charges > this.maxCharges) this.charges = this.maxCharges;
  }

  // Wands gain +1 current and maximum charge per upgrade, alongside damage.
  onUpgrade(): void {
    this.reconcileChargeScaling();
    this.charges = Math.min(this.maxCharges, this.charges + 1);
  }

  // Restore this wand to full charges (used by Scroll of Recharging).
  refill(): void {
    this.charges = this.maxCharges;
    this.rechargeProgress = 0;
  }

  damage() {
    // Wands reveal their type and upgrade level after extended use, like other
    // unknown equipment; a Scroll of Identify is faster.
    if (!this.identified) {
      this.learnEquipmentFromUse?.();
    }

    if (this.charges <= 0) {
      dungeon.log(this.context, "The wand is spent.");
      return 0;
    }

    if (this.charges >= this.maxCharges) this.rechargeProgress = 0;
    this.charges -= 1;
    if (this.charges === 0) {
      dungeon.log(this.context, "The wand is spent.");
    }

    return this.wandDamage() + this.level * this.fusionPower;
  }

  range() {
    // Ignore obsolete wandRange values retained by older browser saves.
    return Number.POSITIVE_INFINITY;
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
    if (this.charges >= this.maxCharges) {
      this.rechargeProgress = 0;
      return;
    }
    // Older browser saves have no progress field: start charging from zero.
    this.rechargeProgress = (this.rechargeProgress ?? 0) + 1;
    if (this.rechargeProgress >= (this.rechargeInterval ?? 20)) {
      this.charges = Math.min(this.maxCharges, this.charges + 1);
      this.rechargeProgress = 0;
    }
  }

  isOver() {
    return true;
  }

  onDestroy() {
  }
}
