import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('stairs');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createHeroNavigation } from '../src/games/rogue0/heroNavigation.ts';
import { woundDamageForFloor } from '../src/games/rogue0/progression.ts';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';
const source = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8').replace(/^import[\s\S]*?;\s*/gm, '')
  .replace(/const LOOT_TABLE:[\s\S]*?\n\];/, 'const LOOT_TABLE = [];');
const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
// Chasm prompts must defer movement until the game UI explicitly confirms.
{
  let falls = 0;
  const navigation = createHeroNavigation({
    dungeon: { canEnterChasm: () => true, stepIntoChasm: () => { falls++; return true; } },
    isModalOpen: c => !!c.confirmationOpen,
  });
  const hero = { tryStepIntoChasm(x, y) { return navigation.tryStepIntoChasm(this, x, y); } };
  let confirm;
  let turns = 0;
  Object.assign(hero, { x: 1, y: 1, healthPoints: 30, canAct: () => true,
    spendTurn: () => turns++, context: { floor: 1, onConfirmChasm(warning, action) {
      assert.match(warning, /maximum HP/); confirm = action;
    } } });
  hero.tryStepIntoChasm(2, 1);
  assert.equal(falls, 0, 'opening prompt does not move or damage hero');
  assert.equal(turns, 0);
  confirm();
  assert.equal(falls, 1);
  assert.equal(turns, 1);
  hero.tryStepIntoChasm(2, 1);
  hero.context.floor = 2;
  confirm();
  assert.equal(falls, 1, 'stale floor confirmation is ignored');
}
const exports = {};
const map = [[0, 1], [0, 0]];
const door = { feature: 'door', door: 'open' };
const trap = { feature: 'trap', trap: 'visible', trapKind: 'frost', trapReusable: true };
const applied = [];
const tiles = {
  snapshot: () => [{ ...door, x: 0, y: 1 }, { ...trap, x: 1, y: 1 }],
  restore(features) { applied.splice(0, applied.length, ...features.map(tile => ({ ...tile }))); }
};
const dungeon = { getCurrentLevel: () => map, log() {} };
let deaths = 0;
class TrapSkeleton {
  constructor(context, x, y) { Object.assign(this, { context, x, y, type: 'enemy' }); }
  hearNoise(x, y) { this.noise = [x, y]; }
}
const isBossFloor = floor => Number.isInteger(floor) && floor > 0 && floor % 5 === 0;
const bossSealsFloor = context => isBossFloor(context.floor) &&
  !(context.bossesSlain?.has(context.floor) ?? false);
const appliedEffects = [];
const createWoundedEffect = (duration, woundDamage) =>
  ({ id: 'wounded', name: 'Wounded', duration, woundDamage });
const applyEffect = (entity, effect) => {
  entity.effects.push(effect);
  appliedEffects.push(effect);
};
new Function('exports', 'Phaser', 'terrainFor', 'dungeon', 'isModalOpen', 'sfx', 'removeEntity', 'Skeleton',
  'isBossFloor', 'bossSealsFloor', 'woundDamageForFloor', 'applyEffect', 'createWoundedEffect', js)(
  exports, { Scene: class {} }, () => tiles, dungeon, () => false, { stairs() {} },
  () => { deaths++; }, TrapSkeleton, isBossFloor, bossSealsFloor, woundDamageForFloor,
  applyEffect, createWoundedEffect);
const scene = Object.create(exports.Scene0.prototype);
const gear = { name: 'carried potion' };
const player = { x: 0, y: 0, canAct: () => true, getAllItems: () => [gear] };
const monster = { healthPoints: 7, x: 1, y: 1 };
const loot = { name: 'floor scroll', x: 1, y: 0 };
scene.context = { floor: 2, player, entities: [player, gear, monster, loot],
  poisonClouds: [{ x: 1, y: 1, nextTick: 1.5, expiresAt: 4.5 }],
  upstairsX: 0, upstairsY: 0, stairsX: 1, stairsY: 1 };
