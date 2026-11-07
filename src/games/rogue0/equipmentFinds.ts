import type { GameContext } from './context';
import { isBossFloor, lootTier } from './progression';
import { TieredWeapon, TieredArmor } from './items/tieredEquipment';
import { rollFoundUpgrade } from './foundUpgrades';
import { maybeCurse } from './curses';

// Independent bonus find, in addition to existing supplies and weighted loot.
export const FLOOR_EQUIPMENT_CHANCE = 0.30;
export const REMAINS_EQUIPMENT_CHANCE = 0.80;
export const CURSED_REMAINS_WRAITH_CHANCE = 0.50;

export function rollFloorEquipment(floor: number, random: () => number = Math.random): boolean {
  return !isBossFloor(floor) && random() < FLOOR_EQUIPMENT_CHANCE;
}

export function createEquipmentFind(context: GameContext, x?: number, y?: number) {
  const Gear = Math.random() < 0.5 ? TieredWeapon : TieredArmor;
  const item = new Gear(context, x, y, lootTier(context.floor));
  rollFoundUpgrade(item);
  maybeCurse(item);
  // Tiered gear starts unidentified; neither upgrades nor curses reveal it.
  return item;
}
