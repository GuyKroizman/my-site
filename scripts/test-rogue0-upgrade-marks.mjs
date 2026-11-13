import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('upgrade-marks');
import assert from 'node:assert/strict';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
import { createInventoryActions } from '../src/games/rogue0/inventory.ts';
import { encodeGraph, decodeGraph } from '../src/games/rogue0/saveCodec.ts';

const { Entity, upgrade, UPGRADE_REMOVAL_PERCENT_PER_LEVEL } =
  load('src/games/rogue0/entity.ts');
Entity.prototype.init = function (context) { this.context = context; };
const { TieredWeapon, TieredArmor } = load('src/games/rogue0/items/tieredEquipment.ts', { Entity });
assert.equal(UPGRADE_REMOVAL_PERCENT_PER_LEVEL, 10);
const noRoll = () => { throw new Error('Unexpected random draw'); };
function sequence(values) {
  return () => { assert.ok(values.length, 'no extra rolls'); return values.shift(); };
}
function gear(slot = 'weapon') {
  const item = new (slot === 'weapon' ? TieredWeapon : TieredArmor)({ messages: [] });
  Object.assign(item, { level: 2, cursed: true, curseId: slot === 'weapon' ? 'wayward' : 'bulk',
    glyph: slot === 'weapon' ? 'range' : 'thorns', curseScanned: true });
  return item;
}

// Both rolls are independent; even removal of both marks still upgrades once.
for (const slot of ['weapon', 'armor']) {
  for (const cleanse of [false, true]) for (const erase of [false, true]) {
    const item = gear(slot), beforeGlyph = item.glyph, beforeCurse = item.curseId;
    let cleansed = 0, upgraded = 0;
    item.onUncursed = () => {
      cleansed++;
      assert.equal(item.cursed, false);
      assert.equal(item.curseId, '');
    };
    item.onUpgrade = () => { upgraded++; };
    upgrade(item, sequence([cleanse ? 0.299999 : 0.30, erase ? 0.299999 : 0.30]));
    assert.equal(item.level, 3);
    assert.equal(item.tier, 1);
    assert.equal(upgraded, 1);
    assert.equal(cleansed, Number(cleanse));
    assert.equal(item.cursed, !cleanse);
    assert.equal(item.curseId, cleanse ? '' : beforeCurse);
    assert.equal(item.glyph, erase ? '' : beforeGlyph);
    assert.equal(item.identified, false, 'upgrade does not identify hidden quality');
    assert.equal(item.curseScanned, true);
    const messages = item.context.messages.join('\n');
    assert.equal(messages.includes('lifts the curse'), cleanse);
    assert.equal(messages.includes('erases the'), erase);
    assert.doesNotMatch(messages, /level 3|Wayward|Bulk/, 'no hidden level or named curse leak');
    if (slot === 'weapon') assert.equal(item.range(), erase ? 0 : 2, 'Reach disappears immediately');
  }
}

// Verify every 10-point threshold using actual upgrades, including +1 and
// the 100% cap. Pre-upgraded finds use their current level, not a use counter.
for (const slot of ['weapon', 'armor']) {
  for (let level = 1; level <= 12; level++) {
    const chance = Math.min(1, level / 10);
    for (const roll of [chance - 0.000001, ...(chance < 1 ? [chance] : [])]) {
      const item = gear(slot);
      item.level = level - 1;
      upgrade(item, sequence([roll, roll]));
      assert.equal(item.level, level);
      assert.equal(item.cursed, roll >= chance, `${slot} curse at +${level}, roll ${roll}`);
      assert.equal(!!item.glyph, roll >= chance, `${slot} glyph at +${level}, roll ${roll}`);
    }
  }
  // Retaining the marks does not reset the escalating risk, even after save.
  const item = gear(slot);
  item.level = 0;
  upgrade(item, sequence([0.15, 0.15]));
  assert.equal(item.cursed, true, '+1 has only a 10% removal chance');
  const registry = { gear: slot === 'weapon' ? TieredWeapon : TieredArmor };
  const restored = decodeGraph(encodeGraph(item, registry), registry);
  restored.context = { messages: [] };
  upgrade(restored, sequence([0.15, 0.15]));
  assert.equal(restored.level, 2);
  assert.equal(restored.cursed, false, '+2 has a 20% removal chance after reload');
  assert.equal(restored.glyph, '');
}

