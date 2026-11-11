/** Layout of the legacy 16x16 sprite sheet (`public/colored.png`), which is
 * loaded as the `tiles` / `foreground-tiles` spritesheet. Frames are numbered
 * row-major, so the index of a cell is `row * SHEET_COLUMNS + column`.
 *
 * Named frames keep that arithmetic in one place: call sites name what they
 * draw instead of repeating `row * 49 + col`, and swapping a sprite for
 * generated art only needs the entry here to change.
 */
export const SHEET_COLUMNS = 49;
export const SHEET_ROWS = 22;

/** Frame index of one cell, addressed by column and row. */
export function sheetFrame(column: number, row: number): number {
  return row * SHEET_COLUMNS + column;
}

/** Legacy sheet frames, addressed as (column, row) of `public/colored.png`. */
export const Sheet = {
  // Terrain features that still draw straight from the sheet.
  doorClosed: sheetFrame(3, 3),
  doorOpen: sheetFrame(7, 6),
  grass: sheetFrame(7, 0),
  water: sheetFrame(10, 4),

  // Heroes, used until a class has generated artwork of its own.
  elf: sheetFrame(28, 1),
  wizard: sheetFrame(24, 1),
  cleric: sheetFrame(24, 2),
  dwarf: sheetFrame(29, 9),
  /** HUD avatar fallback while the hero has no sprite yet. */
  heroFallback: sheetFrame(26, 0),

  // Monsters that still draw from the sheet.
  ghoul: sheetFrame(26, 6),
  brute: sheetFrame(28, 6),
  skeleton: sheetFrame(29, 6),
  quloptsh: sheetFrame(30, 6),

  // Weapons and armour fallbacks.
  dagger: sheetFrame(34, 6),
  longSword: sheetFrame(35, 6),
  hammer: sheetFrame(37, 7),
  axe: sheetFrame(39, 7),
  shield: sheetFrame(41, 15),
  shoe: sheetFrame(32, 19),

  // Treasure.
  chest: sheetFrame(8, 6),
  gem: sheetFrame(23, 4),
  cursedGem: sheetFrame(22, 4),
  ration: sheetFrame(34, 14),

  // Rings.
  ringOfAccuracy: sheetFrame(24, 4),
  ringOfEvasion: sheetFrame(25, 4),
  ringOfElements: sheetFrame(26, 4),
  ringOfHaste: sheetFrame(27, 4),
  ringOfMight: sheetFrame(28, 4),

  // Potions.
  berserkPotion: sheetFrame(33, 13),
  potionOfHealing: sheetFrame(38, 13),
  potionOfStrength: sheetFrame(39, 13),
  potionOfInvisibility: sheetFrame(40, 13),
  potionOfToxicGas: sheetFrame(41, 13),
  potionOfLiquidFlame: sheetFrame(42, 13),
  potionOfFrost: sheetFrame(43, 13),
  potionOfLevitation: sheetFrame(44, 13),
  potionOfExperience: sheetFrame(45, 13),

  // Scrolls.
  scrollOfFireball: sheetFrame(33, 15),
  scrollOfLightning: sheetFrame(34, 15),
  scrollOfIdentify: sheetFrame(35, 15),
  scrollOfUpgrade: sheetFrame(36, 15),
  scrollOfRemoveCurse: sheetFrame(37, 15),
  scrollOfTeleport: sheetFrame(38, 15),
  scrollOfRage: sheetFrame(39, 15),
  scrollOfTerror: sheetFrame(40, 15),
  // Shares a cell with the shield art; the sheet never had a recharging glyph.
  scrollOfRecharging: sheetFrame(41, 15),

  // Wands.
  wandOfFirebolt: sheetFrame(42, 15),
  wandOfFrost: sheetFrame(43, 15),
  wandOfLightning: sheetFrame(44, 15),

  // In-flight attack art. Most attacks now carry a generated projectile
  // texture; these frames remain the tilesheet fallback.
  flameProjectile: sheetFrame(15, 10),
  frostProjectile: sheetFrame(18, 10),
  lightningProjectile: sheetFrame(19, 10),
  lightningBolt: sheetFrame(21, 8),
  /** Goblin bolts are a generated texture, so the AI only needs a truthy
   * frame to take its ranged branch. */
  goblinRangedAttack: sheetFrame(15, 10),
  /** Default `Entity.attackTile`, also what routes the cultist's ranged AI. */
  defaultAttack: sheetFrame(11, 11)
} as const;
