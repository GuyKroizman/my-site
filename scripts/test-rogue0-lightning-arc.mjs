import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('lightning-arc');
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
const { Entity } = load('entity');
const hasEffect = (e, id) => e.effects.some(effect => effect.id === id);
let result = { hit: true, damage: 5, damageType: 'shock', appliedEffects: [] };
const removed = [];
const removeEntity = (context, entity) => {
  removed.push(entity); context.entities = context.entities.filter(e => e !== entity);
  entity.onTestDeath?.();
};
const resolveAttack = () => result;
const fov = load('fov', tiles);
const dungeon = load('dungeon', { tiles, ...fov, hasEffect, resolveAttack, removeEntity,
  spawnEntityFloatingText() {}, applyEffect() {} }).default;
dungeon.applyHitEffects = () => {};
class Wand {
  charges = 1;
  damageType = 'shock';
  range() { return 5; }
  damage() { this.charges--; return 5; }
  wandEffect() { return {}; }
  wandDamageMultiplier() { return 1; }
  arcsToAdjacent() { return false; }
}
class LightningWand extends Wand {
  arcsToAdjacent() { return true; }
}
const Hero = load('classes/basicHero', { Entity, dungeon, resolveAttack, removeEntity, Wand, ...fov }).default;
function setup() {
  tiles.clearAllFeatures(); removed.length = 0;
  dungeon.currentLevel = Array.from({ length: 8 }, () => Array(10).fill(0));
  const context = { entities: [], messages: [], visibleTiles: new Set(), simulationTime: 4.5 };
  return context;
}
function actor(context, x, y, type = 'enemy', hp = 20) {
  const e = Object.assign(new Entity(), { context, x, y, type, name: type, healthPoints: hp,
    damageCalls: 0, takeDamage(n) { this.healthPoints -= n; this.damageCalls++; } });
  context.entities.push(e); return e;
}
{
  const ctx = setup();
  const target = actor(ctx, 3, 3);
  const north = actor(ctx, 3, 2);
  const diagonal = actor(ctx, 4, 4);
  const west = actor(ctx, 2, 3);
  const player = actor(ctx, 3, 4, 'player');
  const far = actor(ctx, 5, 5);
  const item = actor(ctx, 4, 3, 'item');
  const corpse = actor(ctx, 2, 4, 'enemy', 0);
  const flying = actor(ctx, 4, 2); flying.effects.push({ id: 'levitating' });
  dungeon.conductShockAdjacent(ctx, target, 5);
  assert.equal(target.healthPoints, 20, 'primary target never double hit');
  for (const victim of [north, diagonal, west, player]) {
    assert.equal(victim.healthPoints, 17, 'cardinal and diagonal adjacency both conduct');
    assert.equal(victim.damageCalls, 1, 'each adjacent actor hit exactly once');
  }
  for (const skipped of [far, item, corpse, flying]) assert.equal(skipped.damageCalls, 0, 'non-adjacent/item/corpse/flying actors skipped');
  assert.equal(ctx.simulationTime, 4.5, 'arcing has no extra action cost');
}
{
  const ctx = setup();
  const target = actor(ctx, 3, 3);
  const resistant = actor(ctx, 3, 2); resistant.resistance.shock = 2;
  const vulnerable = actor(ctx, 2, 2); vulnerable.vulnerability.shock = 2;
  const armored = actor(ctx, 4, 2); armored.protection = () => 100;
  const immune = actor(ctx, 2, 3); immune.resistance.shock = 99;
  dungeon.conductShockAdjacent(ctx, target, 5);
  assert.equal(resistant.healthPoints, 19, 'shock resistance reduces the arc');
  assert.equal(vulnerable.healthPoints, 15, 'shock vulnerability increases the arc');
  assert.equal(armored.healthPoints, 17, 'physical armor does not absorb the arc');
  assert.equal(immune.damageCalls, 0, 'fully absorbed arcs never heal or damage');
}
for (const reason of ['zero', 'negative', 'nan']) {
  const ctx = setup();
  const target = actor(ctx, 3, 3), other = actor(ctx, 3, 2);
  const damage = reason === 'zero' ? 0 : reason === 'negative' ? -1 : NaN;
  dungeon.conductShockAdjacent(ctx, target, damage);
  assert.equal(other.damageCalls, 0, reason);
}
{
  const ctx = setup();
  const target = actor(ctx, 1, 1, 'enemy', 0); // lethal primary hits still arc
  const victim = actor(ctx, 2, 1, 'enemy', 2);
  const player = actor(ctx, 1, 2, 'player', 2);
  let spawned;
  victim.onTestDeath = () => { spawned = actor(ctx, 3, 1); };
  dungeon.conductShockAdjacent(ctx, target, 6);
  assert.deepEqual(removed, [victim, player], 'normal death removal for both teams');
  assert.equal(spawned.damageCalls, 0, 'death-spawned actors are not recursively arced');
}
// Real wand dispatch: only the lightning wand arcs, and only on a damaging shock hit.
for (const arc of [true, false]) {
  for (const mode of ['shock', 'miss', 'absorbed', 'physical']) {
    const ctx = setup();
    ctx.onShockWater = () => {}; // isolate arc from water conduction on dry floor
    const target = actor(ctx, 2, 2), secondary = actor(ctx, 3, 2);
    const hero = Object.assign(Object.create(Hero.prototype), {
      context: ctx, baseAttack: 0, name: 'Hero', attack: () => 5, onHitEffects: () => []
    });
    result = { hit: mode !== 'miss', damage: mode === 'absorbed' ? 0 : 5,
      damageType: mode === 'physical' ? 'physical' : 'shock', appliedEffects: [] };
    const wand = arc ? new LightningWand() : new Wand();
    ctx.throwItem = wand;
    Object.assign(hero, { x: 1, y: 2, zapping: true, canAct: () => true,
      getAllItems: () => [wand], spendTurn() {}, refreshUI() {} });
    hero.throwAt(2, 2);
    assert.equal(wand.charges, 0, 'arcs do not consume extra charges');
    assert.equal(secondary.healthPoints, mode === 'shock' && arc ? 17 : 20, `arc=${arc}/${mode}`);
  }
}
console.log('Rogue0 lightning wand arcs: adjacency, diagonals, resistance, flight, caster risk, deaths and dispatch passed');
