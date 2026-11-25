import { FINAL_FLOOR, floorProgression, isBossFloor, xpForHeroLevel } from './progression.ts';
import { isWandFactoryFloor } from './bossEncounters.ts';

export type EncounterKind = 'skeleton' | 'frog' | 'swarm' | 'goblin' | 'quloptsh'
  | 'ghoul' | 'brute' | 'cultist' | 'wraith' | 'elemental' | 'mimic' | 'boss'
  | 'firePotionThrower';
export type ElementalKind = 'fire' | 'ice' | 'shock';
export type ScaledMonsterKind = Exclude<EncounterKind, 'skeleton' | 'mimic' | 'swarm'>;

// Shared by initial populations, reinforcements and haunted remains. Authored
// scenarios can still explicitly place any creature, for testing encounters.
export const MONSTER_FIRST_FLOOR: Record<EncounterKind, number> = {
  skeleton: 1, frog: 1, swarm: 2, mimic: 2, goblin: 3, boss: 5,
  quloptsh: 6, ghoul: 8, brute: 11, cultist: 13, wraith: 16, elemental: 18,
  firePotionThrower: 10,
};
// Mimics retain their own tier-scaled reward and are excluded from the forecast.
export const MONSTER_XP: Record<Exclude<EncounterKind, 'mimic'>, number> = {
  skeleton: 2, frog: 6, swarm: 5, goblin: 5, quloptsh: 4,
  ghoul: 5, brute: 10, cultist: 8, wraith: 9, elemental: 7,
  firePotionThrower: 9,
  boss: 25,
};
export const SWARM_HEALTH = 28;
export const SWARM_DAMAGE = 6;

export function monsterAvailable(kind: EncounterKind, floor: number): boolean {
  return floor >= MONSTER_FIRST_FLOOR[kind] && (kind !== 'frog' || floor <= 4);
}

export function elementalKindsForFloor(floor: number): ElementalKind[] {
  const kinds: ElementalKind[] = [];
  // The Wand Factory's captured fire elements are fire elementals.
  if (floor === 10 || floor >= 18) kinds.push('fire');
  if (floor >= 21) kinds.push('ice');
  if (floor >= 23) kinds.push('shock');
  return kinds;
}

export function floorMonsterRoster(floor: number): Record<EncounterKind, number> {
  const roster: Record<EncounterKind, number> = {
    skeleton: 0, frog: 0, swarm: 0, goblin: 0, quloptsh: 0, ghoul: 0,
    brute: 0, cultist: 0, wraith: 0, elemental: 0, mimic: 0, boss: 0,
    firePotionThrower: 0,
  };
  if (isWandFactoryFloor(floor)) {
    // The factory's "clear every hostile" win condition needs a small guard
    // force as well as the throwers, but still no boss or Mimic.
    roster.firePotionThrower = 2;
    roster.skeleton = 2;
    roster.goblin = 1;
    roster.elemental = 2;
    return roster;
  }
  if (isBossFloor(floor)) { roster.boss = 1; return roster; }
  for (const kind of Object.keys(roster) as EncounterKind[]) {
    if (kind !== 'boss' && monsterAvailable(kind, floor)) roster[kind] = 1;
  }
  // Skeleton and Mimic populations are deliberately unchanged.
  roster.skeleton = 2 + Math.min(floor, 5);
  roster.goblin = monsterAvailable('goblin', floor) ? Math.min(4, floor - 2) : 0;
  roster.quloptsh = monsterAvailable('quloptsh', floor) ? Math.min(3, floor - 5) : 0;
  return roster;
}