// A cap rejection, plain gear, and nonphysical items never make removal rolls.
{
  const item = gear();
  item.maxLevel = item.level;
  upgrade(item, noRoll);
  assert.equal(item.level, 2);
  assert.equal(item.cursed, true);
  assert.equal(item.glyph, 'range');
}
for (const props of [
  { equipSlot: 'ring' }, { equipSlot: 'artifact' }, { equipSlot: 'junk', textureKey: 'wand-frost' },
  { equipSlot: 'weapon', name: 'Scroll of Fireball' },
]) {
  const item = Object.assign(gear(), props);
  upgrade(item, noRoll);
  assert.equal(item.level, 3);
  assert.equal(item.cursed, true);
  assert.equal(item.glyph, 'range');
}
{
  const item = gear();
  item.cursed = false; item.curseId = ''; delete item.glyph; // Legacy save.
  upgrade(item, noRoll);
  assert.equal(item.level, 3);
  item.glyph = 'fire';
  upgrade(item, sequence([0]));
  assert.equal(item.glyph, '');
  item.cursed = true; item.curseId = 'wayward';
  upgrade(item, sequence([0]));
  assert.equal(item.cursed, false);
  upgrade(item, noRoll);
  assert.equal(item.level, 6, 'removing marks never caps future upgrades');
}

// Real scroll flow: target selection/cancellation is free, each use consumes
// one stacked scroll and one turn; cleansing unlocks equipped gear normally.
{
  const actions = [];
  const inventory = createInventoryActions({ log() {}, clearItemUI() {} });
  const context = { messages: [], entities: [] };
  const weapon = gear(); weapon.context = context;
  const player = {
    context, weapon, backpack: [], capacity: 20,
    canAct: () => true,
    getAllItems() { return inventory.allItems(this); },
    removeItem(item) { inventory.removeItem(this, item); },
    spendTurn(action) { actions.push(action); },
  };
  context.player = player;
  const Scroll = load('src/games/rogue0/items/ScrollOfUpgrade.ts', {
    Entity, Wand: class {}, upgrade: item => upgrade(item, () => 0), identify() {},
    removeEntity: (ctx, item) => { ctx.entities = ctx.entities.filter(e => e !== item); },
  }).default;
  const scroll = new Scroll(context);
  scroll.count = 2;
  player.backpack.push(scroll); context.entities.push(scroll);
  context.onChooseItemTarget = item => assert.equal(item, scroll);
  scroll.equip(); // Opening and then cancelling does not upgrade or roll.
  assert.equal(weapon.level, 2);
  assert.equal(scroll.count, 2);
  inventory.unequipItem(player, weapon);
  assert.equal(player.weapon, weapon, 'cursed gear starts locked');
  assert.equal(scroll.useOnItem(gear()), false, 'unowned target is rejected');
  assert.equal(actions.length, 0);
  assert.equal(scroll.useOnItem(weapon), true);
  assert.equal(weapon.level, 3);
  assert.equal(weapon.cursed, false);
  assert.equal(weapon.glyph, '');
  assert.equal(scroll.count, 1);
  assert.ok(context.entities.includes(scroll));
  assert.deepEqual(actions, ['use']);
  inventory.unequipItem(player, weapon);
  assert.equal(player.weapon, undefined, 'cleansed weapon is unlocked');
  assert.ok(player.backpack.includes(weapon));
  assert.equal(scroll.useOnItem(weapon), true);
  assert.equal(weapon.level, 4);
  assert.ok(!player.backpack.includes(scroll));
  assert.ok(!context.entities.includes(scroll));
  assert.deepEqual(actions, ['use', 'equip', 'use']);
  assert.match(scroll.description, /curse removal and glyph erasure each roll independently/);
  assert.match(scroll.description, /10% at \+1, 20% at \+2.*100% at \+10/);
  const registry = { weapon: TieredWeapon };
  const restored = decodeGraph(encodeGraph(weapon, registry), registry);
  assert.equal(restored.level, 4);
  assert.equal(restored.cursed, false);
  assert.equal(restored.curseId, '');
  assert.equal(restored.glyph, '');
}
console.log('Upgrade marks: level-scaled independent curse/glyph rolls, 10–100% boundaries, caps, eligibility, secrecy, scroll costs, unlock and save persistence passed');
