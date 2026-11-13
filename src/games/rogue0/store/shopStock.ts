import { floorProgression } from '../progression.ts';
import { STORE_COLUMNS, STORE_SLOTS } from './storeLayout.ts';

export const SHOP_FLOOR = 6;

// Explicit content pools, not constructor names inferred at runtime. The
// renderer/item factory will resolve these ids; plans themselves need no DOM.
const POTIONS = ['healing', 'strength', 'experience', 'invisibility', 'toxic-gas',
  'liquid-flame', 'frost', 'levitation', 'holy', 'berserk'].map(kind => `potion-${kind}`);
const SCROLLS = ['identify', 'upgrade', 'remove-curse', 'teleport', 'rage', 'terror',
  'recharging', 'fireball', 'lightning'].map(kind => `scroll-${kind}`);
const WANDS = ['firebolt', 'frost', 'lightning', 'blast'].map(kind => `wand-${kind}`);
const RINGS = ['accuracy', 'evasion', 'elements', 'haste', 'might'].map(kind => `ring-${kind}`);
const STONES = ['blink', 'detect-curse'].map(kind => `stone-${kind}`);
const ARTIFACTS = ['chalice-of-blood', 'fang-of-the-beast'];

type WeightedKind = { kind: string; weight: number };
const weighted = (kinds: string[], weight = 1): WeightedKind[] => kinds.map(kind => ({ kind, weight }));

export const SHOP_POOLS: readonly (readonly WeightedKind[])[] = [
  [...weighted(POTIONS), ...weighted(SCROLLS), ...weighted(['ration'], 4)],
  [...weighted(WANDS, 3), ...weighted(RINGS, 2), ...weighted(STONES, 3),
    ...weighted(POTIONS), ...weighted(SCROLLS)],
  [...weighted(['weapon', 'armor'], 10), ...weighted(RINGS, 3), ...weighted(ARTIFACTS)],
];

export type StockSlot = {
  kind: string;
  tier: number;
  level: number;
  count: number;
};

function choose(pool: readonly WeightedKind[], random: () => number): string {
  const roll = random();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new RangeError('Stock RNG must return [0, 1)');
  let remainder = roll * pool.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of pool) {
    remainder -= entry.weight;
    if (remainder < 0) return entry.kind;
  }
  return pool[pool.length - 1].kind;
}

// No guaranteed slot, no retries to force a particular item, no refresh on
// visits. Call only when creating a run's shop. Duplicates are allowed.
// Injected RNG keeps tests deterministic without changing the dungeon RNG.
export function planShopStock(floor = SHOP_FLOOR, random: () => number = Math.random): StockSlot[] {
  if (!Number.isInteger(floor) || floor < 1 || floor > 25) throw new RangeError('Invalid stock floor');
  const bandTier = floorProgression(floor).tier;
  return Array.from({ length: STORE_SLOTS }, (_, index) => {
    const kind = choose(SHOP_POOLS[Math.floor(index / STORE_COLUMNS)], random);
    const gear = kind === 'weapon' || kind === 'armor' || kind.startsWith('wand-') || kind.startsWith('ring-');
    return { kind, tier: gear ? bandTier : 1, level: 0, count: 1 };
  });
}
