import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('scroll-recharging');
import assert from 'node:assert/strict';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';

const load = (name, bindings) => loadLogic(`src/games/rogue0/${name}.ts`, bindings);
const { Entity, removeEntity } = load('entity');
const dungeon = { log(ctx, message) { ctx.messages.push(message); } };
const Wand = load('items/wand', {
  Entity, dungeon, identify: item => { item.identified = true; },
  Phaser: { Math: { Between: () => 1 } },
}).default;
const WandOfFirebolt = load('items/WandOfFirebolt', {
  Wand, createBurningEffect: () => ({ id: 'burning' }),
}).default;
const ScrollOfRecharging = load('items/ScrollOfRecharging', { Entity, removeEntity, dungeon, Wand }).default;
assert.doesNotMatch(new ScrollOfRecharging({ messages: [] }).description, /equipped/i,
  'description must not mention a weapon slot');

function setup(wands) {
  const ctx = { messages: [], entities: [] };
  const scroll = new ScrollOfRecharging(ctx);
  const owned = [scroll, ...wands];
  const hero = {
    context: ctx,
    // Wands are backpack tools, not weapons. Reproduces the reported case.
    weapon: undefined,
    backpack: owned,
    getAllItems: () => owned,
    removeItem(item) {
      const index = owned.indexOf(item);
      if (index >= 0) owned.splice(index, 1);
    },
  };
  ctx.player = hero;
  ctx.entities = [...owned];
  return { ctx, hero, scroll, owned };
}

const drain = (wand, spent) => {
  wand.charges = Math.max(0, wand.maxCharges - spent);
  wand.rechargeProgress = 17; // partial passive progress must be cleared too
};

// The actual bug: with two backpack wands (one cursed) and no wand in the
// weapon slot, the scroll used to log "You have no wand equipped." and waste
// itself. Both carried wands must be refilled instead.
{
  const plain = new WandOfFirebolt({ messages: [] });
  const cursed = new WandOfFirebolt({ messages: [] });
  cursed.cursed = true;
  drain(plain, 2);
  drain(cursed, 3);
  const { ctx, scroll, owned } = setup([plain, cursed]);

  scroll.equip();

  assert.equal(plain.charges, plain.maxCharges, 'uncursed wand refilled');
  assert.equal(cursed.charges, cursed.maxCharges, 'cursed wand refilled too');
  assert.equal(plain.rechargeProgress, 0, 'partial recharge cleared');
  assert.equal(cursed.rechargeProgress, 0);
  assert.deepEqual(ctx.messages, ['Your wands are fully recharged.']);
  assert.ok(!owned.includes(scroll), 'the scroll is consumed');
  assert.ok(!ctx.entities.includes(scroll), 'the scroll leaves the floor entities');
  assert.ok(owned.includes(plain) && owned.includes(cursed), 'wands stay in the backpack');
}

// A single wand gets the singular message, and quickslots (which only point at
// carried items) need no special handling.
{
  const wand = new WandOfFirebolt({ messages: [] });
  drain(wand, 1);
  const { ctx, scroll, hero, owned } = setup([wand]);
  hero.quickslots = [wand];
  scroll.equip();
  assert.equal(wand.charges, wand.maxCharges);
  assert.deepEqual(ctx.messages, ['Your wand is fully recharged.']);
  assert.ok(owned.includes(wand));
}

// No wands at all: the scroll is still spent, with an accurate reason.
{
  const { ctx, scroll, owned } = setup([]);
  scroll.equip();
  assert.deepEqual(ctx.messages, ['You have no wand to recharge.']);
  assert.ok(!owned.includes(scroll), 'the scroll is consumed even with no wand');
  assert.ok(!ctx.entities.includes(scroll));
}

console.log('Rogue0 scroll recharging: every carried wand (including cursed ones) refills, partial progress clears, and no-wand runs report accurately passed');
