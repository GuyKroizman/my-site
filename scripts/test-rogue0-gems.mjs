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
// Closing item details must not close the backpack, even while not action-ready.
context.scene = { input: { enabled: true } };
for (const actionReady of [true, false]) {
  ready = actionReady;
  for (const dismiss of [() => window.doAction('close', shield), () => window.dismiss()]) {
    window.openWindow();
    window.openMenu(shield);
    assert.equal(window.menuItem, shield);
    dismiss();
    assert.equal(window.menuItem, undefined);
    assert.equal(window.isOpen(), true, 'only item details close');
    assert.equal(context.inventoryOpen, true);
    assert.equal(context.scene.input.enabled, false, 'world remains blocked');
    assert.equal(turns, 3, 'dismissal spends no turn');
    window.dismiss();
    assert.equal(window.isOpen(), false);
    assert.equal(context.scene.input.enabled, true);
  }
}
// Turn-spending actions still close inventory so the world can advance.
context.player.equipItem = () => { ready = false; };
ready = true;
window.openWindow();
window.openMenu(shield);
window.doAction('equip', shield);
assert.equal(window.isOpen(), false);
assert.equal(context.scene.input.enabled, true);
// Holy Potion uses the same inventory modal lifecycle, but targets one curse.
{
  const { identify } = load('src/games/rogue0/entity.ts');
  const dungeon = { log(ctx, message) { ctx.messages.unshift(message); } };
  const removeEffect = (hero, id) => { hero.effects = hero.effects.filter(e => e.id !== id); };
  const applyEffect = (hero, effect) => { removeEffect(hero, effect.id); hero.effects.push(effect); };
  const HolyPotion = load('src/games/rogue0/items/holyPotion.ts', { Entity, identify, removeEntity, dungeon }).default;
  const CursedGem = load('src/games/rogue0/items/cursedGem.ts', {
    Entity, removeEffect, applyEffect, createCursedEffect: () => ({ id: 'cursed' }),
  }).default;
  const TargetHero = load('src/games/rogue0/classes/basicHero.ts', {
    Entity, Gem, Wand: class {}, dungeon, removeEffect, identify,
  }).default;
  const ctx = { entities: [], messages: [], scene: { input: { enabled: true } } };
  let uses = 0;
  const hero = Object.assign(Object.create(TargetHero.prototype), {
    context: ctx, backpack: [], effects: [], canAct: () => true,
    refreshUI() {}, clearItemUI() {}, spendTurn() { uses++; },
  });
  ctx.player = hero;
  const potion = new HolyPotion(ctx);
  potion.count = 2;
  const first = new CursedGem(ctx), second = new CursedGem(ctx);
  hero.ring1 = first; hero.ring2 = second; hero.backpack = [potion];
  ctx.entities = [potion, first, second];
  first.equip(); second.equip();
  const picker = new InventoryWindow({}, ctx);
  picker.render = () => {}; picker.clearObjects = () => {};
  assert.equal(hero.useItem(potion), false);
  assert.equal(picker.isOpen(), true);
  assert.equal(picker.targetedItem, potion);
  assert.equal(uses, 0); assert.equal(potion.count, 2);
  picker.dismiss();
  assert.equal(picker.targetedItem, undefined);
  assert.equal(uses, 0, 'cancelling Holy Potion is free');
  assert.equal(potion.count, 2);
  hero.useItem(potion);
  picker.openMenu(potion);
  assert.equal(picker.isOpen(), true, 'invalid target does not consume or close');
  picker.openMenu(first);
  assert.equal(picker.isOpen(), false);
  assert.equal(first.cursed, false); assert.equal(second.cursed, true);
  assert.equal(first.name, 'Cleansed Gem');
  assert.match(first.displayDescription, /no longer drains health/);
  assert.equal(first.identified, true);
  assert.equal(potion.count, 1); assert.ok(ctx.entities.includes(potion));
  assert.equal(uses, 1, 'confirmation spends exactly one use action');
  assert.ok(hero.effects.some(e => e.id === 'cursed'), 'other equipped cursed gem retains its drain');
  hero.useItem(potion); picker.openMenu(second);
  assert.equal(uses, 2);
  assert.ok(!hero.effects.some(e => e.id === 'cursed'));
  assert.ok(!hero.getAllItems().includes(potion));
  assert.ok(!ctx.entities.includes(potion));
  first.equip(); second.equip();
  assert.deepEqual(hero.effects, [], 're-equipping cleansed gems never reapplies a curse');
  const spare = new HolyPotion(ctx); hero.backpack.push(spare);
  hero.useItem(spare);
  assert.equal(picker.isOpen(), false, 'no eligible target leaves potion unspent');
  assert.equal(uses, 2);
  first.cursed = true; second.cursed = true;
  hero.removeCurse();
  assert.ok(!first.cursed && !second.cursed, 'scroll-style global removal still cleanses all items');
}
console.log('Rogue0 gem and Holy Potion target selection, cancellation, stacking, cleansing descriptions and turn costs passed');
