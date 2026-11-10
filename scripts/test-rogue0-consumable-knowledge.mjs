import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('consumable-knowledge');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isModalOpen } from '../src/games/rogue0/context.ts';
import * as rendering from '../src/games/rogue0/rendering.ts';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';
const {
  Entity, identify, consumableKnowledge, appearanceLabel, resetConsumableAppearances,
  prewarmConsumableAppearances, CONSUMABLE_NAMES,
} = loadLogic('src/games/rogue0/entity.ts', rendering);

const context = {
  messages: [],
  map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 },
  scene: {
    add: { sprite: (x, y) => ({ x, y, scale: 1, setOrigin() {},
      setScale(n) { this.scale = n; }, setPosition(x, y) { this.x = x; this.y = y; }, setDepth() {} }) },
    tweens: { add() {} },
  },
};
const make = (name, category) => {
  const item = Object.assign(new Entity(), { name, type: 'item', textureKey: `${category}-red`, identified: false });
  item.init(context, 1, 2);
  return item;
};
const page = category => consumableKnowledge(context, category);

// The catalogue must match the real item classes: every consumable in items/
// has to be listed, and nothing may be listed that does not exist.
const itemFiles = fs.readdirSync('src/games/rogue0/items').filter(name => name.endsWith('.ts'));
const declared = { potion: new Set(), scroll: new Set() };
for (const file of itemFiles) {
  const text = fs.readFileSync(`src/games/rogue0/items/${file}`, 'utf8');
  const category = /textureKey\s*=\s*["'](potion|scroll)-/.exec(text)?.[1];
  if (!category) continue;
  const name = /(?:this\.)?name(?:: string)?\s*=\s*["']([^"']+)["']/.exec(text)?.[1];
  assert.ok(name, `${file} declares a name`);
  declared[category].add(name);
}
for (const category of ['potion', 'scroll']) {
  assert.deepEqual([...CONSUMABLE_NAMES[category]].sort(), [...declared[category]].sort(),
    `${category} catalogue matches items/`);
}

// A fresh run lists every potion and every scroll, unidentified, by gibberish
// name -- nothing is hidden until it is first found.
const potions = page('potion');
assert.equal(potions.length, CONSUMABLE_NAMES.potion.length);
assert.equal(page('scroll').length, CONSUMABLE_NAMES.scroll.length);
for (const [category, entries] of [['potion', potions], ['scroll', page('scroll')]]) {
  assert.deepEqual(entries.map(entry => entry.name).sort(), [...CONSUMABLE_NAMES[category]].sort());
  assert.equal(new Set(entries.map(entry => entry.alias)).size, entries.length, 'unique aliases');
  assert.equal(new Set(entries.map(entry => entry.appearance)).size, entries.length, 'unique appearances');
  for (const entry of entries) {
    assert.equal(entry.category, category);
    assert.equal(entry.identified, false);
    assert.match(entry.alias, /^[A-Z][a-z]+$/);
    assert.equal(entry.alias, appearanceLabel(entry.appearance));
  }
}

// The listing is stable: opening it again changes neither order nor labels.
const order = potions.map(entry => entry.appearance);
prewarmConsumableAppearances(context);
assert.deepEqual(page('potion').map(entry => entry.alias), potions.map(entry => entry.alias));
assert.deepEqual(page('potion').map(entry => entry.appearance), order);

// A found copy shows the same gibberish name the page already lists, and a
// newly found kind never adds, removes or reorders a row.
const frost = make('Potion of Frost', 'potion');
const frostEntry = page('potion').find(entry => entry.name === 'Potion of Frost');
assert.equal(frostEntry.appearance, frost.spriteTextureKey);
assert.equal(frostEntry.alias, frost.unidentifiedName);
assert.deepEqual(page('potion').map(entry => entry.appearance), order);

// Identifying replaces the gibberish name with the true name in place.
const index = page('potion').findIndex(entry => entry.name === 'Potion of Frost');
identify(frost);
const identified = page('potion');
assert.equal(identified[index].name, 'Potion of Frost');
assert.equal(identified[index].identified, true);
assert.equal(identified[index].alias, frost.unidentifiedName, 'the alias stays stable after identification');
assert.deepEqual(identified.map(entry => entry.appearance), order, 'rows never move');
// Copies are known immediately and never duplicate an entry.
const carried = Object.assign(new Entity(), { context, name: 'Potion of Frost', textureKey: 'potion-red' });
assert.equal(carried.identified, true);
assert.equal(page('potion').length, CONSUMABLE_NAMES.potion.length);
// Only the identified kind changes; every other potion keeps its alias.
assert.equal(page('potion').filter(entry => entry.identified).length, 1);
assert.equal(page('scroll').filter(entry => entry.identified).length, 0);

// A new run forgets discoveries but still lists the whole catalogue.
resetConsumableAppearances(context);
assert.equal(page('potion').length, CONSUMABLE_NAMES.potion.length);
assert.equal(page('potion').filter(entry => entry.identified).length, 0);

// Finding a kind never opens or closes anything by itself, but the knowledge
// modal must pause the world while it is up.
assert.equal(isModalOpen({}), false);
assert.equal(isModalOpen({ knowledgeOpen: true }), true);

console.log('consumable knowledge: ok');
