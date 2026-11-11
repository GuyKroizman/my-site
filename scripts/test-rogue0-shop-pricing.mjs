import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('shop-pricing');
import assert from 'node:assert/strict';
import { baseValue, buyPrice, sellPrice } from '../src/games/rogue0/store/shopPricing.ts';

const item = overrides => ({ name: 'Unknown junk', equipSlot: 'junk', tier: 1,
  level: 0, charges: 0, cursed: false, ...overrides });
for (const [fields, base, buy, sell] of [
  [{ name: 'Ration of Food' }, 8, 10, 3],
  [{ name: 'Potion of Healing' }, 18, 25, 7],
  [{ name: 'Potion of Strength' }, 30, 45, 12],
  [{ name: 'Potion of Experience' }, 45, 70, 18],
  [{ name: 'Scroll of Upgrade' }, 38, 55, 15],
  [{ name: 'Scroll of Identify' }, 20, 30, 8],
  [{ name: 'Scroll of Remove Curse' }, 26, 40, 10],
  [{ name: 'Scroll of Lightning' }, 18, 25, 7],
  [{ textureKey: 'glyph-stone-blink' }, 18, 25, 7],
  [{ equipSlot: 'weapon', tier: 2 }, 52, 80, 20],
  [{ equipSlot: 'armor', tier: 2, level: 2 }, 68, 100, 27],
  [{ equipSlot: 'ring', tier: 2 }, 60, 90, 24],
  [{ equipSlot: 'artifact' }, 80, 120, 32],
  [{ textureKey: 'wand-ice', tier: 2, charges: 3 }, 77, 115, 30],
  [{}, 5, 10, 2],
]) {
  const original = item(fields);
  assert.deepEqual([baseValue(original), buyPrice(original), sellPrice(original)], [base, buy, sell]);
  assert.equal(sellPrice({ ...original, cursed: true }), Math.max(1, Math.floor(sell / 2)));
  assert.equal(sellPrice({ ...original, count: 99, identified: false }), sell, 'quote per unit, no identification discount');
  assert.deepEqual(original, item(fields), 'quoting has no side effects');
}
for (let tier = 1; tier <= 5; tier++) for (let level = 0; level < 20; level++) {
  for (const equipSlot of ['weapon', 'armor', 'ring', 'artifact']) {
    for (const cursed of [false, true]) {
      const value = item({ equipSlot, tier, level, cursed });
      assert.ok(Number.isSafeInteger(buyPrice(value)) && buyPrice(value) > sellPrice(value));
    }
  }
}
assert.ok(Number.isFinite(buyPrice(item({ equipSlot: 'weapon', tier: NaN, level: Infinity }))));
assert.equal(baseValue(item({ name: '__proto__' })), 5);
console.log('Shop pricing passed: categories, per-unit quotes, curse half-price and no buy/sell arbitrage.');
