import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('scheduler');
import assert from 'node:assert/strict';
import { TurnManager } from '../src/games/rogue0/turnManager.ts';
import { createGameContext } from '../src/games/rogue0/context.ts';
import { actionCost } from '../src/games/rogue0/timing.ts';

// Complete production modules, no source stripping or Phaser runtime. Actors
// provide the scheduler contract; effects/logging are explicit boundary fakes.
function fixture(withEnemy = true) {
  const context = createGameContext();
  const events = [];
  const manager = new TurnManager({
    hasEffect: (entity, id) => entity.effects.some(effect => effect.id === id),
    removeEffect(entity, id) { entity.effects = entity.effects.filter(effect => effect.id !== id); },
    log(ctx, message) { assert.equal(ctx, context); ctx.messages.unshift(message); },
  });
  function actor(type, name) {
    return {
      type, name, context, healthPoints: 10, effects: [], moving: false,
      movementSpeed: 1, attackDelay: 1, nextActionTime: 0, actionReady: false,
      turns: 0, upkeep: 0, items: [],
      getAllItems() { return this.items; },
      refresh() { this.upkeep++; events.push(['upkeep', name, context.simulationTime]); },
      tickEffects() {
        for (const effect of this.effects) {
          if (effect.manualExpiry && !effect.tick) continue;
          if (effect.nextTick <= context.simulationTime + 1e-9) {
            events.push(['effect', name, context.simulationTime]);
            effect.nextTick += 1;
          }
        }
      },
      spendTime(action) { this.nextActionTime += actionCost(this, action); this.actionReady = false; },
      turn() {
        events.push(['turn', name, context.simulationTime]);
        this.turns++;
        if (type !== 'player') this.spendTime('wait');
      },
    };
  }
  const player = actor('player', 'hero');
  const enemy = actor('enemy', 'monster');
  context.player = player;
  context.entities = withEnemy ? [player, enemy] : [player];
  manager.reset(context.entities);
  const update = () => manager.update(context.entities);
  const act = action => { player.spendTime(action); update(); };
  return { context, manager, player, enemy, events, actor, update, act };
}

// Interleave two timelines and service sets. Reset/floor travel in one run must
// not touch the other's clock, next upkeep tick, membership, readiness or logs.
{
  const a = fixture(), b = fixture();
  assert.notEqual(a.manager.known, b.manager.known);
  a.player.movementSpeed = 2;
  a.act('move');
  b.act('wait'); b.act('wait');
  assert.deepEqual([a.manager.time, a.manager.nextTick, a.context.simulationTime, a.player.upkeep], [0.5, 1, 0.5, 0]);
  assert.deepEqual([b.manager.time, b.manager.nextTick, b.context.simulationTime, b.player.upkeep], [2, 3, 2, 2]);
  a.act('move');
  assert.equal(a.manager.time, 1);
  assert.equal(a.enemy.turns, 1, 'player wins equal-time ties');
  assert.equal(b.enemy.turns, 2);
  const bKnown = [...b.manager.known];
  const bEvents = [...b.events];
  a.player.effects.push({ id: 'frozen', manualExpiry: true });
  a.update();
  assert.equal(a.manager.time, 2, 'frozen skips one action on its own timeline');
  assert.equal(a.player.freezeRecovery, true);
  assert.equal(a.player.effects.length, 0);
  assert.match(a.context.messages[0], /You are frozen and miss an action/);
  assert.deepEqual(b.context.messages, []);
  const arrival = a.actor('enemy', 'arrival');
  a.context.entities = [a.player, arrival];
  a.manager.reset(a.context.entities, true);
  assert.deepEqual([a.manager.time, a.manager.nextTick, arrival.nextActionTime], [2, 3, 2]);
  assert.deepEqual([...a.manager.known], [a.player, arrival]);
  assert.equal(a.player.actionReady, true);
  assert.equal(arrival.actionReady, false);
  a.manager.reset(a.context.entities);
  assert.deepEqual([a.manager.time, a.manager.nextTick, a.context.simulationTime], [0, 1, 0]);
  assert.deepEqual([b.manager.time, b.manager.nextTick, b.player.nextActionTime, b.player.actionReady], [2, 3, 2, true]);
  assert.deepEqual([...b.manager.known], bKnown);
  assert.deepEqual(b.events, bEvents);
}