// Project a normal clear of preceding floors, not the current hero's live
// stats. Exclude optional Mimics, endless reinforcements, summons, split bonus
// XP and XP potions: grinding should give the player an advantage, not cause
// rubber-banding. XP rewards stay unchanged by the toughness increase.
export function expectedHeroAtFloor(requestedFloor: number) {
  const floor = Math.max(1, Math.min(FINAL_FLOOR, Math.floor(requestedFloor)));
  let totalXp = 0;
  let strength = 10;
  for (let previous = 1; previous < floor; previous++) {
    const roster = floorMonsterRoster(previous);
    for (const kind of Object.keys(roster) as EncounterKind[]) {
      if (kind !== 'mimic') totalXp += roster[kind] * MONSTER_XP[kind];
    }
    strength += floorProgression(previous).strengthPotions;
  }
  let level = 1;
  let xp = totalXp;
  while (xp >= xpForHeroLevel(level)) { xp -= xpForHeroLevel(level); level++; }
  // A conservative equipment budget: the previous floor's guaranteed gear,
  // limited by Strength, with one upgrade per completed region on each of
  // weapon and armor. This spends only 8 of the run's 15 upgrade scrolls.
  const suppliedTier = floorProgression(Math.max(1, floor - 1)).tier;
  const wearableTier = Math.floor((strength - 8) / 2);
  const tier = Math.max(1, Math.min(suppliedTier, wearableTier));
  // Armor is supplied on a region's third floor, weapons on its first.
  const armorTier = Math.max(1, Math.min(floorProgression(Math.max(1, floor - 3)).tier, wearableTier));
  const upgrades = Math.floor((floor - 1) / 5);
  const weaponDamage = 3 * tier + (tier + 2) * upgrades / 2;
  return {
    totalXp, xp, level, strength, tier, armorTier, upgrades,
    health: 30 + 5 * (level - 1),
    attack: level - 1 + weaponDamage,
    armor: armorTier * (2 + upgrades),
  };
}

// HP targets are ordinary hits from the projected hero (before crits/monster
// defenses). Minimums make even an out-of-band scenario creature tougher than
// its old version. Physical damage includes the expected armor allowance;
// magic/elemental damage must not, since those attacks bypass armor.
const PROFILES: Record<ScaledMonsterKind, {
  minHealth: number; hits: number; minDamage: number; healthFraction: number; bypassArmor?: boolean;
}> = {
  frog: { minHealth: 22, hits: 3, minDamage: 5, healthFraction: 0.12 },
  goblin: { minHealth: 24, hits: 3, minDamage: 7, healthFraction: 0.15 },
  quloptsh: { minHealth: 28, hits: 3, minDamage: 6, healthFraction: 0.15 },
  ghoul: { minHealth: 30, hits: 3, minDamage: 6, healthFraction: 0.14 },
  brute: { minHealth: 72, hits: 6, minDamage: 12, healthFraction: 0.20 },
  cultist: { minHealth: 36, hits: 4, minDamage: 8, healthFraction: 0.16 },
  wraith: { minHealth: 32, hits: 4, minDamage: 7, healthFraction: 0.14, bypassArmor: true },
  elemental: { minHealth: 36, hits: 4, minDamage: 8, healthFraction: 0.15, bypassArmor: true },
  firePotionThrower: { minHealth: 34, hits: 4, minDamage: 8, healthFraction: 0.16, bypassArmor: true },
  boss: { minHealth: 120, hits: 10, minDamage: 14, healthFraction: 0.25 },
};

export function monsterStats(kind: ScaledMonsterKind, floor = 1) {
  const hero = expectedHeroAtFloor(floor);
  const profile = PROFILES[kind];
  const attackDamage = Math.max(profile.minDamage,
    Math.round(hero.health * profile.healthFraction + (profile.bypassArmor ? 0 : hero.armor)));
  return {
    healthPoints: Math.max(profile.minHealth, Math.round(hero.attack * profile.hits)),
    attackDamage,
    // Halve the threat AFTER expected armor, not the raw hit: late armor
    // should not make both ranged enemies' sidearms completely harmless.
    ...((kind === 'goblin' || kind === 'cultist') ? {
      meleeDamage: Math.min(attackDamage - 1,
        Math.max(4, hero.armor + Math.round(hero.health * profile.healthFraction / 2))),
    } : {}),
  };
}
