import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('fire-potion-telegraph');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TurnManager } from '../src/games/rogue0/turnManager.ts';
import { holdTargetTelegraph, clearTargetTelegraphs, TARGET_WARNING_HOLD_MS } from '../src/games/rogue0/targetTelegraphVisuals.ts';
import { encodeGraph, decodeGraph } from '../src/games/rogue0/saveCodec.ts';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';

const { actionCost } = load('src/games/rogue0/timing.ts');
const { Entity } = load('src/games/rogue0/entity.ts', { actionCost });
Entity.prototype.init = function (context, x, y) {
  Object.assign(this, { context, x, y, effects: [], nextActionTime: 0, actionReady: false });
};

const hasEffect = (entity, id) => entity.effects.some(effect => effect.id === id);
const removeEffect = (entity, id) => {
  entity.effects = entity.effects.filter(effect => effect.id !== id);
};
const map = Array.from({ length: 20 }, () => Array(20).fill(0));
const dungeon = { getCurrentLevel: () => map, log() {} };
let meleeTurns = 0;
const Monster = load('src/games/rogue0/monsters/monster.ts', {
  Entity,
  Phaser: { Math: { Between: () => 0 } },
  Gold: class {}, actorOrigin: () => ({ x: 0.5, y: 1 }),
  dungeon, playMonsterDeath: () => false, announceDeath() {},
  rollEquipmentGlyph() {}, stashChasmFallen: () => false,
  bodyDistance: () => 9, TILE_FOOTPRINT: { width: 1, height: 1 },
  resolveFootprint: () => ({ width: 1, height: 1 }),
  enemyTurn() { meleeTurns++; }, enemyCanSeePlayer: () => true,
  hasEffect, createBleedingEffect: () => ({ id: 'bleeding', duration: 2 })
}).default;

let canSee = true;
let attackOptions = [];
let applied = [];
let splash = [];
let fuseCalls = [];
const Thrower = load('src/games/rogue0/monsters/firePotionThrower.ts', {
  Monster,
  monsterStats: () => ({ healthPoints: 30, attackDamage: 8, meleeDamage: 4 }),
  MONSTER_XP: { firePotionThrower: 9 },
  tiles: { getFeature: () => 'grass', clearFeature() {} },
  tryFuseWands: (context, x, y) => { fuseCalls.push({ x, y }); return undefined; },
  dungeon: { getCurrentLevel: () => map, log: (context, text) => context.messages.unshift(text) },
  resolveAttack: (_context, _attacker, _victim, options) => {
    attackOptions.push(options);
    return { hit: true, damage: 6, crit: false, damageType: 'fire', appliedEffects: options.onHitEffects };
  },
  applyAttackResult: (context, _attacker, victim, result, hooks) => {
    applied.push(result);
    victim.takeDamage(result.damage);
    for (const effect of result.appliedEffects) hooks.applyEffect(victim, effect);
  },
  applyEffect: (entity, effect) => entity.effects.push(effect),
  createBurningEffect: duration => ({ id: 'burning', duration }),
  removeEffect, removeEntity() {},
  enemyCanSeePlayer: () => canSee,
  isEnemyVisible: () => true,
  actorFootprint: () => ({ width: 1, height: 1 }),
  footprintContains: (_fp, x, y, tx, ty) => x === tx && y === ty,
  FIRE_POTION_THROWER_TEXTURE: 'fire-potion-thrower',
  generateFirePotionThrowerTexture() {}
}).default;

