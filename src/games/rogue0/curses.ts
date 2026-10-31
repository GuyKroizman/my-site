// Curse assignment helpers. Pure functions: no dungeon/Phaser dependencies,
// so generation (scene0, chest) and tests can call them in isolation.

import type { Entity } from "./entity";
import {
  CURSE_GENERATION_CHANCE,
  CURSE_TABLES,
} from "./curseData";
import type { CurseId, CurseSlot } from "./curseData";

// Items that may roll a named curse. Wands/artifacts/consumables stay clean.
export function curseEligible(item: Entity): boolean {
  return item.type === "item" &&
    (item.equipSlot === "weapon" || item.equipSlot === "armor" || item.equipSlot === "ring");
}

export function rollCurseId(item: Entity, random: () => number = Math.random): CurseId | null {
  const table = CURSE_TABLES[item.equipSlot as CurseSlot];
  if (!table || table.length === 0) return null;
  return table[Math.floor(random() * table.length)];
}

// Assign a named curse to a freshly generated item. Returns true if cursed.
// `random` is injectable so regression tests can force outcomes.
export function maybeCurse(
  item: Entity,
  chance = CURSE_GENERATION_CHANCE,
  random: () => number = Math.random
): boolean {
  if (!curseEligible(item) || item.cursed) return false;
  if (random() >= chance) return false;
  const curseId = rollCurseId(item, random);
  if (!curseId) return false;
  item.cursed = true;
  item.curseId = curseId;
  return true;
}
