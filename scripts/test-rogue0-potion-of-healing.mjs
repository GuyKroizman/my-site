import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('potion-of-healing');
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { loadLogic } from './lib/rogue0-logic-loader.mjs';
const load = (path, bindings) => loadLogic(`src/games/rogue0/${path}`, bindings);

const effects = load('effects.ts', {
  dungeon: { log() {} },
  spawnEntityFloatingText() {},
});
const { Entity, removeEntity } = load('entity.ts', { actionCost: () => 1 });

const dungeon = { log(context, text) { context.messages.push(text); } };
const PotionOfHealing = load('items/PotionOfHealing.ts', {
  Entity, removeEntity, dungeon,
  applyEffect: effects.applyEffect,
  createPotionHealingEffect: effects.createPotionHealingEffect,
  cureDebuffs: effects.cureDebuffs,
  POTION_HEAL_TICKS: effects.POTION_HEAL_TICKS,
}).default;

function setup({ maxHealthPoints = 100, healthPoints = 10, accuracy = 90 } = {}) {
  const context = { messages: [], entities: [], visibleTiles: new Set(), simulationTime: 0 };
  const player = {
    type: 'player', name: 'Hero', context,
    healthPoints, maxHealthPoints, accuracy,
    effects: [], items: [],
    removeItem(item) {
      if (item.count > 1) { item.count -= 1; return; }
      this.items = this.items.filter(candidate => candidate !== item);
    },
  };
  const potion = new PotionOfHealing(context);
  player.items.push(potion);
  context.entities.push(potion);
  context.player = player;
  return { context, player, potion };
}

function tick(context, times) {
  for (let i = 0; i < times; i++) {
    context.simulationTime += 1;
    effects.tickEffects(context.player, context);
  }
}

// The drink banks 80% of max health + 14, capped to the health actually
// missing, and pays it out over ten world-time ticks.
{
  const { context, player, potion } = setup({ healthPoints: 10 });
  potion.equip();
  assert.equal(player.items.includes(potion), false, 'the flask is consumed');
  assert.equal(context.entities.includes(potion), false, 'the floor copy is gone');
  const mending = player.effects.find(effect => effect.id === 'potion-healing');
  assert.ok(mending, 'drinking starts a healing-over-time effect');
  assert.equal(mending.remainingHeal, 90, 'the bank is capped at the missing health');
  assert.equal(mending.healPerTick, 9, '94 total over ten ticks is capped by the missing 90');

  tick(context, 9);
  assert.equal(player.healthPoints, 91, 'nine ticks pay out nine per tick');
  assert.ok(player.effects.some(effect => effect.id === 'potion-healing'),
    'the effect lasts until the bank is empty');
  tick(context, 1);
  assert.equal(player.healthPoints, 100, 'the last tick tops the hero up');
  assert.equal(player.effects.some(effect => effect.id === 'potion-healing'), false,
    'the effect ends when fully delivered');
}

// A flask drunk at full health or nearly full does not bank a delayed heal.
{
  const { player, potion } = setup({ healthPoints: 100 });
  potion.equip();
  assert.equal(player.effects.some(effect => effect.id === 'potion-healing'), false,
    'nothing is banked at full health');
  assert.equal(player.healthPoints, 100);
}

{
  const { context, player, potion } = setup({ healthPoints: 99 });
  potion.equip();
  tick(context, 5);
  assert.equal(player.healthPoints, 100, 'only the missing point is restored');
  assert.ok(player.healthPoints <= player.maxHealthPoints, 'healing never overheals');
  assert.equal(player.effects.some(effect => effect.id === 'potion-healing'), false);
}

// Non-permanent debuffs are cured immediately; buffs and curses survive.
{
  const { player, potion } = setup({ healthPoints: 20 });
  for (const create of [
    effects.createBleedingEffect, effects.createPoisonedEffect,
    effects.createCrippledEffect, effects.createWeakenedEffect,
    effects.createConfusedEffect, effects.createBlindedEffect,
  ]) {
    effects.applyEffect(player, create(3));
  }
  effects.applyEffect(player, effects.createCursedEffect());
  effects.applyEffect(player, effects.createStrengthenedEffect(10));
  assert.equal(player.accuracy, 65, 'blindness has lowered accuracy');

  potion.equip();
  const ids = player.effects.map(effect => effect.id).sort();
  assert.deepEqual(ids, ['cursed', 'potion-healing', 'strengthened'],
    'timed debuffs are cured, curses and buffs remain');
  assert.equal(player.accuracy, 90, 'curing blindness restores accuracy');
  assert.ok(player.effects.find(effect => effect.id === 'cursed').manualExpiry,
    'a curse still needs a curse-lifting item');
}

// A stack is drunk one flask at a time.
{
  const { context, player, potion } = setup({ healthPoints: 50 });
  potion.count = 2;
  potion.equip();
  assert.equal(potion.count, 1, 'one flask leaves the stack');
  assert.equal(context.entities.includes(potion), true, 'the stack stays on the floor');
  assert.equal(player.items.includes(potion), true, 'the stack stays in the backpack');
  assert.ok(player.effects.some(effect => effect.id === 'potion-healing'));
}

// A second flask cannot bank more healing than the hero is actually missing:
// an active bank already covers those wounds.
{
  const { context, player, potion } = setup({ maxHealthPoints: 200, healthPoints: 150 });
  potion.equip();
  tick(context, 2);
  assert.equal(player.healthPoints, 160);
  const second = new PotionOfHealing(context);
  player.items.push(second);
  context.entities.push(second);
  second.equip();
  const mending = player.effects.filter(effect => effect.id === 'potion-healing');
  assert.equal(mending.length, 1, 'one Mending effect carries the flasks');
  assert.equal(mending[0].remainingHeal, 40,
    'the bank stays capped at the 40 health still missing');
  tick(context, 8);
  assert.equal(player.healthPoints, 200, 'the banked healing is delivered');
  assert.equal(player.effects.some(effect => effect.id === 'potion-healing'), false);
}

// Floor generation keeps exactly one healing potion and makes it rare; the two
// removed potion kinds must not creep back in.
{
  const sceneSource = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
  assert.doesNotMatch(sceneSource, /MinorHealPotion|FullHealPotion/,
    'the old healing potion kinds are gone from level generation');
  const weight = /\[PotionOfHealing,\s*(\d+)\]/.exec(sceneSource);
  assert.ok(weight, 'the Potion of Healing is on the weighted loot table');
  assert.ok(Number(weight[1]) <= 1, 'the single healing potion is a rare floor find');
  assert.equal(fs.existsSync('src/games/rogue0/items/minorHealPotion.ts'), false);
  assert.equal(fs.existsSync('src/games/rogue0/items/fullHealPotion.ts'), false);
}

console.log('Rogue0 Potion of Healing heals 80% + 14 over time, cures timed debuffs, and stays a rare single potion passed');
