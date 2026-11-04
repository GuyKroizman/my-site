import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('frost-effects');
import assert from 'node:assert/strict';
import PF from 'pathfinding';

import { loadLogic } from './lib/rogue0-logic-loader.mjs';
const load = (path, bindings) => loadLogic(`src/games/rogue0/${path}`, bindings);

const tiles = load('tiles.ts');
const fov = load('fov.ts', tiles);
const { actionCost } = load('timing.ts');
const effects = load('effects.ts', {
  dungeon: { log() {}, freezeWater: () => 0, expireLevitation() {} },
  spawnEntityFloatingText() {}
});
const { Entity } = load('entity.ts', { actionCost });
const { removeEntity } = load('entity.ts', { actionCost });
const dungeon = load('dungeon.ts', {
  PF, tiles, ...fov,
  removeEntity: (ctx, e) => { ctx.entities = ctx.entities.filter(v => v !== e); },
  spawnEntityFloatingText() {},
  MirrorImage: class {},
  dungeonTheme: {},
  CURSE_PROC_CHANCE: 0.2,
  sfx: { step() {}, death() {} },
  resolveAttack: () => ({ hit: false, damage: 0, appliedEffects: [] }),
  hasEffect: effects.hasEffect,
  removeEffect: effects.removeEffect,
  applyEffect: effects.applyEffect,
  createBurningEffect: effects.createBurningEffect,
  createPoisonedEffect: effects.createPoisonedEffect,
  createFrozenEffect: duration => effects.createFrozenEffect(duration),
  createChilledEffect: duration => effects.createChilledEffect(duration),
  createCrippledEffect: duration => effects.createCrippledEffect(duration),
  createConfusedEffect: duration => effects.createConfusedEffect(duration),
  createCharmedEffect: duration => effects.createCharmedEffect(duration)
}).default;

// --- Wand of Frost carries both halves of frost; other wands still one effect.
const Wand = load('items/wand.ts', {
  Entity, dungeon: { log() {} }, identify: item => { item.identified = true; },
  Phaser: { Math: { Between: () => 1 } }
}).default;
const WandOfFrost = load('items/WandOfFrost.ts', {
  Wand, createFrozenEffect: effects.createFrozenEffect, createChilledEffect: effects.createChilledEffect
}).default;
const WandOfFirebolt = load('items/WandOfFirebolt.ts', {
  Wand, createBurningEffect: effects.createBurningEffect
}).default;
const WandOfLightning = load('items/WandOfLightning.ts', {
  Wand, createWeakenedEffect: effects.createWeakenedEffect
}).default;

const frostWand = Object.create(WandOfFrost.prototype);
const frostEffects = frostWand.wandEffects();
assert.deepEqual(frostEffects.map(e => e.id), ['frozen', 'chilled'],
  'a frost zap freezes and chills its target');
assert.equal(frostEffects[0].duration, 1, 'the skipped action stays a single action');
assert.equal(frostEffects[1].duration, 10, 'the slow keeps its full duration');
assert.equal(frostWand.wandEffect().id, 'frozen', 'single-effect callers still get the freeze');
assert.deepEqual(Object.create(WandOfFirebolt.prototype).wandEffects().map(e => e.id), ['burning'],
  'firebolt keeps exactly one effect');
assert.deepEqual(Object.create(WandOfLightning.prototype).wandEffects().map(e => e.id), ['weakened'],
  'lightning keeps exactly one effect');

// --- A chilled monster loses tempo through the same cost function the AI uses.
const chilledGoblin = { movementSpeed: 1, attackDelay: 1.5, effects: [{ id: 'chilled' }] };
assert.equal(actionCost(chilledGoblin, 'move'), 2, 'chilled monsters move at half speed');
assert.equal(actionCost(chilledGoblin, 'attack', 1.5), 3, 'chilled monsters attack at half speed');
chilledGoblin.effects = [];
assert.equal(actionCost(chilledGoblin, 'move'), 1, 'clearing the slow restores normal speed');

// The scheduler, not just the cost helper, must give the monster half the turns.
const manager = load('turnManager.ts', {
  dungeon: { log() {} }, hasEffect: effects.hasEffect, removeEffect: effects.removeEffect
}).default;
{
  const player = Object.assign(new Entity(), {
    type: 'player', healthPoints: 10, context: { simulationTime: 0, messages: [], visibleTiles: new Set() },
    refresh() {}, tickEffects() { effects.tickEffects(this, this.context); },
    turn() {}
  });
  const goblin = Object.assign(new Entity(), {
    type: 'enemy', healthPoints: 10, turns: 0, movementSpeed: 1,
    context: { simulationTime: 0, messages: [], visibleTiles: new Set() },
    refresh() {}, tickEffects() { effects.tickEffects(this, this.context); },
    turn() { this.turns++; this.spendTime('move'); }
  });
  effects.applyEffect(goblin, effects.createChilledEffect());
  const entities = [player, goblin];
  manager.reset(entities);
  for (let i = 0; i < 6; i++) {
    player.spendTime('move');
    manager.update(entities);
  }
  assert.equal(manager.time, 6);
  assert.equal(goblin.turns, 3, 'a chilled monster acts once per two normal actions');
}

