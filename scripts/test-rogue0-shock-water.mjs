import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('shock-water');
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
}
const Hero = load('classes/basicHero', { Entity, dungeon, resolveAttack, removeEntity, Wand, ...fov }).default;
function setup() {
  tiles.clearAllFeatures(); removed.length = 0;
  dungeon.currentLevel = Array.from({ length: 8 }, () => Array(10).fill(0));
  const context = { entities: [], messages: [], visibleTiles: new Set(), simulationTime: 4.5 };
  context.onShockWater = (target, damage) => dungeon.conductShock(context, target, damage);
  return context;
}
function actor(context, x, y, type = 'enemy', hp = 20) {
  const e = Object.assign(new Entity(), { context, x, y, type, name: type, healthPoints: hp,
    damageCalls: 0, takeDamage(n) { this.healthPoints -= n; this.damageCalls++; } });
  context.entities.push(e); return e;
}
{
  const ctx = setup();
  for (const [x, y] of [[2, 2], [3, 2], [3, 3], [2, 3], [4, 3], [5, 3], [6, 3], [7, 3], [4, 4]]) {
    tiles.setFeature(x, y, 'water');
  }
  const target = actor(ctx, 2, 2);
  const caster = actor(ctx, 3, 2, 'player');
  const resistant = actor(ctx, 3, 3); resistant.resistance.shock = 2;
  const vulnerable = actor(ctx, 2, 3); vulnerable.vulnerability.shock = 2;
  const armored = actor(ctx, 4, 3); armored.protection = () => 100;
  const airborne = actor(ctx, 5, 3); airborne.effects.push({ id: 'levitating' });
  const item = actor(ctx, 4, 4, 'item');
  const corpse = actor(ctx, 4, 4, 'enemy', 0);
  const diagonal = actor(ctx, 1, 1); tiles.setFeature(1, 1, 'water');
  const isolated = actor(ctx, 7, 3); tiles.setFeature(6, 3, 'ice');
  const deadEnd = actor(ctx, 3, 4); tiles.setFeature(3, 4, 'water'); dungeon.currentLevel[4][3] = 1;
  dungeon.conductShock(ctx, target, 5);
  assert.equal(target.healthPoints, 20, 'primary target never double hit');
  assert.equal(caster.healthPoints, 17, 'caster can be caught in their own pool');
  assert.equal(resistant.healthPoints, 19);
  assert.equal(vulnerable.healthPoints, 15);
  assert.equal(armored.healthPoints, 17, 'physical armor does not absorb shock');
  for (const e of [airborne, item, diagonal, isolated, deadEnd]) assert.equal(e.healthPoints, 20);
  assert.equal(corpse.healthPoints, 0);
  for (const e of [caster, resistant, vulnerable, armored]) assert.equal(e.damageCalls, 1, 'cycles never repeat damage');
  assert.equal(ctx.simulationTime, 4.5, 'conduction has no extra action cost');
  assert.equal(tiles.getFeature(2, 2), 'water', 'shock does not consume water');
}
for (const reason of ['zero', 'negative', 'nan', 'flight', 'ice', 'dry']) {
  const ctx = setup();
  tiles.setFeature(2, 2, 'water'); tiles.setFeature(3, 2, 'water');
  const target = actor(ctx, 2, 2), other = actor(ctx, 3, 2);
  if (reason === 'flight') target.effects.push({ id: 'levitating' });
  if (reason === 'ice') tiles.setFeature(2, 2, 'ice');
  if (reason === 'dry') tiles.clearFeature(2, 2);
  const damage = reason === 'zero' ? 0 : reason === 'negative' ? -1 : reason === 'nan' ? NaN : 6;
  dungeon.conductShock(ctx, target, damage);
  assert.equal(other.damageCalls, 0, reason);
}
{
  const ctx = setup();
  for (let x = 1; x <= 5; x++) tiles.setFeature(x, 2, 'water');
  const target = actor(ctx, 1, 2, 'enemy', 0); // lethal primary hits still conduct
  const victim = actor(ctx, 2, 2, 'enemy', 2);
  const player = actor(ctx, 3, 2, 'player', 2);
  const immune = actor(ctx, 4, 2); immune.resistance.shock = 99;
  let spawned;
  victim.onTestDeath = () => { spawned = actor(ctx, 5, 2); };
  dungeon.conductShock(ctx, target, 6);
  assert.deepEqual(removed, [victim, player], 'normal death removal for both teams');
  assert.equal(spawned.damageCalls, 0, 'death-spawned actors are not recursively shocked');
  assert.equal(immune.damageCalls, 0, 'fully absorbed arcs never heal or damage');
}
// Real attack-application entry points: no conduction on misses, zero damage or other types.
for (const path of ['normal', 'skill', 'throw', 'wand']) {
  for (const mode of ['shock', 'miss', 'absorbed', 'physical']) {
    const ctx = setup();
    tiles.setFeature(2, 2, 'water'); tiles.setFeature(3, 2, 'water');
    const target = actor(ctx, 2, 2), secondary = actor(ctx, 3, 2);
    const hero = Object.assign(Object.create(Hero.prototype), {
      context: ctx, baseAttack: 0, name: 'Hero', attack: () => 5, onHitEffects: () => []
    });
    result = { hit: mode !== 'miss', damage: mode === 'absorbed' ? 0 : 5,
      damageType: mode === 'physical' ? 'physical' : 'shock', appliedEffects: [] };
    if (path === 'normal') dungeon.resolveAndApplyAttack(ctx, hero, target, 1, result.damageType);
    if (path === 'skill') hero.resolveSkillAttack(target, { damageType: result.damageType });
    if (path === 'throw') hero.applyThrownItemToEnemy({ equipSlot: 'weapon', damage: () => 5,
      damageType: result.damageType, displayName: 'Lightning scroll' }, target);
    if (path === 'wand') {
      const wand = new Wand();
      ctx.throwItem = wand;
      Object.assign(hero, { x: 1, y: 2, zapping: true, canAct: () => true,
        getAllItems: () => [wand], spendTurn() {}, refreshUI() {} });
      hero.throwAt(2, 2);
      assert.equal(wand.charges, 0, 'arcs do not consume extra charges');
    }
    assert.equal(secondary.healthPoints, mode === 'shock' ? 17 : 20, `${path}/${mode}`);
  }
}
console.log('Rogue0 shock-water networks, resistance, flight, caster risk, deaths and attack dispatch passed');
