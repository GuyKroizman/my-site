import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('haste-potion');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { actionCost } from '../src/games/rogue0/timing.ts';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';

const effects = loadLogic('src/games/rogue0/effects.ts', {
  spawnEntityFloatingText() {},
  dungeon: {},
});

const logs = [];
const removed = [];
class EntityStub {
  init(context) { this.context = context; }
  removeItem(item) { this.removed.push(item); }
}
const PotionOfHaste = loadLogic('src/games/rogue0/items/PotionOfHaste.ts', {
  Entity: EntityStub,
  removeEntity: (_context, item) => { removed.push(item); },
  applyEffect: effects.applyEffect,
  createHasteEffect: effects.createHasteEffect,
  dungeon: { log: (_context, text) => { logs.push(text); } },
}).default;

const context = { simulationTime: 0, messages: [], player: undefined };
const player = Object.assign(new EntityStub(), {
  context, type: 'player', effects: [], movementSpeed: 1, attackDelay: 1, removed: [],
});
context.player = player;
const potion = new PotionOfHaste(context);
assert.equal(potion.name, 'Potion of Haste');
assert.equal(potion.equipSlot, 'consumable');
assert.equal(potion.consumable, true);
assert.match(potion.description, /four times faster/);
assert.match(potion.description, /40 turns/);

// Drinking the flask consumes it and installs a 40-turn 4x movement buff.
potion.equip();
assert.deepEqual(player.removed, [potion], 'the flask leaves the backpack');
assert.deepEqual(removed, [potion], 'the flask leaves the world');
assert.equal(player.effects.length, 1);
const haste = player.effects[0];
assert.equal(haste.id, 'haste');
assert.equal(haste.duration, 40);
assert.equal(haste.speedMultiplier, 4);
assert.ok(logs.some(line => line.includes('world slows')), 'drinking is announced');
assert.equal(actionCost(player, 'move'), 0.25, 'walking is four times faster');
assert.equal(actionCost(player, 'attack'), 1, 'attacks keep their normal speed');
assert.equal(actionCost(player, 'wait'), 1);
assert.equal(actionCost(player, 'search'), 2);

// A weaker ordinary haste never downgrades the potion, and a second flask
// refreshes its duration without stacking duplicate buffs.
effects.applyEffect(player, effects.createHasteEffect(8));
assert.equal(player.effects.length, 1);
assert.equal(player.effects[0].speedMultiplier, 4, 'the 4x buff survives a 2x refresh');
assert.equal(actionCost(player, 'move'), 0.25);
effects.applyEffect(player, effects.createHasteEffect(40, 4));
assert.equal(player.effects.length, 1);
assert.equal(player.effects[0].duration, 40);

// Other speed modifiers still compose with the flask.
player.effects.push({ id: 'crippled' });
assert.equal(actionCost(player, 'move'), 0.5, 'cripple halves the 4x speed');
player.effects = [haste, { id: 'chilled' }];
assert.equal(actionCost(player, 'move'), 0.5, 'chilled doubles the 0.25 cost');
player.effects = [haste];

// The buff lasts forty turns of world time, then movement returns to normal.
for (let turn = 1; turn <= 39; turn++) {
  context.simulationTime = turn;
  effects.tickEffects(player, context);
  assert.equal(player.effects.length, 1, `still hasted on turn ${turn}`);
  assert.equal(actionCost(player, 'move'), 0.25);
}
context.simulationTime = 40;
effects.tickEffects(player, context);
assert.equal(player.effects.length, 0, 'the potion expires after 40 turns');
assert.equal(actionCost(player, 'move'), 1);

// The default Haste buff is unchanged for every other source.
const ordinary = effects.createHasteEffect();
assert.equal(ordinary.speedMultiplier, 2);
assert.equal(ordinary.description, 'Doubles movement speed.');
player.effects = [ordinary];
assert.equal(actionCost(player, 'move'), 0.5);

// The potion is wired into the drop table, saves, the consumable catalogue and
// shops; without these it could never reach the player.
const read = path => fs.readFileSync(path, 'utf8');
assert.match(read('src/games/rogue0/scene0.ts'), /\[PotionOfHaste,\s*\d+\]/);
assert.match(read('src/games/rogue0/saveRegistry.ts'), /PotionOfHaste/);
assert.match(read('src/games/rogue0/entity.ts'), /'Potion of Haste'/);
assert.match(read('src/games/rogue0/store/shopItems.ts'), /'potion-haste'/);
assert.match(read('src/games/rogue0/store/shopStock.ts'), /'haste'.*'levitation'/);

console.log('Potion of Haste: 4x movement for 40 turns, consumed on use, stacks and expires correctly.');
