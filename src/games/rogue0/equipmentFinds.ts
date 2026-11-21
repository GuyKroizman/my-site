import type { GameContext } from './context';
import { armorLootTier, isBossFloor, lootTier } from './progression';
import { TieredWeapon, TieredArmor } from './items/tieredEquipment';
import { rollFoundUpgrade } from './foundUpgrades';
import { maybeCurse } from './curses';
import { rollEquipmentGlyph } from './equipmentGlyphs';

// Bone piles always hold gear and are the main equipment source, so armor and
// weapons found anywhere else spawn at a third of their former rate.
export const NON_REMAINS_EQUIPMENT_SCALE = 1 / 3;
// Independent bonus find, in addition to existing supplies and weighted loot.
// One third of the old 30% roll.
export const FLOOR_EQUIPMENT_CHANCE = 0.10;

export function rollFloorEquipment(floor: number, random: () => number = Math.random): boolean {
  return !isBossFloor(floor) && random() < FLOOR_EQUIPMENT_CHANCE;
}

export function createEquipmentFind(context: GameContext, x?: number, y?: number) {
  const Gear = Math.random() < 0.5 ? TieredWeapon : TieredArmor;
  const tier = Gear === TieredArmor ? armorLootTier(context.floor) : lootTier(context.floor);
  const item = new Gear(context, x, y, tier);
  rollFoundUpgrade(item);
  maybeCurse(item);
  rollEquipmentGlyph(item);
  // Tiered gear starts unidentified; neither upgrades nor curses reveal it.
  return item;
}
