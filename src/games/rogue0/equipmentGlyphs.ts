// Weapon and armor glyphs.
//
// A glyph is a single magical mark on physical gear. Weapons can roll fire,
// frost, luck, reach or push; armor can roll thorns or push. Generation,
// the infuse stone and the combat procs all share this module, which is
// deliberately pure (type-only entity import) so the isolated logic loader
// and Node can evaluate it without Phaser or dungeon dependencies.

import type { Entity } from "./entity";

export const WEAPON_GLYPHS = ["fire", "frost", "luck", "range", "push"] as const;
export const ARMOR_GLYPHS = ["thorns", "push"] as const;

export type WeaponGlyph = (typeof WEAPON_GLYPHS)[number];
export type ArmorGlyph = (typeof ARMOR_GLYPHS)[number];
export type EquipmentGlyph = WeaponGlyph | ArmorGlyph;

// Freshly found/dropped physical gear rolls a glyph this often.
export const EQUIPMENT_GLYPH_CHANCE = 0.25;
export const ARMOR_GLYPH_REFLECT_RATIO = 0.25;

const GLYPH_NAMES: Record<EquipmentGlyph, string> = {
  fire: "Fire",
  frost: "Frost",
  luck: "Luck",
  range: "Reach",
  push: "Push",
  thorns: "Thorns"
};

const WEAPON_GLYPH_DESCRIPTIONS: Record<WeaponGlyph, string> = {
  fire: "Successful hits set the target on fire, dealing 1 fire damage per turn for 3 turns.",
  frost: "Successful hits chill the target and can freeze it for one action.",
  luck: "Enemies you slay are more likely to drop loot or gold.",
  range: "This weapon can strike enemies up to 2 tiles away.",
  push: "Successful hits knock the target back one tile."
};

const ARMOR_GLYPH_DESCRIPTIONS: Record<ArmorGlyph, string> = {
  thorns: "Melee attackers take back a quarter of the damage they deal to you.",
  push: "Melee attackers are knocked back one tile."
};

export function equipmentGlyphName(glyph: EquipmentGlyph | ""): string {
  if (!glyph) return "";
  return GLYPH_NAMES[glyph] ?? glyph;
}

export function equipmentGlyphDescription(
  glyph: EquipmentGlyph | "",
  slot?: "weapon" | "armor"
): string {
  if (!glyph) return "";
  if (slot === "weapon" && glyph in WEAPON_GLYPH_DESCRIPTIONS) {
    return WEAPON_GLYPH_DESCRIPTIONS[glyph as WeaponGlyph];
  }
  if (slot === "armor" && glyph in ARMOR_GLYPH_DESCRIPTIONS) {
    return ARMOR_GLYPH_DESCRIPTIONS[glyph as ArmorGlyph];
  }
  return equipmentGlyphName(glyph);
}

// Which glyph slot an item belongs to, or null when it can never hold a glyph.
// Wizard scroll weapons are magical tools, not physical gear, so they never
// roll or accept glyphs.
export function glyphSlotOf(item: Entity): "weapon" | "armor" | null {
  if (!item || item.type !== "item") return null;
  if (item.equipSlot === "weapon" && !/^scroll/i.test(item.name)) return "weapon";
  if (item.equipSlot === "armor") return "armor";
  return null;
}

export function glyphEligible(item: Entity): boolean {
  return glyphSlotOf(item) !== null;
}

export function rollRandomGlyph(
  item: Entity,
  random: () => number = Math.random
): EquipmentGlyph | "" {
  const slot = glyphSlotOf(item);
  if (!slot) return "";
  const table = slot === "weapon" ? WEAPON_GLYPHS : ARMOR_GLYPHS;
  return table[Math.floor(random() * table.length)] ?? "";
}

// Assign a glyph to freshly generated gear. Returns true when a glyph was
// added. Like maybeCurse, this consumes one random draw for the chance and a
// second draw only when a glyph actually lands.
export function rollEquipmentGlyph(
  item: Entity,
  chance = EQUIPMENT_GLYPH_CHANCE,
  random: () => number = Math.random
): boolean {
  if (!glyphEligible(item) || item.glyph) return false;
  if (random() >= chance) return false;
  const glyph = rollRandomGlyph(item, random);
  if (!glyph) return false;
  item.glyph = glyph;
  return true;
}
