// Five-floor regions establish progression pacing, not themed regions yet.
export const REGION_SIZE = 5;
export const FINAL_FLOOR = 25;
export const REGIONS_PER_RUN = FINAL_FLOOR / REGION_SIZE;

// Scrolls of Upgrade are a fixed part of the run budget, never a random roll.
// A standard run therefore contains exactly 15: three per five-floor region,
// on the region's first, third and fourth floors. The fifth floor of every
// region is its boss floor and never carries one.
export const UPGRADE_SCROLLS_PER_REGION = 3;
export const UPGRADE_SCROLL_FLOOR_POSITIONS = [1, 3, 4] as const;
export const TOTAL_UPGRADE_SCROLLS = REGIONS_PER_RUN * UPGRADE_SCROLLS_PER_REGION;

export function isBossFloor(floor: number): boolean {
  return Number.isInteger(floor) && floor > 0 && floor % REGION_SIZE === 0;
}

// A boss floor stays sealed until its guardian is recorded as slain. The
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