function setup() {
  const context = { floor: 10, entities: [], messages: [], simulationTime: 0,
    visibleTiles: new Set(), onPotionSplash: event => { splash.push(event); } };
  const player = new Entity();
  Object.assign(player, { context, type: 'player', healthPoints: 30, x: 10, y: 10,
    takeDamage(amount) { this.healthPoints -= amount; },
    refresh() {}, tickEffects() {}, turn() {} });
  context.player = player;
  const thrower = new Thrower(context, 13, 10);
  thrower.wakeUp();
  let turns = 0;
  const original = thrower.turn.bind(thrower);
  thrower.turn = () => { turns++; original(); };
  context.entities = [player, thrower];
  const manager = new TurnManager({ log: dungeon.log, hasEffect, removeEffect });
  manager.reset(context.entities);
  const update = manager.update.bind(manager);
  manager.update = () => update(context.entities);
  return { context, player, thrower, manager, turns: () => turns };
}

// --- Three own turns, not world-time ticks ----------------------------------
{
  const { context, player, thrower, manager, turns } = setup();
  // The scheduler stops on a player who spends no time, so idle frames and
  // upkeep cannot advance the windup.
  manager.update();
  manager.update();
  assert.equal(turns(), 0);
  assert.equal(thrower.telegraphStage, 0);

  thrower.turn();
  assert.equal(turns(), 1);
  assert.equal(thrower.telegraphStage, 1);
  assert.deepEqual({ x: thrower.targetX, y: thrower.targetY }, { x: player.x, y: player.y });

  thrower.refresh();
  thrower.tickEffects?.();
  assert.equal(thrower.telegraphStage, 1, 'world-time upkeep does not advance the telegraph');
  thrower.turn();
  assert.equal(turns(), 2);
  assert.equal(thrower.telegraphStage, 2);

  thrower.turn();
  assert.equal(turns(), 3);
  assert.equal(thrower.telegraphStage, 0, 'the third turn fires and resets');
  assert.equal(player.healthPoints, 24, 'the hero takes fire damage');
  assert.ok(hasEffect(player, 'burning'), 'liquid flame applies burning');
  assert.equal(attackOptions.at(-1).damageType, 'fire', 'fire resistance applies, armor does not');
  assert.equal(attackOptions.at(-1).onHitEffects[0].duration, 12);
  assert.equal(splash.at(-1).kind, 'fire');
  assert.equal(splash.at(-1).cells.length, 9, 'centre plus eight neighbours');

  // A cooldown in the monster's own turns prevents back-to-back bursts.
  assert.equal(thrower.abilityCooldown, 4);
  const aiTurns = meleeTurns;
  const bursts = splash.length;
  for (const remaining of [3, 2, 1]) {
    const timeBefore = thrower.nextActionTime;
    thrower.turn();
    assert.equal(thrower.abilityCooldown, remaining);
    assert.equal(thrower.telegraphStage, 0, 'three full turns pass before another windup');
    assert.equal(player.healthPoints, 24);
    assert.equal(meleeTurns, aiTurns, 'cooldown waits instead of using ordinary ranged AI');
    assert.equal(splash.length, bursts);
    assert.ok(thrower.nextActionTime > timeBefore, 'each recovery turn spends an action');
  }
  thrower.turn();
  assert.equal(thrower.abilityCooldown, 0);
  assert.equal(thrower.telegraphStage, 1, 'the fourth turn after a burst starts the next windup');
  thrower.turn();
  assert.equal(thrower.telegraphStage, 2);
  assert.equal(splash.length, bursts, 'the next burst still needs the full warning sequence');
  thrower.turn();
  assert.equal(splash.length, bursts + 1);
  assert.equal(thrower.abilityCooldown, 4);
}

