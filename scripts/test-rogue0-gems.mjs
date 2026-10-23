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
const Shield = load('src/games/rogue0/items/shield.ts', { Entity }).default;
const Gem = load('src/games/rogue0/items/gem.ts', { Entity, upgrade, removeEntity, Shield }).default;
// Avoid sprite construction; exercise actual item and entity methods.
const context = { entities: [], messages: [] };
const gem = Object.assign(Object.create(Gem.prototype), { context, count: 2, type: 'item' });
const shield = Object.assign(Object.create(Shield.prototype), { context, level: 0, name: 'Shield', type: 'item', identified: true });
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
assert.equal(gem.enchant('weapon'), false);
assert.equal(gem.enchant('armor'), false);
context.player.armor = shield;
ready = false;
assert.equal(gem.enchant('armor'), false);
ready = true;
assert.equal(gem.enchant('armor'), true);
assert.equal(shield.protection(), 2);
assert.equal(shield.displayName, 'Shield +1');
assert.equal(gem.count, 1);
assert.ok(context.entities.includes(gem));
context.player.weapon = Object.assign(Object.create(Entity.prototype), { context, level: 2, name: 'Sword' });
assert.equal(gem.enchant('weapon'), true);
assert.equal(context.player.weapon.level, 3);
assert.equal(turns, 2);
assert.equal(items.length, 0);
assert.equal(context.entities.length, 0);
assert.equal(gem.enchant('weapon'), false);
const { InventoryWindow } = load('src/games/rogue0/inventoryWindow.ts', { Gem, Shield });
const window = new InventoryWindow({}, context);
context.player.slotOf = () => undefined;
context.player.slotFor = () => undefined;
const actions = window.buildActions(context.player, gem);
assert.ok(actions.find(a => a.action === 'enchant-weapon').enabled);
assert.ok(actions.find(a => a.action === 'enchant-shield').enabled);
context.player.armor = {};
assert.equal(window.buildActions(context.player, gem).find(a => a.action === 'enchant-shield').enabled, false);
console.log('Rogue0 gem enchanting, stacking, turn costs and inventory actions passed');
