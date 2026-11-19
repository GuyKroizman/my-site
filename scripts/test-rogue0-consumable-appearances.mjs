import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('consumable-appearances');
import assert from 'node:assert/strict';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';
import * as rendering from '../src/games/rogue0/rendering.ts';
const { Entity, identify, resetConsumableAppearances, saveConsumableKnowledge,
  restoreConsumableKnowledge } = loadLogic('src/games/rogue0/entity.ts', rendering);
const context = {
  messages: [],
  map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 },
  scene: { add: { sprite: (x, y) => ({ x, y, scale: 1, setOrigin() {},
    setScale(n) { this.scale = n; }, setPosition(x, y) { this.x = x; this.y = y; }, setDepth() {} }) },
    tweens: { add() {} } },
};
const make = (name, category, floor = false) => {
  const item = Object.assign(new Entity(), {
    name, type: 'item',
    textureKey: category === 'ring' ? 'unknown-ring' : `${category}-red`,
    equipSlot: category === 'ring' ? 'ring' : undefined,
    identified: false,
  });
  item.init(context, floor ? 1 : undefined, floor ? 2 : undefined);
  return item;
};
const random = Math.random;
try {
  Math.random = () => 0;
  for (const [category, count] of [['potion', 12], ['scroll', 10]]) {
    const keys = new Set();
    const labels = new Set();
    for (let i = 0; i < count; i++) {
      const item = make(`${category} ${i}`, category, true);
      const key = item.spriteTextureKey;
      keys.add(key);
      labels.add(item.unidentifiedName);
      assert.equal(item.sprite.scale, category === 'potion' ? 0.5 : 1);
      assert.equal(item.unidentifiedTextureKey, key);
      item.identified = true;
      assert.equal(item.spriteTextureKey, key);
      const carried = make(item.name, category);
      assert.equal(carried.sprite, undefined);
      assert.equal(carried.spriteTextureKey, key);
      assert.equal(carried.unidentifiedName, item.unidentifiedName);
      assert.equal(carried.spriteFrame, 0);
    }
    assert.equal(keys.size, count);
    assert.equal(labels.size, count, 'each kind has a unique unknown label');
  }
  const old = make('potion 0', 'potion').spriteTextureKey;
  const oldLabel = make('potion 0', 'potion').unidentifiedName;
  resetConsumableAppearances(context);
  Math.random = () => 0.999;
  assert.notEqual(make('potion 0', 'potion').spriteTextureKey, old);
  assert.notEqual(make('potion 0', 'potion').unidentifiedName, oldLabel);
} finally {
  Math.random = random;
}
// Shared type knowledge reaches carried, floor, and future copies, but not other runs.
for (const category of ['potion', 'scroll', 'wand', 'ring']) {
  resetConsumableAppearances(context);
  const first = make(`${category} test`, category);
  const carried = make(first.name, category);
  const floor = make(first.name, category, true);
  const other = make(`${category} other`, category);
  assert.equal(carried.identified, false);
  const label = first.unidentifiedName;
  identify(first);
  for (const copy of [first, carried, floor, make(first.name, category)]) {
    assert.equal(copy.identified, true);
    assert.equal(copy.displayName, first.name);
    assert.equal(copy.unidentifiedName, label);
  }
  assert.equal(other.identified, false);
  const separateRun = Object.assign(new Entity(), {
    context: { messages: [] }, name: first.name,
    textureKey: category === 'ring' ? 'unknown-ring' : `${category}-red`,
    equipSlot: category === 'ring' ? 'ring' : undefined,
    identified: false,
  });
  assert.equal(separateRun.identified, false);
  if (category === 'ring') {
    const resumedContext = { messages: [] };
    restoreConsumableKnowledge(resumedContext, saveConsumableKnowledge(context));
    const resumed = Object.assign(new Entity(), {
      context: resumedContext, name: first.name, type: 'item',
      textureKey: 'unknown-ring', equipSlot: 'ring', identified: false,
    });
    assert.equal(resumed.identified, true, 'ring knowledge survives save and load');
  }
  resetConsumableAppearances(context);
  assert.equal(make(first.name, category).identified, false, 'new game forgets discoveries');
}
const armor = Object.assign(new Entity(), { context, name: 'Mail Armor', equipSlot: 'armor', identified: false });
const otherArmor = Object.assign(new Entity(), { context, name: 'Mail Armor', equipSlot: 'armor', identified: false });
identify(armor);
assert.equal(otherArmor.identified, false, 'physical gear knowledge remains per instance');
// Identification logs name only; descriptions remain available on the item.
for (const name of ['Scroll of Identify', 'Cloth Armor']) {
  const item = Object.assign(new Entity(), {
    context, name, identified: false, description: 'Detailed item information.',
  });
  identify(item);
  assert.equal(item.identified, true);
  assert.equal(context.messages[0], `Identified: ${name}`);
  assert.equal(item.description, 'Detailed item information.');
}
console.log('Rogue0 unique per-run consumable and ring appearances, shared type identification, concise logs and floor-only potion scale passed');
