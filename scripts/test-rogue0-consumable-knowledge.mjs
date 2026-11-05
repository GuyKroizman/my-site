import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('consumable-knowledge');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { isModalOpen } from '../src/games/rogue0/context.ts';

// entity.ts imports Phaser for types only, so load it with imports stripped
// (the same harness the appearance suite uses) to test the discovery listing.
const source = fs.readFileSync('src/games/rogue0/entity.ts', 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
const exports = {};
const rendering = {};
new Function('exports', ts.transpile(fs.readFileSync('src/games/rogue0/rendering.ts', 'utf8'), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }))(rendering);
new Function('exports', ...Object.keys(rendering), ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }))(exports, ...Object.values(rendering));
const { Entity, identify, consumableKnowledge, appearanceLabel, resetConsumableAppearances } = exports;

const context = {
  messages: [],
  map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 },
  scene: {
    add: { sprite: (x, y) => ({ x, y, scale: 1, setOrigin() {}, setScale(n) { this.scale = n; }, setDepth() {} }) },
    tweens: { add() {} },
  },
};
const make = (name, category) => {
  const item = Object.assign(new Entity(), { name, type: 'item', textureKey: `${category}-red`, identified: false });
  item.init(context, 1, 2);
  return item;
};
const page = category => consumableKnowledge(context, category);

// An empty run has nothing to list.
assert.deepEqual(page('potion'), []);
assert.deepEqual(page('scroll'), []);

const frost = make('Potion of Frost', 'potion');
const healing = make('Potion of Healing', 'potion');
const minor = make('Minor Heal Potion', 'potion');
make('Scroll of Fireball', 'scroll');

// Found kinds appear, unidentified, without leaking the real name.
const unknownPotions = page('potion');
assert.equal(unknownPotions.length, 3);
for (const entry of unknownPotions) {
  assert.equal(entry.category, 'potion');
  assert.equal(entry.identified, false);
  assert.ok(entry.alias.length > 0);
  assert.ok(['Potion of Frost', 'Potion of Healing', 'Minor Heal Potion'].includes(entry.name));
  // The icon shown on the page is the appearance the hero already sees.
  const item = [frost, healing, minor].find(candidate => candidate.name === entry.name);
  assert.equal(entry.appearance, item.spriteTextureKey);
  assert.equal(entry.alias, item.unidentifiedName);
}
// Categories never bleed into each other.
assert.deepEqual(page('scroll').map(entry => entry.name), ['Scroll of Fireball']);

// Identifying reveals the real name and moves the entry to the top group.
identify(frost);
const potions = page('potion');
assert.equal(potions[0].name, 'Potion of Frost');
assert.equal(potions[0].identified, true);
assert.equal(potions[0].alias, frost.unidentifiedName, 'the alias stays stable after identification');
// Identified names sort alphabetically among themselves.
const identifiedNames = potions.filter(entry => entry.identified).map(entry => entry.name);
assert.deepEqual(identifiedNames, [...identifiedNames].sort((a, b) => a.localeCompare(b)));
// Unknown labels sort among themselves, so their order cannot hint at names.
const unknownAliases = potions.filter(entry => !entry.identified).map(entry => entry.alias);
assert.deepEqual(unknownAliases, [...unknownAliases].sort((a, b) => a.localeCompare(b)));

// Copies of an identified kind are known immediately, even when carried.
const carried = Object.assign(new Entity(), { context, name: 'Potion of Frost', textureKey: 'potion-red' });
assert.equal(carried.identified, true);
assert.equal(page('potion').length, 3, 'copies never add duplicate entries');

// A new run forgets everything.
resetConsumableAppearances(context);
assert.deepEqual(page('potion'), []);
assert.deepEqual(page('scroll'), []);

// The scrambled label helper is shared and stable.
assert.equal(appearanceLabel('potion-3'), appearanceLabel('potion-3'));
assert.notEqual(appearanceLabel('potion-3'), appearanceLabel('potion-4'));
assert.match(appearanceLabel('scroll-fireball'), /^[A-Z][a-z]+$/);

// Finding a kind never opens or closes anything by itself, but the knowledge
// modal must pause the world while it is up.
assert.equal(isModalOpen({}), false);
assert.equal(isModalOpen({ knowledgeOpen: true }), true);

console.log('consumable knowledge: ok');
