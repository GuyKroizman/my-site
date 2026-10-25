import Phaser from "phaser";
import { Entity, type EntityType, type EquipSlot } from "../entity";
import type { GameContext } from "../context";

// Initial progression curves, independent of hero XP. Legacy class starting
// equipment remains usable; these are the dungeon's complete tiered roster.
export class TieredWeapon extends Entity {
  type: EntityType = "item";
  equipSlot: EquipSlot = "weapon";
  usesStrength = true;
  identified = false;

  constructor(context: GameContext, x?: number, y?: number, tier = 1) {
    super();
    this.tier = Math.max(1, Math.min(5, Math.floor(tier)));
    this.name = ["Dagger", "Shortsword", "Broadsword", "Greatsword", "Greataxe"][this.tier - 1];
    this.attackDelay = [0.8, 1, 1, 1.2, 1.4][this.tier - 1];
    this.tile = 328; // Existing weapon art until the dedicated art pass.
    this.init(context, x, y);
  }

  get minDamage(): number { return this.tier + this.level; }
  get maxDamage(): number { return 5 * this.tier + (this.tier + 1) * this.level; }
  get displayDescription(): string {
    return `Causes between ${this.minDamage} and ${this.maxDamage} damage. Attack delay: ${this.attackDelay}. Upgrades add +1 minimum and +${this.tier + 1} maximum damage.`;
  }
  damage(): number { return Phaser.Math.Between(this.minDamage, this.maxDamage); }
  protection(): number { return 0; }
  attack(): number { return 0; }
  range(): number { return 0; }
  equip(): void {}
  turn(): void {}
  refresh(): void {}
  isOver(): boolean { return true; }
  onDestroy(): void {}
}

export class TieredArmor extends Entity {
  type: EntityType = "item";
  equipSlot: EquipSlot = "armor";
  usesStrength = true;
  identified = false;

  constructor(context: GameContext, x?: number, y?: number, tier = 1) {
    super();
    this.tier = Math.max(1, Math.min(5, Math.floor(tier)));
    this.name = ["Cloth Armor", "Leather Armor", "Mail Armor", "Scale Armor", "Plate Armor"][this.tier - 1];
    this.tile = 776; // Shield silhouette is temporary, not a second armor slot.
    this.init(context, x, y);
  }

  get displayDescription(): string {
    return `Absorbs ${this.protection()} physical damage. Each upgrade adds ${this.tier} protection. Occupies the armor slot (replaces a shield).`;
  }
  protection(): number { return 2 * this.tier + this.tier * this.level; }
  damage(): number { return 0; }
  attack(): number { return 0; }
  range(): number { return 0; }
  equip(): void {}
  turn(): void {}
  refresh(): void {}
  isOver(): boolean { return true; }
  onDestroy(): void {}
}
