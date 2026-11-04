import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('gas');
import assert from 'node:assert/strict';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';
const load = (name, bindings) => loadLogic(`src/games/rogue0/${name}.ts`, bindings);
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
  ctx.currentLevel = dungeon.currentLevel;
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
function cloudAt(ctx, x, y) {
  return ctx.poisonClouds?.find(c => c.x === x && c.y === y);
}
{
  const ctx = setup();
  const target = actor(ctx, 2, 2), flyer = actor(ctx, 3, 2);
  flyer.effects.push({ id: 'levitating', duration: 10, manualExpiry: true });
  const item = actor(ctx, 2, 3, 'item'), corpse = actor(ctx, 2, 3, 'enemy', 0);
  tiles.setFeature(2, 2, 'water'); tiles.setFeature(3, 2, 'grass');
  tiles.setFeature(1, 2, 'door', { door: 'closed' }); dungeon.currentLevel[1][2] = 1; // wall at (2,1)

  assert.equal(ctx.onCreatePoisonGas(2, 2), 1);
  assert.equal(tiles.getFeature(2, 2), 'water'); assert.equal(tiles.getFeature(3, 2), 'grass');
  assert.equal(effects.hasEffect(target, 'poisoned'), true);
  assert.equal(effects.hasEffect(flyer, 'poisoned'), false, 'only the impact tile is covered at first');
  assert.equal(effects.hasEffect(item, 'poisoned'), false); assert.equal(corpse.effects.length, 0);
  assert.equal(ctx.poisonClouds.length, 1);
  assert.ok(cloudAt(ctx, 2, 2), 'impact tile is the seed cloud');
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
  assert.equal(effects.hasEffect(flyer, 'poisoned'), true, 'expansion covers the open cardinal neighbor');
  assert.equal(ctx.poisonClouds.length, 3, 'first expansion adds the two open neighbors');
  assert.ok(cloudAt(ctx, 3, 2), 'grass does not block gas');
  assert.ok(cloudAt(ctx, 2, 3), 'open floor neighbor is covered');
  assert.ok(!ctx.poisonClouds.some(c => c.x === 3 && c.y === 3), 'expansion still has no diagonal gas');
  assert.ok(!cloudAt(ctx, 1, 2), 'closed door blocks expansion');
  assert.ok(!cloudAt(ctx, 2, 1), 'wall blocks expansion');

  const center = cloudAt(ctx, 2, 2);
  const cloudPhase = center.nextTick;
  ctx.simulationTime = 2;
  ctx.onCreatePoisonGas(2, 2);
  assert.equal(ctx.poisonClouds.length, 3, 'overlap merges the impact cell rather than duplicating');
  assert.equal(center.nextTick, cloudPhase, 're-splash never postpones the pulse phase');
  assert.equal(center.expiresAt, 10, 're-splash extends the center lifetime');

  const snapshot = ctx.poisonClouds.map(c => ({ ...c }));
  const restored = gas.restoreGas(snapshot, 20);
  const rc = restored.find(c => c.x === 2 && c.y === 2);
  assert.equal(rc.expiresAt, 30);
  assert.equal(rc.nextTick, cloudPhase + 20);
  assert.equal(rc.nextExpand, Infinity);
  assert.equal(rc.bornAt, 20.5, 'restoration shifts the birth clock');
  snapshot[0].expiresAt++;
  assert.equal(center.expiresAt, 10, 'restoration never mutates saved data');

  const legacy = gas.restoreGas([{ x: 1, y: 1, nextTick: 1.5, expiresAt: 4.5 }], 20);
  assert.deepEqual(Object.keys(legacy[0]).sort(), ['expiresAt', 'nextTick', 'x', 'y'],
    'legacy clouds do not gain expansion keys on restore');
  assert.equal(legacy[0].expiresAt, 24.5);
  assert.equal(legacy[0].nextTick, 21.5);
}
// Expansion reaches a bounded large area, then dissipates from the outer ring in.
{
  const ctx = setup();
  ctx.onCreatePoisonGas(2, 2);
  // On this 7x7 map the radius-3 diamond clips at the top and left edges.
  const steps = [
    [0.5, 1], [1.5, 5], [2.5, 13], [3.5, 23], [4.5, 23],
    [5.5, 13], [6.5, 5], [7.5, 1], [8.5, 0]
  ];
  for (const [time, count] of steps) {
    ctx.simulationTime = time;
    gas.tickGas(ctx);
    assert.equal(ctx.poisonClouds.length, count, `cloud size at t=${time}`);
  }
  assert.equal(gas.nextGasEvent(ctx), Infinity);
  assert.doesNotMatch(dungeon.inspectTile(2, 2), /Poison gas/);

  const ctx2 = setup();
  ctx2.onCreatePoisonGas(2, 2);
  for (const time of [1.5, 2.5, 3.5]) { ctx2.simulationTime = time; gas.tickGas(ctx2); }
  ctx2.simulationTime = 5.5; gas.tickGas(ctx2);
  assert.equal(ctx2.poisonClouds.length, 13);
  assert.ok(!cloudAt(ctx2, 5, 2), 'outer ring dissipates first');
  assert.ok(cloudAt(ctx2, 0, 2), 'middle ring is still present');
  ctx2.simulationTime = 7.5; gas.tickGas(ctx2);
  assert.equal(ctx2.poisonClouds.length, 1);
  assert.ok(cloudAt(ctx2, 2, 2), 'impact tile lingers last');
}
// Real scheduler: fractional events, idle frames, standing exposure and expiry.
{
  const ctx = setup();
  const player = actor(ctx, 0, 0, 'player');
  const victim = actor(ctx, 2, 2);
  ctx.onCreatePoisonGas(2, 2);
  manager.time = 0.5; manager.nextTick = 1; manager.reset(ctx.entities, true);
  for (let frame = 0; frame < 100; frame++) manager.update(ctx.entities);
  assert.equal(ctx.simulationTime, 0.5); assert.equal(victim.healthPoints, 20);
  for (let n = 0; n < 4; n++) { player.spendTime('wait'); manager.update(ctx.entities); }
  assert.equal(ctx.simulationTime, 4.5);
  assert.equal(ctx.poisonClouds.length, 23, 'cloud is fully expanded after four waits');
  assert.equal(victim.healthPoints, 16, 'standing in the seed cell pulses once per unit');
  for (let n = 0; n < 4; n++) { player.spendTime('wait'); manager.update(ctx.entities); }
  assert.equal(ctx.simulationTime, 8.5);
  assert.equal(ctx.poisonClouds.length, 0, 'center dissipates exactly when its lifetime ends');
  assert.equal(victim.healthPoints, 12);
  assert.equal(effects.hasEffect(victim, 'poisoned'), true, 'poison briefly lingers after the cloud leaves');
  player.spendTime('wait'); manager.update(ctx.entities);
  assert.equal(victim.healthPoints, 11, 'lingering poison resolves once and then wears off');
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
  ctx.simulationTime = 1.5; gas.tickGas(ctx);
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
  potion.equip(); assert.equal(ctx.poisonClouds.length, 1);
  const Hero = load('classes/basicHero', { Entity, removeEntity, dungeon, ...effects, getFeature: tiles.getFeature }).default;
  const thrower = Object.assign(Object.create(Hero.prototype), { context: ctx });
  thrower.placeItemOnGround = () => assert.fail('gas potion should shatter');
  const thrown = { name: 'Potion of Toxic Gas', consumable: true, type: 'item' };
  ctx.entities.push(thrown); thrower.resolveThrowLanding(thrown, 5, 5);
  assert.equal(ctx.entities.includes(thrown), false);
  assert.ok(cloudAt(ctx, 5, 5), 'throwing a gas potion seeds a cloud at the impact tile');
}
console.log('Rogue0 gas expansion, exposure, fractional scheduling, dissipation, movement, persistence and potion integration passed');
