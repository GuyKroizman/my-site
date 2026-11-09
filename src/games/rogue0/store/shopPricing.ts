import type { Entity } from '../entity';

// Read intrinsic fields, not shuffled appearance textures or display names.
// Quoting/selling never invokes identify() or changes shared item knowledge.
export type PricedItem = Pick<Entity, 'name' | 'equipSlot' | 'textureKey' |
  'tier' | 'level' | 'charges' | 'cursed'>;

const NAMED_VALUES: Readonly<Record<string, number>> = {
  'Ration of Food': 8,
  'Potion of Healing': 18,
  'Potion of Strength': 30,
  'Potion of Experience': 45,
  'Scroll of Identify': 20,
  'Scroll of Remove Curse': 26,
  'Scroll of Upgrade': 38,
  'Gem': 20,
};

function nonnegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function baseValue(item: PricedItem): number {
  const tier = Math.min(5, Math.max(1, nonnegative(item.tier)));
  const level = nonnegative(item.level);
  if (item.textureKey?.startsWith('wand-')) return 34 * tier + 3 * nonnegative(item.charges);
  if (item.equipSlot === 'weapon' || item.equipSlot === 'armor') return 26 * tier + 8 * level;
  if (item.equipSlot === 'ring') return 30 * tier + 8 * level;
  if (item.equipSlot === 'artifact') return 80 + 8 * level;
  if (Object.prototype.hasOwnProperty.call(NAMED_VALUES, item.name)) return NAMED_VALUES[item.name];
  if (item.textureKey?.startsWith('glyph-stone-')) return 18;
  if (item.textureKey?.startsWith('potion-') || /potion/i.test(item.name)) return 15;
  if (item.textureKey?.startsWith('scroll-') || /scroll/i.test(item.name)) return 18;
  return 5; // Legacy/junk backpack items can still be sold.
}

// All quotes are per unit. Whole-stack totals are computed by the transaction.
export function buyPrice(item: PricedItem): number {
  return Math.max(5, Math.round(baseValue(item) * 1.5 / 5) * 5);
}

export function sellPrice(item: PricedItem): number {
  const ordinary = Math.max(1, Math.floor(baseValue(item) * 0.4));
  // Gold is integer-valued: halve the normal quote, round down, minimum 1g.
  return item.cursed ? Math.max(1, Math.floor(ordinary / 2)) : ordinary;
}
