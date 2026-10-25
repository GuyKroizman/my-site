// Five-floor bands establish progression pacing, not themed regions yet.
export function floorProgression(floor: number) {
  const band = Math.min(5, Math.max(1, Math.ceil(floor / 5)));
  const position = ((floor - 1) % 5) + 1;
  return {
    strengthPotions: position === 2 || position === 4 ? 1 : 0,
    upgradeScrolls: position === 1 || position === 3 || position === 4 ? 1 : 0,
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
