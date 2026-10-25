import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('gems');
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
const { Entity, upgrade, removeEntity } = load('src/games/rogue0/entity.ts');
let rollMaximum = false;
const Axe = load('src/games/rogue0/items/axe.ts', {
  Entity, Phaser: { Math: { Between: (min, max) => rollMaximum ? max : min } },
}).default;
const axe = new Axe({ messages: [] });
for (let level = 0; level <= 3; level++) {
  assert.equal(axe.level, level);
  assert.ok(axe.displayDescription.includes(`between ${2 + level} and ${7 + level} damage`));
  rollMaximum = false;
  assert.equal(axe.damage(), 2 + level);
  rollMaximum = true;
  assert.equal(axe.damage(), 7 + level);
  if (level < 3) upgrade(axe);
}
const Shield = load('src/games/rogue0/items/shield.ts', { Entity }).default;
const Gem = load('src/games/rogue0/items/gem.ts', { Entity, upgrade, removeEntity, Shield }).default;
// Real gem pickups must merge, including when the backpack is full.
const Hero = load('src/games/rogue0/classes/basicHero.ts', { Entity }).default;
const pickupContext = { entities: [], messages: [] };
const collector = Object.assign(Object.create(Hero.prototype), {
  context: pickupContext, backpack: [], capacity: 1, refreshUI() {},
});
const firstGem = new Gem(pickupContext);
const secondGem = new Gem(pickupContext);
secondGem.count = 3;
pickupContext.entities.push(firstGem, secondGem);
assert.equal(collector.addItem(firstGem), true);
assert.equal(collector.addItem(secondGem), true);
assert.deepEqual(collector.backpack, [firstGem]);
assert.equal(firstGem.count, 4);
assert.ok(!pickupContext.entities.includes(secondGem));
collector.removeItem(firstGem);
assert.equal(firstGem.count, 3);
assert.deepEqual(collector.backpack, [firstGem]);

// Avoid sprite construction; exercise actual item and entity methods.
const context = { entities: [], messages: [] };
const gem = Object.assign(Object.create(Gem.prototype), { context, count: 2, type: 'item', consumable: true });
const shield = Object.assign(Object.create(Shield.prototype), { context, level: 0, tier: 1, name: 'Shield', type: 'item', equipSlot: 'armor', identified: true });
let ready = true, turns = 0;
const items = [gem];
context.entities.push(gem);
context.player = {
  canAct: () => ready,
  getAllItems: () => items,
  removeItem(item) { if (item.count > 1) item.count--; else items.splice(items.indexOf(item), 1); },
  spendTurn(action) { assert.equal(action, 'use'); turns++; },
  refreshUI() {},
};
assert.equal(gem.enchant({ equipSlot: 'consumable' }), false);
assert.equal(gem.enchant(shield), false);
context.player.armor = shield;
items.push(shield);
ready = false;
assert.equal(gem.enchant(shield), false);
ready = true;
assert.equal(gem.enchant(shield), true);
assert.equal(shield.protection(), 2);
assert.equal(shield.displayName, 'Shield +1 (Tier 1)');
assert.equal(gem.count, 1);
assert.ok(context.entities.includes(gem));
context.player.weapon = Object.assign(Object.create(Entity.prototype), { context, level: 2, name: 'Sword', equipSlot: 'weapon' });
items.push(context.player.weapon);
assert.equal(gem.enchant(context.player.weapon), true);
assert.equal(context.player.weapon.level, 3);
assert.equal(turns, 2);
assert.equal(items.length, 2);
assert.equal(context.entities.length, 0);
assert.equal(gem.enchant({ equipSlot: 'consumable' }), false);
const { InventoryWindow } = load('src/games/rogue0/inventoryWindow.ts', { Gem, Wand: class {} });
const window = new InventoryWindow({}, context);
window.render = () => {};
window.clearObjects = () => {};
items.push(gem);
context.entities.push(gem);
context.player.slotOf = () => undefined;
context.player.slotFor = () => undefined;
assert.ok(window.buildActions(context.player, gem).find(a => a.action === 'use'));
context.onChooseEnchantment(gem);
assert.equal(window.isOpen(), true);
assert.equal(window.enchantingGem, gem);
window.openMenu({ equipSlot: 'consumable' });
assert.equal(window.isOpen(), true);
assert.equal(turns, 2);
window.close();
assert.equal(window.enchantingGem, undefined);
assert.ok(items.includes(gem));
assert.equal(turns, 2);
context.onChooseEnchantment(gem);
window.openMenu(shield);
assert.equal(window.isOpen(), false);
assert.equal(shield.level, 2);
assert.equal(turns, 3);
assert.ok(!items.includes(gem));
console.log('Rogue0 gem target selection, cancellation, stacking and turn costs passed');
