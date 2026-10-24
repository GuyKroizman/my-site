import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('quickslots');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function load(path, bindings = {}) {
  const source = fs.readFileSync(path, 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
  const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
  const exports = {};
  new Function('exports', ...Object.keys(bindings), js)(exports, ...Object.values(bindings));
  return exports;
}
const { foregroundEntities, createForegroundAtlas } = load('src/games/rogue0/rendering.ts');
// Match Phaser's Texture-input behavior: addSpriteSheet keeps the source key.
const textures = new Map();
const pixels = new Uint8ClampedArray([71, 45, 60, 255, 207, 198, 184, 255]);
const originalDocument = globalThis.document;
globalThis.document = { createElement: () => ({ getContext: () => ({
  drawImage() {}, getImageData: () => ({ data: pixels }), putImageData() {},
}) }) };
try {
  createForegroundAtlas({ textures: {
    exists: key => textures.has(key),
    get: () => ({ getSourceImage: () => ({ width: 2, height: 1 }) }),
    addCanvas(key) { const texture = { key }; textures.set(key, texture); return texture; },
    addSpriteSheet(_key, texture, config) { texture.config = config; return texture; },
  } });
  assert.ok(textures.get('foreground-tiles')?.config, 'foreground key must contain sprite-sheet frames');
  assert.equal(pixels[3], 0, 'legacy backdrop is transparent');
  assert.equal(pixels[7], 255, 'sprite artwork stays opaque');
} finally {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
}
const scrollOnFloor = { type: 'item', x: 2, y: 3 };
const potionOnFloor = { type: 'item', x: 2, y: 3 };
const monsterOnFloor = { type: 'enemy', x: 2, y: 3 };
const playerOnFloor = { type: 'player', x: 2, y: 3 };
assert.deepEqual([...foregroundEntities([scrollOnFloor, potionOnFloor])], [scrollOnFloor]);
assert.deepEqual([...foregroundEntities([scrollOnFloor, monsterOnFloor, potionOnFloor])], [monsterOnFloor]);
assert.deepEqual([...foregroundEntities([monsterOnFloor, scrollOnFloor])], [monsterOnFloor]);
assert.deepEqual([...foregroundEntities([scrollOnFloor, playerOnFloor], playerOnFloor)], [playerOnFloor]);
assert.deepEqual([...foregroundEntities([potionOnFloor])], [potionOnFloor]);
assert.equal(foregroundEntities([{ type: 'item' }]).size, 0);
assert.equal(foregroundEntities([scrollOnFloor, { type: 'item', x: 4, y: 3 }]).size, 2);
const { Entity } = load('src/games/rogue0/entity.ts');
for (const colour of ['red', 'green', 'blue', 'gold', 'purple']) {
  const potion = Object.assign(new Entity(), {
    name: 'Potion of Healing', type: 'item', equipSlot: 'consumable',
    identified: false, textureKey: `potion-${colour}`,
  });
  assert.equal(potion.unidentifiedTextureKey, potion.spriteTextureKey,
    'unidentified potion icons retain their floor colour in inventory and quickslots');
  assert.equal(potion.displayName, 'Potion', 'colour must not reveal the potion effect');
  assert.equal(potion.identified, false);
  potion.identified = true;
  assert.equal(potion.spriteTextureKey, `potion-${colour}`);
  assert.equal(potion.displayName, 'Potion of Healing');
}
const genericPotion = Object.assign(new Entity(), { equipSlot: 'consumable', identified: false });
assert.equal(genericPotion.unidentifiedTextureKey, 'unknown-potion', 'missing art keeps a fallback icon');
const dungeon = { log() {}, getCurrentLevel: () => Array.from({length: 8}, () => Array(8).fill(0)),
  firstActorInPath: () => undefined, entityAtTile: () => undefined };
const Wand = load('src/games/rogue0/items/wand.ts', { Entity, dungeon, identify: i => { i.identified = true; } }).default;
for (const name of ['Wand of Firebolt', 'Wand of Frost', 'Wand of Lightning']) {
  const unknownWand = Object.assign(Object.create(Wand.prototype), {
    name, type: 'item', equipSlot: 'junk', identified: false, level: 0,
  });
  assert.equal(unknownWand.displayName, 'Wand', 'backpack wands retain their category');
  assert.equal(unknownWand.unidentifiedTextureKey, 'unknown-wand');
  unknownWand.identified = true;
  assert.equal(unknownWand.displayName, name);
  unknownWand.level = 2;
  assert.equal(unknownWand.displayName, `${name} +2`);
}
const Hero = load('src/games/rogue0/classes/basicHero.ts', {
  Entity, Wand, Gem: class {}, dungeon, hasLineOfSight: () => true,
}).default;
const hero = Object.assign(Object.create(Hero.prototype), {
  backpack: [], quickslots: Array(4).fill(undefined), context: {}, x: 1, y: 1,
  canAct: () => true, refreshUI() {}, spendTurn() { this.turns++; }, turns: 0,
});
const weapon = { equipSlot: 'weapon' };
hero.weapon = weapon;
const wand = Object.assign(Object.create(Wand.prototype), {
  equipSlot: 'junk', charges: 2, maxCharges: 2, wandRange: 5, context: hero.context,
  wandDamage: () => 3, level: 0,
});
const potion = { consumable: true };
hero.backpack.push(wand, potion);
assert.equal(hero.slotFor(wand), undefined);
assert.equal(hero.assignQuickslot(0, weapon), false);
assert.equal(hero.assignQuickslot(0, {}), false);
assert.equal(hero.assignQuickslot(4, wand), false);
assert.equal(hero.assignQuickslot(0, wand), true);
assert.equal(hero.assignQuickslot(1, potion), true);
hero.activateQuickslot(0);
assert.equal(hero.context.throwMode, true);
assert.equal(wand.charges, 2);
assert.equal(hero.turns, 0);
hero.cancelThrow();
assert.equal(wand.charges, 2);
hero.activateQuickslot(0);
hero.throwAt(7, 7); // out of range
assert.equal(wand.charges, 2);
hero.activateQuickslot(0);
hero.throwAt(3, 1); // empty tile still consumes exactly one charge
assert.equal(wand.charges, 1);
assert.equal(hero.turns, 1);
assert.equal(hero.weapon, weapon);
assert.ok(hero.backpack.includes(wand));
hero.activateQuickslot(0);
hero.throwAt(3, 1);
assert.equal(wand.charges, 0);
hero.activateQuickslot(0);
assert.equal(hero.context.throwMode, false);
assert.equal(hero.turns, 2);
hero.backpack = [wand];
assert.equal(hero.quickslotItem(1), undefined);
const { InventoryWindow } = load('src/games/rogue0/inventoryWindow.ts', { Wand, Gem: class {} });
hero.context.player = hero;
const inventory = new InventoryWindow({}, hero.context);
inventory.render = () => {};
inventory.clearObjects = () => {};
inventory.chooseQuickslot(2);
inventory.openMenu(weapon);
assert.equal(inventory.isOpen(), true);
inventory.openMenu(wand);
assert.equal(inventory.isOpen(), false);
assert.equal(hero.quickslotItem(2), wand);
assert.equal(hero.turns, 2);
assert.ok(!inventory.buildActions(hero, wand).some(a => a.action === 'equip'));
assert.ok(inventory.buildActions(hero, wand).some(a => a.label === 'Zap'));
console.log('Rogue0 quickslot eligibility, selection, cleanup and independent wand targeting passed');