// --- Frost traps now catch monsters too (confused or not); other traps do not.
function trapSetup() {
  tiles.clearAllFeatures();
  dungeon.currentLevel = Array.from({ length: 7 }, () => Array(7).fill(0));
  dungeon.pathGrid = new PF.Grid(dungeon.currentLevel);
  const context = {
    entities: [], messages: [], visibleTiles: new Set(), simulationTime: 0.5,
    map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 },
    scene: {
      add: { sprite: () => ({ setOrigin() { return this; }, setDepth() { return this; }, destroy() {} }) },
      tweens: { add(opts) { opts.onComplete?.(); }, killTweensOf() {} }
    }
  };
  const player = Object.assign(new Entity(), {
    type: 'player', name: 'Hero', x: 0, y: 0, healthPoints: 10,
    context, protection: () => 0, takeDamage(n) { this.healthPoints -= n; }
  });
  context.player = player;
  context.entities.push(player);
  return context;
}
function monsterAt(context, type, x, y, extra = {}) {
  const monster = Object.assign(new Entity(), {
    type, name: type === 'player' ? 'Hero' : 'Goblin', x, y, healthPoints: 10,
    context, protection: () => 0, takeDamage(n) { this.healthPoints -= n; }
  }, extra);
  context.entities.push(monster);
  return monster;
}
{
  const context = trapSetup();
  const goblin = monsterAt(context, 'enemy', 1, 3);
  tiles.setFeature(2, 3, 'trap', { trapKind: 'frost', trap: 'hidden', trapReusable: true });
  dungeon.moveEntityTo(context, goblin, 2, 3);
  assert.deepEqual([goblin.x, goblin.y], [2, 3], 'the monster steps onto the plate');
  assert.equal(effects.hasEffect(goblin, 'frozen'), true, 'a monster that steps on a frost trap freezes');
  assert.equal(effects.hasEffect(goblin, 'chilled'), true, 'and is chilled for the full duration');
  assert.equal(goblin.effects.find(e => e.id === 'chilled').duration, 10);
  assert.equal(tiles.getTrapState(2, 3), 'visible', 'frost traps stay armed for monsters too');

  // Stay put: standing on the plate is not another entry.
  goblin.effects.find(e => e.id === 'chilled').duration = 4;
  dungeon.moveEntityTo(context, goblin, 2, 3);
  assert.equal(goblin.effects.find(e => e.id === 'chilled').duration, 4, 'standing still never refreshes it');

  // Leaving and returning re-triggers the reusable plate.
  dungeon.moveEntityTo(context, goblin, 1, 3);
  dungeon.moveEntityTo(context, goblin, 2, 3);
  assert.equal(goblin.effects.find(e => e.id === 'chilled').duration, 10,
    're-entry refreshes the monster slow to full duration');
  assert.equal(goblin.effects.filter(e => e.id === 'chilled').length, 1, 'the slow never stacks');
}
{
  // Player-only hazards stay player-only: a monster crossing fire is untouched.
  const context = trapSetup();
  const goblin = monsterAt(context, 'enemy', 1, 3);
  tiles.setFeature(2, 3, 'trap', { trapKind: 'fire', trap: 'hidden' });
  tiles.setFeature(4, 3, 'trap', { trapKind: 'dart', trap: 'hidden' });
  dungeon.moveEntityTo(context, goblin, 2, 3);
  dungeon.moveEntityTo(context, goblin, 3, 3);
  dungeon.moveEntityTo(context, goblin, 4, 3);
  assert.equal(effects.hasEffect(goblin, 'burning'), false, 'monsters still ignore fire plates');
  assert.equal(effects.hasEffect(goblin, 'poisoned'), false, 'monsters still ignore dart plates');
  assert.equal(effects.hasEffect(goblin, 'chilled'), false);
  assert.equal(tiles.getTrapState(2, 3), 'hidden');
  assert.equal(tiles.getTrapState(4, 3), 'hidden');
}
{
  // Levitation still bypasses pressure plates entirely.
  const context = trapSetup();
  const goblin = monsterAt(context, 'enemy', 1, 3);
  tiles.setFeature(2, 3, 'trap', { trapKind: 'frost', trap: 'hidden', trapReusable: true });
  effects.applyEffect(goblin, effects.createLevitatingEffect(4));
  dungeon.moveEntityTo(context, goblin, 2, 3);
  assert.equal(effects.hasEffect(goblin, 'chilled'), false, 'flight skips frost plates');
  assert.equal(tiles.getTrapState(2, 3), 'hidden');
}

// --- The player still gets both halves from the same plate.
{
  const context = trapSetup();
  const hero = context.player;
  hero.x = 1; hero.y = 3;
  tiles.setFeature(2, 3, 'trap', { trapKind: 'frost', trap: 'hidden', trapReusable: true });
  dungeon.moveEntityTo(context, hero, 2, 3);
  assert.equal(effects.hasEffect(hero, 'frozen'), true);
  assert.equal(effects.hasEffect(hero, 'chilled'), true);
  assert.match(context.messages.join('\n'), /You are Chilled/, 'the log names the new status');
}

console.log('Rogue0 frost effects: wand freeze+chill, chilled monster tempo, frost traps catching monsters, '
  + 'player-only hazards, re-entry refresh, levitation and player parity passed');