scene.floors = new Map();
scene.seen = [[true, false], [true, true]];
scene.saveFloor();
const saved = scene.floors.get(2);
assert.deepEqual(saved.entities, [monster, loot]);
assert.deepEqual(saved.poisonClouds, scene.context.poisonClouds);
scene.context.poisonClouds[0].expiresAt = 99;
assert.equal(saved.poisonClouds[0].expiresAt, 4.5, 'floor gas snapshots are independent copies');
assert.equal(saved.entities[0].healthPoints, 7);
map[0][0] = 1;
door.door = 'closed';
scene.seen[0][0] = false;
assert.equal(saved.map[0][0], 0);
assert.equal(saved.features[0].door, 'open');
assert.equal(saved.seen[0][0], true);
trap.trapReusable = false;
assert.equal(saved.features[1].trapReusable, true, 'snapshot copies reuse policy');
scene.featureSprites = new Map();
scene.wallSprites = new Map();
scene.applyFeatures(saved.features);
assert.equal(applied[1].trapReusable, true, 'floor restoration forwards reuse policy');
assert.equal(applied[1].trap, 'visible', 'reusable trap remains armed on revisit');
let restored;
scene.restoreFloor = (...args) => { restored = args; };
scene.floors.set(1, { ...saved, down: { x: 4, y: 5 } });
scene.tryAscend();
assert.equal(restored[0], 1);
assert.deepEqual(restored[2], { x: 4, y: 5 });
restored = undefined;
player.x = 9;
scene.tryAscend();
assert.equal(restored, undefined, 'cannot ascend away from upstairs');
player.x = 0;
scene.context.floor = 1;
scene.tryAscend();
assert.equal(restored, undefined, 'first-floor entrance does not leave the dungeon');
scene.context.floor = 1;
scene.descend();
assert.equal(restored[0], 2);
assert.deepEqual(restored[2], saved.up);
// Falling uses the normal snapshot/restore path, never the exit/win path.
Object.assign(player, { healthPoints: 30, maxHealthPoints: 30, effects: [],
  inputBuffer: ['ArrowRight'], walkPath: [{ x: 1, y: 1 }],
  cancelThrow() { this.throwCancelled = true; }, refreshUI() {},
  takeDamage(amount) { this.healthPoints -= amount; } });
scene.context.maxFloor = 5;
scene.context.floor = 1;
scene.context.pendingFall = true;
scene.restoreFloor = (floor, snapshot, arrival) => {
  restored = [floor, snapshot, arrival];
  scene.context.floor = floor;
};
scene.resolveFall();
assert.equal(scene.context.floor, 2);
assert.equal(player.healthPoints, 9, 'a fall costs 70% of maximum HP (21 of 30)');
assert.equal(scene.context.pendingFall, false);
assert.deepEqual(player.inputBuffer, []);
assert.deepEqual(player.walkPath, []);
assert.equal(player.throwCancelled, true);
assert.equal(deaths, 0);
assert.deepEqual(appliedEffects.map(effect => effect.id), ['wounded'],
  'the fall leaves a damage-over-time wound');
