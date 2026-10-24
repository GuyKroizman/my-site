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
const { Entity } = load('src/games/rogue0/entity.ts');
const dungeon = { log() {}, getCurrentLevel: () => Array.from({length: 8}, () => Array(8).fill(0)),
  firstActorInPath: () => undefined, entityAtTile: () => undefined };
const Wand = load('src/games/rogue0/items/wand.ts', { Entity, dungeon, identify: i => { i.identified = true; } }).default;
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