// --- Render boundaries must preserve the single-tile warning -----------------
{
  const { context, player, thrower, manager } = setup();
  thrower.refresh = () => {};
  thrower.tickEffects = () => {};
  const presented = [];
  const animations = [];
  const scene = { tweens: { addCounter(config) {
    const tween = { ...config, stopped: false, stop() { this.stopped = true; } };
    animations.push(tween);
    return tween;
  } } };
  context.onFirePotionTelegraph = entity => {
    presented.push(entity.telegraphStage);
    holdTargetTelegraph(scene, entity);
  };
  // Under-strength armor can make a step cost more than one enemy action.
  player.movementCostMultiplier = () => 1.2;
  player.x = 9;
  player.spendTime('move');
  manager.update();
  assert.equal(thrower.telegraphStage, 1,
    'a slow move must not consume both warning stages before the first render');
  assert.deepEqual(presented, [1]);
  assert.equal(thrower.targetX, 9);
  const time = manager.time;
  manager.update();
  assert.equal(manager.time, time, 'render frames do not advance a pending warning');
  assert.equal(animations.at(-1).duration, TARGET_WARNING_HOLD_MS);
  animations.at(-1).onComplete(); // warning has been displayed
  manager.update();
  assert.equal(thrower.telegraphStage, 2);
  assert.deepEqual(presented, [1, 2]);
  animations.at(-1).onComplete();
  manager.update();
  assert.equal(player.actionReady, true);

  // Keep walking with buffered input through the burst/recovery and next aim.
  // An enemy warning must render BEFORE the next buffered move is consumed.
  player.movementCostMultiplier = () => 1;
  player.turn = () => {
    player.x = player.x === 9 ? 10 : 9;
    player.spendTime('move');
    player.moving = true;
  };
  for (let frame = 0; frame < 20 && presented.length < 3; frame++) {
    player.moving = false; // complete the previous walking animation
    manager.update();
  }
  assert.deepEqual(presented, [1, 2, 1], 'the second attack presents its centre warning too');
  assert.equal(player.moving, false, 'queued movement cannot run ahead of the new warning');
  assert.equal(thrower.targetX, player.x, 'the first border is still on the hero when presented');
  const heldTime = manager.time;
  manager.update();
  assert.equal(manager.time, heldTime);
  clearTargetTelegraphs(scene);
  assert.equal(thrower.moving, false, 'floor/scene teardown releases the presentation hold');
  assert.equal(animations.at(-1).stopped, true, 'teardown cancels the pending tween');
}

// --- Dodge and sight gates ---------------------------------------------------
{
  const { player, thrower } = setup();
  thrower.turn(); // stage 1 marks the hero's tile
  player.y = 15; // leave the fixed 3x3 before the burst lands
  thrower.turn(); // stage 2
  thrower.turn(); // burst on the old tiles
  assert.equal(player.healthPoints, 30, 'stepping out of the marked tiles avoids the blast');
}

// --- Melee fallback when adjacent --------------------------------------------
{
  const { player, thrower } = setup();
  player.x = 14; // cardinal adjacency, thrower at 13,10
  const before = meleeTurns;
  const attacks = attackOptions.length;
  thrower.turn();
  assert.equal(meleeTurns, before + 1, 'an adjacent hero triggers the melee AI turn');
  assert.equal(thrower.telegraphStage, 0, 'no flask is readied at touching distance');
  assert.equal(attackOptions.length, attacks, 'no fire burst is resolved');
  player.y = 11; // diagonal adjacency counts too, after attack recovery
  thrower.turn();
  assert.equal(meleeTurns, before + 1, 'the turn after a melee attack is spent recovering');
  thrower.turn();
  assert.equal(meleeTurns, before + 2);
  assert.equal(thrower.telegraphStage, 0);
}
{
  const { player, thrower } = setup();
  thrower.turn(); // stage 1 with the hero three tiles away
  assert.equal(thrower.telegraphStage, 1);
  player.x = 14; // close in during the windup
  const before = meleeTurns;
  const bursts = splash.length;
  thrower.turn();
  assert.equal(thrower.telegraphStage, 0, 'closing to melee cancels the windup');
  assert.equal(thrower.targetX, -1);
  assert.equal(meleeTurns, before + 1);
  assert.equal(splash.length, bursts, 'the cancelled flasks never burst');
  assert.equal(player.healthPoints, 30);
}
{
  const { thrower } = setup();
  thrower.sleepTurnsRemaining = 5;
  thrower.awareOfPlayer = false;
  thrower.turn();
  assert.equal(thrower.telegraphStage, 0, 'sleeping throwers do not telegraph');
}
{
  const { thrower } = setup();
  canSee = false;
  thrower.turn();
  assert.equal(thrower.telegraphStage, 0, 'no sight, no telegraph');
  canSee = true;
}

