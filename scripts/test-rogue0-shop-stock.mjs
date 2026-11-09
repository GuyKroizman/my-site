import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('shop-stock');
import assert from 'node:assert/strict';
import { planShopStock, SHOP_POOLS } from '../src/games/rogue0/store/shopStock.ts';

let calls = 0;
const low = planShopStock(6, () => { calls++; return 0; });
assert.equal(calls, 15, 'one random selection per slot, no hidden guarantees');
const high = planShopStock(6, () => 1 - Number.EPSILON);
assert.equal(low.length, 15);
assert.equal(high.length, 15);
assert.notDeepEqual(low, high);
assert.ok(low.slice(10).every(slot => slot.kind === 'weapon'), 'duplicates are permitted');
assert.ok(high.slice(10).every(slot => slot.kind === 'fang-of-the-beast'));
// Sweep weighted intervals deterministically rather than using a flaky sample.
const seen = SHOP_POOLS.map(() => new Set());
for (let roll = 0; roll < 1000; roll++) {
  const plan = planShopStock(6, () => roll / 1000);
  plan.forEach((slot, i) => {
    const row = Math.floor(i / 5);
    assert.ok(SHOP_POOLS[row].some(entry => entry.kind === slot.kind));
    assert.equal(slot.count, 1);
    assert.equal(slot.level, 0);
    assert.equal(slot.tier, /^(weapon|armor|wand-|ring-)/.test(slot.kind) ? 2 : 1);
    seen[row].add(slot.kind);
  });
}
SHOP_POOLS.forEach((pool, row) => assert.deepEqual([...seen[row]].sort(), pool.map(entry => entry.kind).sort()));
for (const bad of [NaN, -1, 1, Infinity]) assert.throws(() => planShopStock(6, () => bad), RangeError);
assert.throws(() => planShopStock(0), RangeError);
console.log('Shop stock passed: all 15 slots random, weighted row pools, duplicates and deterministic RNG coverage.');
