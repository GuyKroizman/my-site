import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('invisibility');
import assert from 'node:assert/strict';

import { loadLogic } from './lib/rogue0-logic-loader.mjs';
const load = (name, bindings) => loadLogic(`src/games/rogue0/${name}.ts`, bindings);

const tiles = load('tiles');
const { Entity } = load('entity');
const hasEffect = (e, id) => (e.effects ?? []).some(effect => effect.id === id);
const removeEffect = (e, id) => { e.effects = (e.effects ?? []).filter(effect => effect.id !== id); };

let result = { hit: true, damage: 5, crit: false, surprise: false, damageType: 'physical', appliedEffects: [] };
const resolveAttack = () => result;
const removeEntity = () => {};
const fov = load('fov', tiles);

const dungeon = load('dungeon', {
  tiles, ...fov, hasEffect, removeEffect, resolveAttack, removeEntity,
  spawnEntityFloatingText() {}, applyEffect() {},
}).default;
dungeon.applyHitEffects = () => {};
dungeon.procArmorCurse = () => {};
dungeon.procWeaponCurse = () => {};

function setup() {
  tiles.clearAllFeatures();
  dungeon.currentLevel = Array.from({ length: 8 }, () => Array(10).fill(0));
  return { entities: [], messages: [], visibleTiles: new Set(), simulationTime: 1 };
}

function actor(ctx, type, x, y, hp = 20) {
  const e = Object.assign(new Entity(), {
    context: ctx, x, y, type, name: type, healthPoints: hp, effects: [],
    onHitEffects: () => [],
    takeDamage(n) { this.healthPoints -= n; },
  });
  ctx.entities.push(e);
  return e;
}

// Landing actual damage on an enemy removes the player's invisibility.
{
  const ctx = setup();
  const player = actor(ctx, 'player', 1, 1);
  player.effects.push({ id: 'invisible' });
  const enemy = actor(ctx, 'enemy', 2, 1);
  result = { hit: true, damage: 5, crit: false, surprise: false, damageType: 'physical', appliedEffects: [] };
  dungeon.resolveAndApplyAttack(ctx, player, enemy, 0, 'physical');
  assert.equal(hasEffect(player, 'invisible'), false, 'damaging an enemy breaks player invisibility');
  assert.equal(enemy.healthPoints, 15, 'damage still lands normally');
}

// A hit absorbed to zero damage does not break invisibility.
{
  const ctx = setup();
  const player = actor(ctx, 'player', 1, 1);
  player.effects.push({ id: 'invisible' });
  const enemy = actor(ctx, 'enemy', 2, 1);
  result = { hit: true, damage: 0, crit: false, surprise: false, damageType: 'physical', appliedEffects: [] };
  dungeon.resolveAndApplyAttack(ctx, player, enemy, 0, 'physical');
  assert.equal(hasEffect(player, 'invisible'), true, 'zero-damage hits keep the player invisible');
}

// Only the player's own invisibility is consumed; an invisible non-player attacker keeps it.
{
  const ctx = setup();
  const monster = actor(ctx, 'enemy', 1, 1);
  monster.effects.push({ id: 'invisible' });
  const victim = actor(ctx, 'enemy', 2, 1);
  result = { hit: true, damage: 5, crit: false, surprise: false, damageType: 'physical', appliedEffects: [] };
  dungeon.resolveAndApplyAttack(ctx, monster, victim, 0, 'physical');
  assert.equal(hasEffect(monster, 'invisible'), true, 'monster invisibility is not tied to player attacks');
}

console.log('Rogue0 invisibility: breaking on damaging attacks, surviving absorbed hits, and player-only scoping passed');
