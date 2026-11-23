// Five-floor regions establish progression pacing, not themed regions yet.
export const REGION_SIZE = 5;
export const FINAL_FLOOR = 25;
export const REGIONS_PER_RUN = FINAL_FLOOR / REGION_SIZE;

export function xpForHeroLevel(level: number): number {
  return 8 * level;
}

// Scrolls of Upgrade are a fixed part of the run budget, never a random roll.
// A standard run therefore contains exactly 15: three per five-floor region,
// on the region's first, third and fourth floors. The fifth floor of every
// region is its boss floor and never carries one.
export const UPGRADE_SCROLLS_PER_REGION = 3;
export const UPGRADE_SCROLL_FLOOR_POSITIONS = [1, 3, 4] as const;
export const TOTAL_UPGRADE_SCROLLS = REGIONS_PER_RUN * UPGRADE_SCROLLS_PER_REGION;

// Chasm wounds get nastier as the run descends: 1 damage per turn through
// floor 6, 2 by floor 7, 3 by floor 13 and 4 from floor 19 to the bottom.
export const WOUND_DAMAGE_FLOOR_STEP = 6;
export const WOUND_DAMAGE_MAX_PER_TURN = 4;

export function woundDamageForFloor(floor: number): number {
  if (!Number.isInteger(floor) || floor <= 0) return 1;
  return Math.min(WOUND_DAMAGE_MAX_PER_TURN, Math.ceil(floor / WOUND_DAMAGE_FLOOR_STEP));
}

export function isBossFloor(floor: number): boolean {
  return Number.isInteger(floor) && floor > 0 && floor % REGION_SIZE === 0;
}

// A boss floor stays sealed until the Writhing Maw is recorded as slain. The
// context shape is structural so progression does not depend on the scene.
export function bossSealsFloor(
  context: { floor: number; bossesSlain?: ReadonlySet<number> }
): boolean {
  return isBossFloor(context.floor) && !(context.bossesSlain?.has(context.floor) ?? false);
}

export function upgradeScrollsForFloor(floor: number): number {
  if (!Number.isInteger(floor) || floor < 1 || isBossFloor(floor)) return 0;
  const position = ((floor - 1) % REGION_SIZE) + 1;
  return (UPGRADE_SCROLL_FLOOR_POSITIONS as readonly number[]).includes(position) ? 1 : 0;
}

export function floorProgression(floor: number) {
  const band = Math.min(REGIONS_PER_RUN, Math.max(1, Math.ceil(floor / REGION_SIZE)));
  const position = ((floor - 1) % REGION_SIZE) + 1;
  return {
    strengthPotions: position === 2 || position === 4 ? 1 : 0,
    upgradeScrolls: upgradeScrollsForFloor(floor),
    // One guaranteed weapon and armor per band. The rest remain random finds.
    weapon: position === 1,
    armor: position === 3,
    tier: band,
  };
}

// Usually current-band gear, sometimes an early heavier find or older gear.
export function lootTier(floor: number, roll = Math.random()): number {
  const tier = floorProgression(floor).tier;
  return Math.max(1, Math.min(5, tier + (roll < 0.2 ? -1 : roll >= 0.8 ? 1 : 0)));
}

// The first band used to hand out almost nothing but tier-1 "Cloth Armor":
// every loot tier roll there lands on 1 unless it happens to go up a tier.
// Keep only a minority of those finds as cloth and roll the rest as tier-2
// Leather Armor, so early floors offer a mix instead of a pile of the same
// suit. Weapons keep the original curve, and the single guaranteed band armor
// (floor 3) stays tier 1 as the starter suit.
export const TIER1_ARMOR_KEEP_CHANCE = 0.35;

export function thinTier1Armor(tier: number, keepRoll?: number): number {
  if (tier !== 1) return tier;
  return (keepRoll ?? Math.random()) < TIER1_ARMOR_KEEP_CHANCE ? 1 : 2;
}

export function armorLootTier(floor: number, roll = Math.random(), keepRoll?: number): number {
  const tier = lootTier(floor, roll);
  return tier === 1 ? thinTier1Armor(tier, keepRoll ?? Math.random()) : tier;
}
