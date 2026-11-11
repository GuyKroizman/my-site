import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('found-upgrades');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
import { canBeFoundUpgraded, rollFoundUpgrade, MAX_FOUND_UPGRADE } from '../src/games/rogue0/foundUpgrades.ts';

const { Entity } = load('src/games/rogue0/entity.ts');
Entity.prototype.init = function(context, x, y) { Object.assign(this, { context, x, y }); };

const makeItem = (overrides = {}) => Object.assign(new Entity(), {
  type: 'item', name: 'Sword', equipSlot: 'weapon', ...overrides,
});

// Only armor, physical weapons and wands can be found upgraded. Rings,
// artifacts, consumables, scrolls and monsters use other systems.
assert.equal(canBeFoundUpgraded(makeItem()), true, 'weapons');
assert.equal(canBeFoundUpgraded(makeItem({ equipSlot: 'armor', name: 'Cloth Armor' })), true, 'armor');
assert.equal(canBeFoundUpgraded(makeItem({ equipSlot: 'junk', name: 'Wand of Frost', textureKey: 'wand-frost' })), true, 'wands');
assert.equal(canBeFoundUpgraded(makeItem({ equipSlot: 'weapon', name: 'Scroll of Fireball' })), false, 'weapon-slot spell scrolls are starting gear');
assert.equal(canBeFoundUpgraded(makeItem({ equipSlot: 'ring', name: 'Ring of Might' })), false);
assert.equal(canBeFoundUpgraded(makeItem({ equipSlot: 'artifact', name: 'Chalice of Blood' })), false);
assert.equal(canBeFoundUpgraded(makeItem({ equipSlot: 'consumable', name: 'Potion of Healing' })), false);
assert.equal(canBeFoundUpgraded(makeItem({ type: 'enemy', equipSlot: 'junk', name: 'Rat' })), false);

// Assert the 70/20/8/2 balance independently of the implementation's weight
// table. Exact boundaries catch off-by-one errors a random sample can miss.
assert.equal(MAX_FOUND_UPGRADE, 3);
for (const [roll, expected] of [
  [0, 0], [0.70 - Number.EPSILON, 0],
  [0.70, 1], [0.90 - Number.EPSILON, 1],
  [0.90, 2], [0.98 - Number.EPSILON, 2],
  [0.98, 3], [1 - Number.EPSILON, 3], [1, 3],
]) {
  const item = makeItem();
  assert.equal(rollFoundUpgrade(item, () => roll), expected, `roll ${roll}`);
  assert.equal(item.level, expected, 'the returned upgrade is applied to the item');
}

// Ineligible items and existing upgrades must neither change nor consume RNG.
const noRoll = () => { throw Error('this item must not roll an upgrade'); };
for (const overrides of [
  { equipSlot: 'ring' }, { equipSlot: 'artifact' }, { equipSlot: 'consumable' },
  { name: 'Scroll of Fireball' }, { type: 'enemy' }, { level: 2 }, { level: 5 },
]) {
  const item = makeItem(overrides);
  const before = item.level;
  assert.equal(rollFoundUpgrade(item, noRoll), before);
  assert.equal(item.level, before);
}
// Eligible item caps are respected.
assert.equal(rollFoundUpgrade(makeItem({ maxLevel: 1 }), () => 0.999), 1, 'respects a lower item cap');
assert.equal(rollFoundUpgrade(makeItem({ maxLevel: 0 }), () => 0.999), 0, 'respects a zero cap');

// Wands reconcile their charge capacity after a found upgrade.
const wand = makeItem({
  equipSlot: 'junk', name: 'Wand of Frost', textureKey: 'wand-frost',
  baseMaxCharges: 3, maxCharges: 3, charges: 3,
  reconcileChargeScaling() { this.maxCharges = this.baseMaxCharges + this.level; },
});
assert.equal(rollFoundUpgrade(wand, () => 0.999), 3);
assert.equal(wand.maxCharges, 6, 'found +3 wand capacity includes the upgrade');

// Legacy scene smoke check: full floor generation still needs Phaser.
const sceneSource = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
assert.ok((sceneSource.match(/rollFoundUpgrade\(/g) ?? []).length >= 2,
  'guaranteed equipment and random loot both roll a found upgrade');

// Execute chest generation instead of checking its import spelling/call count.
// Save round-trips are covered by the chest suite.
const Phaser = { Math: { Between: (min) => min } };
const { TieredWeapon, TieredArmor } = load('src/games/rogue0/items/tieredEquipment.ts', { Entity, Phaser });
const rewards = { Gold: class extends Entity {}, Ration: class extends Entity {}, PotionOfHealing: class extends Entity {} };
const Chest = load('src/games/rogue0/items/chest.ts', {
  Entity, dungeon: { log() {} }, maybeCurse: () => false, rollFoundUpgrade,
  TieredWeapon, TieredArmor, CHEST_TEXTURE: 'chest-closed', ...rewards,
}).default;
const originalRandom = Math.random;
try {
  // Zero-based reward slots 14–15 are weapons; 16–17 are armor.
  for (const [contentRoll, upgradeRoll, expected, Type] of [
    [14.5 / 18, 0.999, 3, TieredWeapon], [14.5 / 18, 0, 0, TieredWeapon],
    [16.5 / 18, 0.999, 3, TieredArmor], [16.5 / 18, 0, 0, TieredArmor]
  ]) {
    const scripted = [contentRoll, upgradeRoll, upgradeRoll];
    Math.random = () => scripted.shift() ?? 0;
    const chest = new Chest({ floor: 1, messages: [] }, 1, 1);
    const content = chest.contents[0];
    assert.ok(content instanceof Type, `chest rolls ${Type.name}`);
    assert.equal(content.level, expected, `chest find at +${expected}`);
    assert.ok(content.level <= MAX_FOUND_UPGRADE);
  }
} finally {
  Math.random = originalRandom;
}

console.log(`Rogue0 found upgrades: armor/weapons/wands roll +0..+${MAX_FOUND_UPGRADE}, caps and wand charges respected, scene and chest generation wired passed`);
