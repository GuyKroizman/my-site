import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('unseen-combat');
import assert from 'node:assert/strict';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';
import {
  announceDeath, announceHit, announceMiss, isEnemyVisible,
  UNSEEN_DEATH, UNSEEN_IMPACT, UNSEEN_KILL, UNSEEN_MISS, UNSEEN_PAIN,
} from '../src/games/rogue0/combatFeedback.ts';
import { terrainFor } from '../src/games/rogue0/terrain.ts';

const load = (name, bindings) => loadLogic(`src/games/rogue0/${name}.ts`, bindings);

function context() {
  const player = { type: 'player', x: 1, y: 1 };
  return { messages: [], visibleTiles: new Set(), player, entities: [player] };
}

function enemy(ctx, x, y, hp = 10) {
  const e = { type: 'enemy', name: 'Skeleton', x, y, healthPoints: hp, context: ctx };
  ctx.entities.push(e);
  return e;
}

// ---- Hidden victim: pain, kill and death cues replace names and numbers ----
{
  const ctx = context();
  const skeleton = enemy(ctx, 8, 8);
  announceHit(ctx, skeleton, 'You hit Skeleton for 4 fire damage.', true);
  assert.deepEqual(ctx.messages, [UNSEEN_PAIN]);
  assert.equal(ctx.messages[0].includes('Skeleton'), false, 'hidden names stay secret');
}

{
  const ctx = context();
  const skeleton = enemy(ctx, 8, 8, 0);
  announceHit(ctx, skeleton, 'You hit Skeleton for 4 fire damage.', true);
  assert.deepEqual(ctx.messages, [UNSEEN_KILL], 'a lethal hidden hit mentions silence');
  announceDeath(ctx, skeleton, 'Skeleton was killed, dropping a Sword.');
  assert.deepEqual(ctx.messages, [UNSEEN_KILL], 'the death hook does not repeat the cry');
}

{
  const ctx = context();
  const skeleton = enemy(ctx, 8, 8);
  announceHit(ctx, skeleton, 'You hit Skeleton for 1 damage.', true);
  skeleton.healthPoints = 0;
  announceDeath(ctx, skeleton, 'Skeleton was killed.');
  assert.deepEqual(ctx.messages, [UNSEEN_DEATH, UNSEEN_PAIN],
    'a later silent death still gets its own distant cry');
}

{
  const ctx = context();
  const skeleton = enemy(ctx, 8, 8);
  announceHit(ctx, skeleton, 'You hit Skeleton for no damage.', false);
  announceMiss(ctx, skeleton, 'You miss Skeleton.');
  assert.deepEqual(ctx.messages, [UNSEEN_MISS, UNSEEN_IMPACT]);
}

// ---- Visible victims keep the detailed combat line ----
{
  const ctx = context();
  ctx.visibleTiles.add('8,8');
  const skeleton = enemy(ctx, 8, 8, 3);
  assert.equal(isEnemyVisible(ctx, skeleton), true);
  announceHit(ctx, skeleton, 'You hit Skeleton for 3 fire damage.', true);
  announceDeath(ctx, skeleton, 'Skeleton was killed, dropping a Sword.');
  assert.deepEqual(ctx.messages,
    ['Skeleton was killed, dropping a Sword.', 'You hit Skeleton for 3 fire damage.']);
}

// ---- Grass concealment counts as outside sight even on a lit tile ----
{
  const ctx = context();
  ctx.visibleTiles.add('8,8');
  for (let x = 6; x <= 10; x++) terrainFor(ctx).setFeature(x, 8, 'grass');
  const skeleton = enemy(ctx, 8, 8);
  assert.equal(isEnemyVisible(ctx, skeleton), false, 'concealed monsters are not named');
  announceHit(ctx, skeleton, 'You hit Skeleton for 2 damage.', true);
  assert.deepEqual(ctx.messages, [UNSEEN_PAIN]);
  ctx.player.x = 8; ctx.player.y = 8;
  assert.equal(isEnemyVisible(ctx, skeleton), true, 'standing in the grass reveals an adjacent occupant');
  terrainFor(ctx).clearAllFeatures();
}

// ---- Status-effect damage also reports a distant cry, not the monster name ----
{
  const floating = [];
  const effects = load('effects', {
    spawnEntityFloatingText: (...args) => floating.push(args),
    dungeon: {},
  });
  const ctx = context();
  const skeleton = enemy(ctx, 8, 8, 5);
  skeleton.effects = [];
  skeleton.takeDamage = function (amount) { this.healthPoints -= amount; };
  effects.createBurningEffect(1).tick(skeleton);
  assert.equal(skeleton.healthPoints, 4);
  assert.deepEqual(ctx.messages, [UNSEEN_PAIN], 'a hidden burn tick is audible');
  assert.deepEqual(floating, [], 'no damage number pops over a hidden monster');

  const ctx2 = context();
  ctx2.visibleTiles.add('8,8');
  const seen = enemy(ctx2, 8, 8, 5);
  seen.effects = [];
  seen.takeDamage = function (amount) { this.healthPoints -= amount; };
  effects.createBurningEffect(1).tick(seen);
  assert.equal(ctx2.messages[0], 'Skeleton burns for 1 fire damage.');
  assert.equal(floating.length, 1, 'visible damage still shows its number');
}

console.log('Rogue0 unseen combat: hidden hits, kills, deaths, misses and status ticks use distant sound cues without leaking names, damage numbers or loot');
