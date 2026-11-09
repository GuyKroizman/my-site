import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('found-upgrades');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';

const { Entity } = load('src/games/rogue0/entity.ts');
Entity.prototype.init = function(context, x, y) { Object.assign(this, { context, x, y }); };
const { canBeFoundUpgraded, rollFoundUpgrade, MAX_FOUND_UPGRADE, FOUND_UPGRADE_WEIGHTS } =
  load('src/games/rogue0/foundUpgrades.ts', { Entity });

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
assert.equal(canBeFoundUpgraded(makeItem({ type: 'monster', equipSlot: 'junk', name: 'Rat' })), false);

// The found ceiling is +3 and the weight table covers every level 0..3.
assert.equal(MAX_FOUND_UPGRADE, 3);
assert.equal(FOUND_UPGRADE_WEIGHTS.length, MAX_FOUND_UPGRADE + 1);
const totalWeight = FOUND_UPGRADE_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
assert.equal(totalWeight, 100);

// Every weight band maps to exactly its level, at both edges.
let cumulative = 0;
for (let level = 0; level <= MAX_FOUND_UPGRADE; level++) {
  const before = cumulative / totalWeight;
  cumulative += FOUND_UPGRADE_WEIGHTS[level];
  const after = cumulative / totalWeight;
  assert.equal(rollFoundUpgrade(makeItem(), () => before + 0.0001), level, `start of +${level} band`);
  assert.equal(rollFoundUpgrade(makeItem(), () => after - 0.0001), level, `end of +${level} band`);
}
assert.equal(rollFoundUpgrade(makeItem(), () => 1), MAX_FOUND_UPGRADE, 'random() === 1 is clamped');

// A long deterministic run never exceeds +3, produces every level, and keeps
// plain finds more common than upgraded ones.
const counts = [0, 0, 0, 0];
let seed = 123456789;
const random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
for (let index = 0; index < 20000; index++) {
  const item = makeItem();
  const level = rollFoundUpgrade(item, random);
  assert.equal(level, item.level);
  assert.ok(level >= 0 && level <= MAX_FOUND_UPGRADE, `found level ${level} is within 0..3`);
  counts[level]++;
}
assert.ok(counts.every(count => count > 0), 'every found level occurs');
assert.ok(counts[0] > counts[1] && counts[1] > counts[2] && counts[2] > counts[3],
  `plain finds are most common, +3 rarest: ${counts.join('/')}`);

// Existing upgrades are preserved and item caps are respected.
const already = makeItem({ level: 2 });
assert.equal(rollFoundUpgrade(already, () => 0.999), 2, 'never downgrades an existing upgrade');
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

// Both generation sites must use the shared helper.
const sceneSource = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
assert.match(sceneSource, /import \{ rollFoundUpgrade \} from "\.\/foundUpgrades";/);
assert.ok((sceneSource.match(/rollFoundUpgrade\(/g) ?? []).length >= 2,
  'guaranteed equipment and random loot both roll a found upgrade');
const chestSource = fs.readFileSync('src/games/rogue0/items/chest.ts', 'utf8');
assert.match(chestSource, /import \{ rollFoundUpgrade \} from '\.\.\/foundUpgrades';/);
assert.ok((chestSource.match(/rollFoundUpgrade\(/g) ?? []).length >= 2,
  'chest weapon and armor both roll a found upgrade');

// Real chest contents honour the +3 ceiling, including saved chests.
const Phaser = { Math: { Between: (min) => min } };
const { TieredWeapon, TieredArmor } = load('src/games/rogue0/items/tieredEquipment.ts', { Entity, Phaser });
const rewards = { Gold: class extends Entity {}, Gem: class extends Entity {}, Ration: class extends Entity {}, PotionOfHealing: class extends Entity {} };
const Chest = load('src/games/rogue0/items/chest.ts', {
  Entity, dungeon: { log() {} }, maybeCurse: () => false, rollFoundUpgrade,
  TieredWeapon, TieredArmor, ...rewards,
}).default;
const originalRandom = Math.random;
try {
  // Chests roll 18 reward slots: 16 is a weapon, 17 is armor.
  for (const [contentRoll, upgradeRoll, expected] of [
    [16.5 / 18, 0.999, 3], [16.5 / 18, 0, 0],
    [17.5 / 18, 0.999, 3], [17.5 / 18, 0, 0]
  ]) {
    const scripted = [contentRoll, upgradeRoll, upgradeRoll];
    Math.random = () => scripted.shift() ?? 0;
    const chest = new Chest({ floor: 1, messages: [] }, 1, 1);
    const content = chest.contents[0];
    assert.ok(content instanceof TieredWeapon || content instanceof TieredArmor, 'equipment roll');
    assert.equal(content.level, expected, `chest find at +${expected}`);
    assert.ok(content.level <= MAX_FOUND_UPGRADE);
  }
} finally {
  Math.random = originalRandom;
}

console.log(`Rogue0 found upgrades: armor/weapons/wands roll +0..+${MAX_FOUND_UPGRADE}, caps and wand charges respected, scene and chest generation wired passed`);