// --- Saved telegraph fields --------------------------------------------------
{
  const { thrower } = setup();
  thrower.telegraphStage = 2;
  thrower.targetX = 5;
  thrower.targetY = 7;
  thrower.abilityCooldown = 1;
  const graph = encodeGraph({ thrower }, { Thrower: Thrower });
  const decoded = decodeGraph(graph, { Thrower: Thrower });
  assert.equal(decoded.thrower.telegraphStage, 2);
  assert.equal(decoded.thrower.targetX, 5);
  assert.equal(decoded.thrower.targetY, 7);
  assert.equal(decoded.thrower.abilityCooldown, 1);
}

// --- The burst can fuse floor wands to the right -------------------------------
{
  const { context, thrower } = setup();
  fuseCalls = [];
  thrower.turn();
  thrower.turn();
  thrower.turn(); // burst
  assert.ok(fuseCalls.length > 0, 'the burst calls tryFuseWands');
  assert.ok(fuseCalls.some(c => c.x === context.player.x && c.y === context.player.y),
    'the burst cell itself is tried');
}

// --- Grass in the burst catches fire ------------------------------------------
{
  const { context, thrower } = setup();
  const burned = [];
  context.onGrassBurn = cells => burned.push(...cells);
  thrower.turn();
  thrower.turn();
  thrower.turn(); // burst
  assert.equal(burned.length, 9, 'grass in the 3x3 catches fire');
}

// --- Thrown flask visual -----------------------------------------------------
{
  const { context, thrower } = setup();
  const thrown = [];
  context.onFirePotionThrown = event => thrown.push(event);
  thrower.turn(); // stage 1
  assert.equal(thrown.length, 0, 'no visual yet during the telegraph');
  thrower.turn(); // stage 2
  assert.equal(thrown.length, 0, 'still no visual as the borders snap');
  thrower.turn(); // burst
  assert.equal(thrown.length, 1, 'the throw is announced on the third turn');
  assert.deepEqual(thrown[0].from, { x: thrower.x, y: thrower.y });
  assert.deepEqual(thrown[0].to, { x: context.player.x, y: context.player.y });
}
{
  // Closing to melee abandons the telegraph before it starts: no throw shown.
  const { context, player, thrower } = setup();
  const thrown = [];
  context.onFirePotionThrown = event => thrown.push(event);
  player.x = 14;
  thrower.turn();
  assert.equal(thrown.length, 0);
  assert.equal(thrower.telegraphStage, 0);
}

// --- Wiring ------------------------------------------------------------------
const scene = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
assert.match(scene, /spawnGroup\(FirePotionThrower, firePotionThrowerCount\)/);
assert.match(scene, /generateFirePotionThrowerTexture\(this\)/);
assert.match(scene, /context\.onFirePotionThrown = /, 'scene0 wires the throw visual');
assert.match(scene, /context\.onFirePotionTelegraph = entity => holdTargetTelegraph\(this, entity\)/,
  'scene0 wires the warning presentation barrier');
const registry = fs.readFileSync('src/games/rogue0/saveRegistry.ts', 'utf8');
assert.match(registry, /'monster:fire-potion-thrower': FirePotionThrower/);
const source = fs.readFileSync('src/games/rogue0/monsters/firePotionThrower.ts', 'utf8');
assert.match(source, /telegraphStage === 2[\s\S]*this\.burst\(\)/);
assert.match(source, /spendTime\('attack'\)/, 'every telegraph step spends a scheduled action');

console.log('Fire Potion Thrower: three-turn telegraph, dodge, sight, save fields and wiring passed');
