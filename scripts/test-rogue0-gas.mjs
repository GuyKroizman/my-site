import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('gas');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function load(name, bindings = {}) {
  const source = fs.readFileSync(`src/games/rogue0/${name}.ts`, 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
  const exports = {};
  new Function('exports', ...Object.keys(bindings), ts.transpile(source, {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS
  }))(exports, ...Object.values(bindings));
  return exports;
}
const tiles = load('tiles');
const effects = load('effects', { spawnEntityFloatingText() {} });
const gas = load('gas', { ...tiles, ...effects });
const { actionCost } = load('timing');
const dungeon = load('dungeon', { tiles, ...effects, sfx: { step() {} } }).default;
const manager = load('turnManager', { dungeon, ...effects }).default;
const map = Array.from({ length: 7 }, () => Array(7).fill(0));
function setup() {
  tiles.clearAllFeatures(); dungeon.currentLevel = map.map(row => [...row]);
  const ctx = { entities: [], messages: [], visibleTiles: new Set(['2,2']), simulationTime: 0.5 };
  ctx.onCreatePoisonGas = (x, y) => gas.createPoisonGas(ctx, dungeon.currentLevel, x, y);
  ctx.onGasContact = actor => gas.exposeToGas(ctx, actor);
  ctx.nextTerrainEvent = () => gas.nextGasEvent(ctx);
  ctx.onTerrainEvent = () => gas.tickGas(ctx);
  dungeon.context = ctx;
  return ctx;
}
function actor(ctx, x, y, type = 'enemy', hp = 20) {
  const e = { context: ctx, x, y, type, name: type, healthPoints: hp, effects: [],
    movementSpeed: 1, attackDelay: 1, nextActionTime: 0.5, actionReady: false,
    takeDamage(n) { this.healthPoints -= n; }, refresh() {},
    tickEffects() {
      effects.tickEffects(this, ctx);
      if (this.healthPoints <= 0) ctx.entities.splice(ctx.entities.indexOf(this), 1);
    },
    spendTime(action) { this.nextActionTime += actionCost(this, action); this.actionReady = false; },
    turn() { if (type !== 'player') this.spendTime('wait'); }
  };
  ctx.entities.push(e); return e;
}
{
  const ctx = setup();
  const target = actor(ctx, 2, 2), flyer = actor(ctx, 3, 2);
  flyer.effects.push({ id: 'levitating', duration: 10, manualExpiry: true });
  const item = actor(ctx, 2, 3, 'item'), corpse = actor(ctx, 2, 3, 'enemy', 0);
  tiles.setFeature(2, 2, 'water'); tiles.setFeature(3, 2, 'grass');
  tiles.setFeature(1, 2, 'door', { door: 'closed' }); dungeon.currentLevel[1][2] = 1;
  assert.equal(ctx.onCreatePoisonGas(2, 2), 3);
  assert.equal(tiles.getFeature(2, 2), 'water'); assert.equal(tiles.getFeature(3, 2), 'grass');
  assert.equal(effects.hasEffect(target, 'poisoned'), true);
  assert.equal(effects.hasEffect(flyer, 'poisoned'), true);
  assert.equal(effects.hasEffect(item, 'poisoned'), false); assert.equal(corpse.effects.length, 0);
  assert.ok(!ctx.poisonClouds.some(c => c.x === 3 && c.y === 3), 'no diagonal gas');
  assert.match(dungeon.inspectTile(2, 2), /Poison gas/);
  assert.equal(ctx.onCreatePoisonGas(1, 2), 0, 'closed-door impact cannot leak gas through it');
  const phase = target.effects[0].nextTick;
  for (let n = 0; n < 5; n++) { ctx.simulationTime += 0.1; ctx.onGasContact(target); }
  assert.equal(target.effects[0].nextTick, phase, 'fast movement cannot defer poison damage');
  ctx.simulationTime = 1.5;
  target.tickEffects(); gas.tickGas(ctx);
  assert.equal(target.healthPoints, 19);
  assert.equal(target.effects[0].duration, 2, 'pulse sustains poison after damage tick');
  const cloudPhase = ctx.poisonClouds[0].nextTick;
  ctx.simulationTime = 2;
  ctx.onCreatePoisonGas(2, 2);
  assert.equal(ctx.poisonClouds.length, 3, 'overlap merges cells');
  assert.equal(ctx.poisonClouds[0].nextTick, cloudPhase);
  assert.equal(ctx.poisonClouds[0].expiresAt, 6);
  const snapshot = ctx.poisonClouds.map(c => ({ ...c }));
  const restored = gas.restoreGas(snapshot, 20);
  assert.equal(restored[0].expiresAt, 26);
  assert.equal(restored[0].nextTick, cloudPhase + 20);
  restored[0].expiresAt++;
  assert.equal(snapshot[0].expiresAt, 6, 'restoration never mutates saved data');
  ctx.simulationTime = 6; gas.tickGas(ctx);
  assert.equal(ctx.poisonClouds.length, 0);
  assert.equal(gas.nextGasEvent(ctx), Infinity);
  assert.doesNotMatch(dungeon.inspectTile(2, 2), /Poison gas/);
}
// Real scheduler: fractional events, idle frames, standing exposure and expiry.
for (const speed of [0.5, 1, 2]) {
  const ctx = setup();
  const player = actor(ctx, 0, 0, 'player');
  const victim = actor(ctx, 2, 2); victim.movementSpeed = speed;
  victim.turn = () => victim.spendTime('move');
  ctx.onCreatePoisonGas(2, 2);
  manager.time = 0.5; manager.nextTick = 1; manager.reset(ctx.entities, true);
  for (let frame = 0; frame < 100; frame++) manager.update(ctx.entities);
  assert.equal(ctx.simulationTime, 0.5); assert.equal(victim.healthPoints, 20);
  for (let n = 0; n < 4; n++) { player.spendTime('wait'); manager.update(ctx.entities); }
  assert.equal(ctx.simulationTime, 4.5);
  assert.equal(ctx.poisonClouds.length, 0, 'expires exactly four world-time units after creation');
  assert.equal(victim.healthPoints, 16);
  player.spendTime('wait'); manager.update(ctx.entities);
  assert.equal(victim.healthPoints, 15, 'poison briefly lingers after leaving/expiry');
  assert.equal(effects.hasEffect(victim, 'poisoned'), false);
}
// Poison deaths are resolved by the normal effect lifecycle, not the cloud callback.
for (const type of ['enemy', 'player']) {
  const ctx = setup();
  const player = actor(ctx, type === 'player' ? 2 : 0, type === 'player' ? 2 : 0, 'player', type === 'player' ? 1 : 20);
  const victim = type === 'player' ? player : actor(ctx, 2, 2, 'enemy', 1);
  ctx.onCreatePoisonGas(2, 2);
  manager.time = 0.5; manager.nextTick = 1; manager.reset(ctx.entities, true);
  player.spendTime('wait'); manager.update(ctx.entities);
  assert.equal(victim.healthPoints, 0);
  assert.equal(ctx.entities.includes(victim), false);
}
// Real movement hook, including the offscreen enemy fast path.
{
  const ctx = setup(); ctx.onCreatePoisonGas(2, 2);
  const walker = actor(ctx, 0, 2);
  ctx.map = { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 };
  ctx.scene = { tweens: { add() {} } };
  dungeon.moveEntityTo(ctx, walker, 1, 2);
  assert.equal(effects.hasEffect(walker, 'poisoned'), true);
  const entrant = actor(ctx, 0, 3, 'player');
  dungeon.moveEntityTo(ctx, entrant, 2, 3);
  assert.equal(effects.hasEffect(entrant, 'poisoned'), true, 'hero contact also exposes');
}
// Real potion and throw handlers create clouds and consume empty-tile splashes.
{
  const ctx = setup(); const player = actor(ctx, 2, 2, 'player'); ctx.player = player;
  player.removeItem = () => {};
  const { Entity } = load('entity');
  const removeEntity = (context, item) => { context.entities = context.entities.filter(e => e !== item); };
  const Potion = load('items/PotionOfToxicGas', { Entity, removeEntity, ...effects }).default;
  const potion = Object.assign(Object.create(Potion.prototype), { context: ctx });
  potion.equip(); assert.equal(ctx.poisonClouds.length, 5);
  const Hero = load('classes/basicHero', { Entity, removeEntity, dungeon, ...effects }).default;
  const thrower = Object.assign(Object.create(Hero.prototype), { context: ctx });
  thrower.placeItemOnGround = () => assert.fail('gas potion should shatter');
  const thrown = { name: 'Potion of Toxic Gas', consumable: true, type: 'item' };
  ctx.entities.push(thrown); thrower.resolveThrowLanding(thrown, 5, 5);
  assert.equal(ctx.entities.includes(thrown), false);
  assert.ok(ctx.poisonClouds.some(c => c.x === 5 && c.y === 5));
}
console.log('Rogue0 gas geometry, exposure, fractional scheduling, expiry, movement, persistence and potion integration passed');