assert.equal(appliedEffects[0].duration, 7, 'the wound lasts seven turns');
assert.equal(appliedEffects[0].woundDamage, woundDamageForFloor(2));
assert.equal(player.effects[0], appliedEffects[0]);
scene.resolveFall();
assert.equal(player.healthPoints, 9, 'fall is resolved exactly once');
assert.equal(appliedEffects.length, 1, 'the wound is applied once too');
// First visit also generates a floor through the normal descent pipeline.
scene.context.floor = 2;
scene.context.pendingFall = true;
scene.generateLevel = floor => { assert.equal(floor, 3); return {
  levelArray: [[0]], spawn: { x: 0, y: 0 }, stairs: { x: 0, y: 0 }
}; };
dungeon.initialize = () => {};
scene.setupFloor = floor => { scene.context.floor = floor; };
player.healthPoints = 21;
scene.resolveFall();
assert.equal(scene.context.floor, 3);
assert.equal(player.healthPoints, 0, 'fall damage can kill on arrival');
assert.equal(deaths, 1);
assert.equal(appliedEffects.length, 1, 'a hero killed on arrival does not get a wound');
scene.context.floor = 5;
// The floor-5 Unblinking Coil is already dead, otherwise the seal (not the abyss)
// would resolve this fall.
scene.context.bossesSlain = new Set([5]);
scene.context.pendingFall = true;
player.healthPoints = 30;
scene.events = { emit() { assert.fail('falling must never win the run'); } };
scene.resolveFall();
assert.equal(scene.context.floor, 5);
assert.equal(player.healthPoints, 0);
assert.equal(deaths, 2);
assert.equal(appliedEffects.length, 1, 'falling into the abyss applies no wound');
// The wound scales with the floor you land on: deeper falls bite harder.
{
  scene.context.maxFloor = 25;
  scene.context.floor = 19;
  scene.context.pendingFall = true;
  scene.generateLevel = () => ({ levelArray: [[0]], spawn: { x: 0, y: 0 }, stairs: { x: 0, y: 0 } });
  player.healthPoints = 30;
  scene.resolveFall();
  assert.equal(scene.context.floor, 20);
  assert.equal(player.healthPoints, 9, 'impact damage stays 70% of max HP at depth');
  assert.equal(appliedEffects.at(-1).woundDamage, 4, 'a floor-20 fall leaves 4-damage-per-turn wounds');
}
// The wound uses the shared status pipeline: it ticks once per turn, scales with
// the floor it was earned on and expires after seven ticks.
{
  const { applyEffect: applyStatusEffect, createWoundedEffect, describeEffect, tickEffects } =
    loadLogic('src/games/rogue0/effects.ts', { spawnEntityFloatingText() {} });
  const ctx = { messages: [], visibleTiles: new Set(), simulationTime: 10 };
  const hero = { type: 'player', context: ctx, effects: [], healthPoints: 50,
    takeDamage(amount) { this.healthPoints -= amount; } };
  applyStatusEffect(hero, createWoundedEffect(7, 3));
  assert.equal(hero.effects[0].nextTick, 11, 'the first tick is one time unit after arrival');
  assert.match(describeEffect(hero.effects[0]), /3 damage per turn/, 'tooltip shows scaled damage');
  for (let turn = 11; turn <= 17; turn++) {
    ctx.simulationTime = turn;
    tickEffects(hero, ctx);
  }
  assert.equal(hero.healthPoints, 29, 'seven ticks of three damage');
  assert.equal(hero.effects.length, 0, 'the wound wears off after seven turns');
  // A second, deeper fall refreshes the wound but keeps the strongest damage.
  const before = hero.healthPoints;
  applyStatusEffect(hero, createWoundedEffect(7, 2));
  applyStatusEffect(hero, createWoundedEffect(7, 4));
  assert.equal(hero.effects[0].woundDamage, 4, 'a deeper wound supersedes a weaker one');
  assert.equal(hero.healthPoints, before, 'refreshing a status deals no damage by itself');
}
// Real scene-owned summon placement: bounded, cardinal, safe, current timeline.
{
  const summoner = Object.create(exports.Scene0.prototype);
  const summonMap = Array.from({ length: 5 }, () => Array(5).fill(0));
  dungeon.getCurrentLevel = () => summonMap;
  const features = new Map();
  tiles.getFeature = (x, y) => features.get(`${x},${y}`);
  const ctx = { simulationTime: 37.5, entities: [{ type: 'player', x: 1, y: 2 }],
    stairsX: 2, stairsY: 3, upstairsX: 2, upstairsY: 1 };
  summoner.context = ctx;
  assert.equal(summoner.summonFromTrap(2, 2), true);
  assert.equal(ctx.entities.length, 2, 'exactly one reinforcement');
  const skeleton = ctx.entities[1];
  assert.ok(skeleton instanceof TrapSkeleton);
  assert.deepEqual([skeleton.x, skeleton.y], [3, 2]);
  assert.deepEqual(skeleton.noise, [2, 2]);
  assert.equal(skeleton.nextActionTime, 37.5);
  assert.equal(summoner.summonFromTrap(2, 2), false, 'occupied/stair tiles excluded');
  ctx.entities.pop();
  for (const feature of ['chasm', 'trap', 'secretDoor', 'door']) {
    features.set('3,2', feature);
    assert.equal(summoner.summonFromTrap(2, 2), false, `${feature} not a safe summon tile`);
  }
  features.clear();
  ctx.entities.push({ type: 'item', x: 3, y: 2 });
  assert.equal(summoner.summonFromTrap(2, 2), false, 'loot tiles excluded');
  ctx.entities.pop(); summonMap[2][3] = 1;
  assert.equal(summoner.summonFromTrap(2, 2), false, 'wall excluded');
  summonMap[2][3] = 0;
  features.set('3,2', 'water');
  assert.equal(summoner.summonFromTrap(2, 2), true, 'water is safe for grounded summons');
}
console.log('Rogue0 floor snapshots, exploration, terrain, safe trap summons, entity retention, stair travel and damaging falls passed');