// The restore protocol installs the saved clock before resetting membership,
// then reinstates exact actor deadlines/readiness. Fractional times survive.
{
  const run = fixture();
  const { manager, player, enemy, context } = run;
  const saved = { time: 8.375, nextTick: 9, deadlines: [
    [player, 8.375, true], [enemy, 8.75, false],
  ] };
  manager.time = saved.time;
  manager.nextTick = saved.nextTick;
  manager.reset(context.entities, true);
  for (const [actor, time, ready] of saved.deadlines) {
    actor.nextActionTime = time; actor.actionReady = ready;
  }
  run.update();
  assert.deepEqual([manager.time, manager.nextTick, context.simulationTime, enemy.nextActionTime], [8.375, 9, 8.375, 8.75]);
  assert.equal(enemy.turns, 0);
  player.movementSpeed = 2;
  run.act('move');
  assert.equal(manager.time, 8.875);
  assert.equal(enemy.turns, 1);
  assert.equal(player.upkeep, 0, 'resume does not round fractional time up to an upkeep tick');
  const newcomer = run.actor('enemy', 'reinforcement');
  context.entities = [player, newcomer];
  run.update();
  assert.equal(newcomer.nextActionTime, 8.875, 'late arrivals cannot act in the past');
  assert.equal(manager.known.has(enemy), false, 'departed floor actors leave membership');
  run.act('move');
  assert.equal(player.upkeep, 1);
  assert.equal(newcomer.turns, 1);
  assert.equal(enemy.turns, 1, 'departed actors do not receive more turns');
}

// Fractional terrain/effect events keep their phases relative to integer
// upkeep. Carried items tick once despite shared inventory/quickslot identity.
{
  const run = fixture(false);
  const { context, player, events } = run;
  let terrainAt = 0.25;
  context.nextTerrainEvent = () => terrainAt;
  context.onTerrainEvent = () => { events.push(['terrain', 'cloud', context.simulationTime]); terrainAt = Infinity; };
  player.effects.push({ id: 'poison', nextTick: 0.5 });
  player.effects.push({ id: 'manual', manualExpiry: true, nextTick: 0.1 });
  const wand = run.actor('item', 'wand');
  const groundItem = run.actor('item', 'ground');
  player.items = [wand, wand];
  context.entities.push(wand, groundItem);
  player.attackDelay = 1.25;
  run.act('attack');
  assert.deepEqual(events, [
    ['terrain', 'cloud', 0.25], ['effect', 'hero', 0.5],
    ['upkeep', 'hero', 1], ['upkeep', 'wand', 1], ['turn', 'hero', 1.25],
  ]);
  assert.equal(groundItem.upkeep, 0);
  assert.equal(wand.turns, 0);
  assert.equal(player.effects[0].nextTick, 1.5);
}

// Input waits, animations, a pending fall, and a dead/absent hero are not
// opportunities to advance the clock or run effects/terrain in the background.
{
  const run = fixture();
  for (let i = 0; i < 20; i++) run.update();
  assert.equal(run.manager.time, 0);
  assert.equal(run.enemy.turns, 0);
  run.player.spendTime('wait');
  run.enemy.moving = true;
  run.update();
  assert.equal(run.manager.time, 0);
  run.enemy.moving = false;
  run.context.pendingFall = {};
  run.update();
  assert.equal(run.manager.time, 0);
  run.context.pendingFall = undefined;
  run.player.healthPoints = 0;
  run.update();
  assert.equal(run.manager.time, 0);
  run.player.healthPoints = 10;
  run.update();
  assert.equal(run.manager.time, 1);
  const time = run.manager.time;
  run.context.entities = [run.enemy];
  run.update();
  assert.equal(run.manager.time, time);
}

// An auto-acting player cannot monopolize the render thread: the event budget
// yields and the next update continues the same timeline, not a reset clock.
{
  const run = fixture(false);
  run.player.turn = function () { this.turns++; this.spendTime('wait'); };
  run.update();
  assert.equal(run.player.turns, 128);
  assert.equal(run.manager.time, 128);
  run.update();
  assert.equal(run.player.turns, 256);
  assert.equal(run.manager.time, 256);
}
console.log('Rogue0 scheduler: independent runs, reset/restore deadlines, actor membership, phased events, upkeep, pauses and bounded updates passed');
