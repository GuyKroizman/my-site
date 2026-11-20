import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('scroll-target-spend');
import assert from 'node:assert/strict';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';

const load = (name, bindings) => loadLogic(`src/games/rogue0/${name}.ts`, bindings);
const entity = load('entity');
const { Entity, identify, removeEntity, saveConsumableKnowledge } = entity;
const dungeon = { log(ctx, message) { ctx.messages.unshift(message); } };
const TargetHero = load('classes/basicHero', {
  Entity, Wand: class {}, dungeon, identify, removeEffect() {}, applyEffect() {},
}).default;
const ScrollOfIdentify = load('items/ScrollOfIdentify', { Entity, identify, removeEntity }).default;
const { InventoryWindow } = load('inventoryWindow', { Wand: class {} });

function setup() {
  const ctx = { messages: [], entities: [], scene: { input: { enabled: true } } };
  let turns = 0;
  const scroll = new ScrollOfIdentify(ctx);
  scroll.count = 2;
  const target = Object.assign(new Entity(), {
    context: ctx, type: 'item', equipSlot: 'ring', name: 'Ring', identified: false,
  });
  const target2 = Object.assign(new Entity(), {
    context: ctx, type: 'item', equipSlot: 'ring', name: 'Ring of Might', identified: false,
  });
  const owned = [scroll, target, target2];
  const hero = Object.assign(Object.create(TargetHero.prototype), {
    context: ctx, backpack: owned, effects: [], canAct: () => true,
    refreshUI() {}, clearItemUI() {}, getAllItems: () => owned,
    removeItem(item) {
      if (item.count > 1) item.count -= 1;
      else owned.splice(owned.indexOf(item), 1);
    },
    spendTurn(action) { assert.equal(action, 'use'); turns += 1; },
  });
  ctx.player = hero;
  ctx.entities = [scroll, target, target2];
  const picker = new InventoryWindow({}, ctx);
  picker.render = () => {};
  picker.clearObjects = () => {};
  return { ctx, hero, picker, scroll, target, target2, turns: () => turns };
}

// The reported exploit: reading an unidentified scroll opened the picker, and
// closing it left the scroll unidentified and unspent, teaching its type for
// free. Opening the picker must spend one copy and record its identity.
{
  const { ctx, hero, picker, scroll, target, turns } = setup();
  assert.equal(scroll.identified, false, 'a found scroll starts unidentified');
  assert.equal(saveConsumableKnowledge(ctx).known.length, 0);

  hero.useItem(scroll);
  assert.equal(picker.isOpen(), true, 'the picker opens');
  assert.equal(picker.targetedItem, scroll);
  assert.equal(scroll.count, 1, 'one copy is spent as soon as the picker opens');
  assert.equal(scroll.identified, true, 'the spent scroll is identified, so its type is no longer a secret');
  assert.ok(saveConsumableKnowledge(ctx).known.includes('scroll:Scroll of Identify'),
    'the type is recorded in shared run knowledge, not just observed in the modal');
  assert.equal(turns(), 0, 'browsing the picker does not spend a turn');
  assert.equal(target.identified, false, 'no target was chosen yet');

  picker.dismiss();
  assert.equal(picker.isOpen(), false);
  assert.equal(scroll.count, 1, 'cancelling does not refund or spend another copy');
  assert.ok(hero.getAllItems().includes(scroll), 'the remaining copy is still carried');
  assert.equal(turns(), 0, 'cancelling spends no turn');
}

// Confirming still applies the effect to exactly one target, spending one turn
// and no second copy — the stack was already spent when the picker opened.
{
  const { hero, picker, scroll, target, target2, turns } = setup();
  hero.useItem(scroll); // count 2 -> 1
  picker.openMenu(target);
  assert.equal(picker.isOpen(), false);
  assert.equal(target.identified, true, 'the chosen target is identified');
  assert.equal(scroll.count, 1, 'confirming does not spend a second copy');
  assert.equal(turns(), 1, 'confirming spends exactly one turn');

  hero.useItem(scroll); // count 1 -> 0, last copy spent on open
  assert.ok(!hero.getAllItems().includes(scroll));
  picker.openMenu(target2);
  assert.equal(target2.identified, true);
  assert.equal(turns(), 2);
}

// With nothing left to identify the picker never opens, so no copy is wasted.
{
  const { ctx, hero, picker, scroll, target, target2 } = setup();
  target.identified = true;
  target2.identified = true;
  const before = scroll.count;
  assert.equal(hero.useItem(scroll), false);
  assert.equal(picker.isOpen(), false);
  assert.equal(scroll.count, before, 'no eligible target means no spend');
  assert.equal(ctx.messages[0], 'You have no other unidentified items.');
}

console.log('Rogue0 targeted scroll spend: opening a picker spends and identifies a copy, confirming spends only a turn, and a cancelled picker cannot reveal a scroll type for free passed');
