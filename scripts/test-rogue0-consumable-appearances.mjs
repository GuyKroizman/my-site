import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('consumable-appearances');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync('src/games/rogue0/entity.ts', 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
const exports = {};
const rendering = {};
new Function('exports', ts.transpile(fs.readFileSync('src/games/rogue0/rendering.ts', 'utf8'), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }))(rendering);
new Function('exports', ...Object.keys(rendering), ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }))(exports, ...Object.values(rendering));
const { Entity, identify, resetConsumableAppearances } = exports;
const context = {
  messages: [],
  map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 },
  scene: { add: { sprite: (x, y) => ({ x, y, scale: 1, setOrigin() {}, setScale(n) { this.scale = n; }, setDepth() {} }) }, tweens: { add() {} } },
};
const make = (name, category, floor = false) => {
  const item = Object.assign(new Entity(), { name, type: 'item', textureKey: `${category}-red`, identified: false });
  item.init(context, floor ? 1 : undefined, floor ? 2 : undefined);
  return item;
};
const random = Math.random;
try {
  Math.random = () => 0;
  for (const [category, count] of [['potion', 12], ['scroll', 9]]) {
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
for (const category of ['potion', 'scroll', 'wand']) {
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
    context: { messages: [] }, name: first.name, textureKey: `${category}-red`, identified: false,
  });
  assert.equal(separateRun.identified, false);
  resetConsumableAppearances(context);
  assert.equal(make(first.name, category).identified, false, 'new game forgets discoveries');
}
const gear = Object.assign(new Entity(), { context, name: 'Ring', identified: false });
const otherGear = Object.assign(new Entity(), { context, name: 'Ring', identified: false });
identify(gear);
assert.equal(otherGear.identified, false, 'equipment knowledge remains per instance');
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
console.log('Rogue0 unique per-run consumable appearances, identification stability, concise identification logs and floor-only potion scale passed');
