import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('wand-blast');
import assert from 'node:assert/strict';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';
import { createGameContext } from '../src/games/rogue0/context.ts';
import { terrainFor } from '../src/games/rogue0/terrain.ts';
import { placeChasmFallen } from '../src/games/rogue0/chasmDrops.ts';
import { actionCost } from '../src/games/rogue0/timing.ts';
import { TurnManager } from '../src/games/rogue0/turnManager.ts';
import { encodeGraph, decodeGraph } from '../src/games/rogue0/saveCodec.ts';
import * as fov from '../src/games/rogue0/fov.ts';

const load = (name, bindings = {}) => loadLogic(`src/games/rogue0/${name}.ts`, bindings);
const sfx = { step() {}, death() {} };
const Phaser = { Math: { Between: min => min } };
const { Entity, removeEntity } = load('entity', { sfx, actionCost });
const dungeon = load('dungeon', { sfx, terrainFor, removeEntity, ...fov,
  hasEffect: (...args) => effects.hasEffect(...args),
  applyEffect: (...args) => effects.applyEffect(...args),
  createStunnedEffect: (...args) => effects.createStunnedEffect(...args),
}).default;
const effects = load('effects', { dungeon, terrainFor, spawnEntityFloatingText() {} });
const Wand = load('items/wand', { Entity, dungeon, Phaser }).default;
const Blast = load('items/WandOfBlast', { Wand, dungeon }).default;
const Hero = load('classes/basicHero', { Entity, Wand, dungeon, terrainFor, ...fov,
  hasEffect: effects.hasEffect,
  resolveAttack() { throw Error('Blast is displacement, not a damage/accuracy roll'); },
}).default;
class Loot extends Entity {
  constructor(context) { super(); this.init(context); this.name = 'Loot'; this.type = 'item'; }
}
const Monster = load('monsters/monster', { Entity, Phaser, Gold: Loot,
  enemyCanSeePlayer: () => false, enemyTurn() {},
}).default;

function fixture(enemyX = 5, enemyY = 5, width = 14, height = 12) {
  const context = createGameContext();
  context.floor = 2;
  const level = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) =>
    x === 0 || y === 0 || x === width - 1 || y === height - 1 ? 1 : 0));
  context.currentLevel = level;
  dungeon.currentLevel = level;
  context.map = { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 };
  context.scene = { tweens: { killTweensOf() {}, add: config => config.onComplete?.() } };
  context.visibleTiles = new Set(level.flatMap((row, y) => row.map((_, x) => `${x},${y}`)));
  const hero = Object.assign(new Entity(), { context, type: 'player', name: 'Hero', x: 3, y: 5,
    healthPoints: 30, backpack: [], walkPath: [], inputBuffer: [], actionReady: true,
    gainXp(n) { this.earnedXp = (this.earnedXp ?? 0) + n; },
    spendTurn(action) { this.spendTime(action); }, refreshUI() {},
  });
  Object.setPrototypeOf(hero, Hero.prototype);
  context.player = hero;
  const enemy = new Monster(context, { name: 'Victim', description: '', healthPoints: 10,
    movementSpeed: 1, attackDelay: 1, visionRadius: 8, attackDamage: 1, protection: 0,
    range: 0, loot: [Loot], initiallyAwake: true });
  Object.assign(enemy, { x: enemyX, y: enemyY });
  const wand = new Blast(context);
  wand.identified = true;
  hero.backpack.push(wand);
  context.entities = [hero, enemy];
  let impact;
  context.onWandZap = (_zap, callback) => { impact = callback; };
  const fire = () => {
    hero.zapping = true; context.throwMode = true; context.throwItem = wand;
    hero.throwAt(enemy.x, enemy.y);
  };
  return { context, hero, enemy, wand, level, tiles: terrainFor(context), fire, impact: () => impact?.() };
}

// Full firing route: one charge/action, bolt landing gates displacement, no damage.
{
  const f = fixture();
  f.fire();
  assert.equal(f.wand.charges, 2);
  assert.equal(f.hero.nextActionTime, 1);
  assert.equal(f.hero.moving, true);
  assert.equal(f.enemy.x, 5);
  f.impact();
  assert.equal(f.hero.moving, false);
  assert.deepEqual([f.enemy.x, f.enemy.y], [10, 5]);
  assert.equal(f.hero.x, 3, 'no distant recoil');
  assert.equal(f.enemy.healthPoints, 10);
  assert.equal(f.enemy.nextActionTime, 0, 'push does not spend victim actions');
  assert.equal(f.enemy.sleeping, false);
}

// Upgrades, recharging and save graphs retain the utility wand's prototype.
{
  const f = fixture();
  f.wand.level = 1; f.wand.onUpgrade();
  assert.equal(f.wand.maxCharges, 4);
  f.wand.charges = 2;
  f.wand.description = 'Pushes an enemy up to 3 tiles away.'; // Older save text.
  const registry = { './items/WandOfBlast.ts:default': Blast };
  const graph = encodeGraph({ backpack: [f.wand], quickslots: [f.wand] }, registry);
  const restored = decodeGraph(JSON.parse(JSON.stringify(graph)), registry, item => { item.context = f.context; });
  const wand = restored.backpack[0];
  assert.ok(wand instanceof Blast);
  assert.equal(wand, restored.quickslots[0]);
  assert.equal(wand.charges, 2);
  for (let i = 0; i < 20; i++) wand.refresh();
  assert.equal(wand.charges, 3);
  wand.applySpecialImpact(f.hero, f.enemy);
  assert.equal(f.enemy.x, 11, 'saved +1 wand pushes six tiles');
  assert.equal(f.enemy.healthPoints, 10);
  assert.match(wand.baseDescription, /Push distance: 6 tiles/);
  assert.doesNotMatch(wand.baseDescription, /up to 3 tiles/);
}

// Base distance and each upgrade apply to both the enemy and point-blank recoil.
for (const level of [0, 1, 2, 3, 8]) {
  const f = fixture(19, 5, 40);
  f.hero.x = 18;
  f.wand.level = level;
  const distance = 5 + level;
  f.fire(); f.impact();
  assert.equal(f.enemy.x, 19 + distance);
  assert.equal(f.hero.x, 18 - distance);
  assert.equal(effects.hasEffect(f.enemy, 'stunned'), false);
  assert.equal(effects.hasEffect(f.hero, 'stunned'), false);
  assert.equal(f.wand.charges, 2, 'greater distance still costs one charge');
  assert.match(f.wand.baseDescription, new RegExp(`Push distance: ${distance} tiles`));
}

// Upgraded blasts still resolve every intervening tile, not just the endpoint.
for (const hazard of ['wall', 'chasm']) {
  const f = fixture(5, 5, 30);
  f.wand.level = 3;
  if (hazard === 'wall') f.level[5][11] = 1;
  else f.tiles.setFeature(11, 5, 'chasm');
  f.fire(); f.impact();
  if (hazard === 'wall') {
    assert.equal(f.enemy.x, 10);
    assert.equal(f.enemy.effects.find(e => e.id === 'stunned')?.duration, 3);
  } else {
    assert.equal(f.enemy.healthPoints, 0);
    assert.equal(f.context.chasmFallenItems.get(3).length, 1);
  }
}

// Immediate wall, later wall, closed/secret doors, boundaries; no wall clipping.
for (const blocker of ['wall', 'later-wall', 'door', 'secretDoor', 'boundary']) {
  const f = fixture();
  const x = blocker === 'later-wall' ? 8 : 6;
  if (blocker.includes('wall')) f.level[5][x] = 1;
  else if (blocker === 'boundary') f.enemy.x = 12;
  else f.tiles.setFeature(x, 5, blocker, { door: 'closed' });
  f.fire(); f.impact();
  assert.equal(f.enemy.x, blocker === 'boundary' ? 12 : x - 1);
  assert.equal(f.enemy.effects.find(e => e.id === 'stunned')?.duration, 3);
  assert.equal(f.enemy.healthPoints, 10);
}
for (const anchored of [false, true]) {
  const f = fixture();
  if (anchored) effects.applyEffect(f.enemy, effects.createRootedEffect());
  else f.context.entities.push(Object.assign(new Entity(), { type: 'enemy', healthPoints: 10, x: 6, y: 5 }));
  f.fire(); f.impact();
  assert.equal(f.enemy.x, 5);
  assert.equal(effects.hasEffect(f.enemy, 'stunned'), false, 'bodies and roots are not walls');
}

// Diagonal displacement and recoil, without changing actor scheduling deadlines.
{
  const f = fixture(4, 6);
  f.fire(); f.impact();
  assert.deepEqual([f.enemy.x, f.enemy.y], [8, 10]);
  assert.equal(effects.hasEffect(f.enemy, 'stunned'), true, 'longer diagonal push reaches the wall');
  assert.deepEqual([f.hero.x, f.hero.y], [1, 3]);
  assert.equal(effects.hasEffect(f.hero, 'stunned'), true, 'diagonal recoil reaches boundary');
  assert.equal(f.hero.canAct(), false);
}

// Adjacent hits recoil even if the enemy falls/dies; normal monster death queues
// actual loot and XP exactly once, and the lower floor distributes it safely.
{
  const f = fixture(4);
  f.tiles.setFeature(5, 5, 'chasm');
  f.tiles.setFeature(2, 5, 'chasm');
  f.hero.walkPath = [[8, 5]]; f.hero.inputBuffer = ['right'];
  f.fire(); f.impact();
  assert.equal(f.enemy.healthPoints, 0);
  assert.equal(f.context.entities.includes(f.enemy), false);
  assert.equal(f.context.kills, 1);
  assert.equal(f.hero.earnedXp, 5);
  assert.equal(f.context.pendingFall, true, 'recoil queues the normal player fall');
  assert.equal(f.hero.x, 2);
  assert.equal(f.hero.healthPoints, 30, 'arrival, not blast impact, applies fall damage');
  assert.deepEqual(f.hero.walkPath, []); assert.deepEqual(f.hero.inputBuffer, []);
  const loot = f.context.chasmFallenItems.get(3)[0];
  assert.ok(loot instanceof Loot);
  assert.equal(f.context.entities.includes(loot), false);
  f.context.floor = 3;
  f.context.scene = undefined; // Placement supports headless floor construction.
  const placed = placeChasmFallen(f.context, f.level, new Set(['3,5']), 14);
  assert.deepEqual(placed, [loot]);
  assert.notEqual(f.tiles.getFeature(loot.x, loot.y), 'chasm');
  assert.equal(f.level[loot.y][loot.x], 0);
  assert.deepEqual(placeChasmFallen(f.context, f.level, new Set(), 14), []);
}

// Levitation protects either side; large bodies fall when any occupied cell
// crosses the rim, even when their anchor remains on solid ground.
for (const player of [false, true]) {
  const f = fixture(4);
  const actor = player ? f.hero : f.enemy;
  effects.applyEffect(actor, effects.createLevitatingEffect());
  f.tiles.setFeature(player ? 2 : 5, 5, 'chasm');
  f.fire(); f.impact();
  assert.equal(actor.healthPoints, player ? 30 : 10);
  assert.ok(f.context.entities.includes(actor));
  assert.ok(!f.context.pendingFall);
}
{
  const f = fixture(5);
  Object.defineProperty(f.enemy, 'footprint', { value: { width: 2, height: 2, originX: 0, originY: 0 } });
  f.tiles.setFeature(7, 6, 'chasm');
  f.fire(); f.impact();
  assert.equal(f.enemy.healthPoints, 0);
  assert.equal(f.context.chasmFallenItems.get(3).length, 1);
}

// Invalid/empty shots retain existing targeting and charge rules.
{
  const f = fixture();
  f.level[5][4] = 1;
  f.fire(); f.impact();
  assert.equal(f.wand.charges, 3);
  assert.equal(f.hero.nextActionTime, 0);
  assert.equal(f.enemy.x, 5);
}
{
  const f = fixture();
  f.context.entities = [f.hero];
  f.fire(); f.impact();
  assert.equal(f.wand.charges, 2);
  assert.equal(f.hero.x, 3);
  assert.equal(f.hero.moving, false);
}

// Stuns skip exactly three actions on both sides and do not expire on world
// ticks. Healing can cure them; save restoration retains remaining actions.
for (const player of [false, true]) {
  const f = fixture();
  const actor = player ? f.hero : f.enemy;
  let turns = 0;
  actor.turn = () => { turns++; };
  f.hero.turn = () => { if (player) turns++; };
  if (player) f.enemy.turn = () => f.enemy.spendTime('wait');
  for (const entity of f.context.entities) {
    entity.refresh = () => {};
    entity.tickEffects = () => effects.tickEffects(entity, f.context);
  }
  const manager = new TurnManager({ ...effects, log() {} });
  manager.reset(f.context.entities);
  effects.applyEffect(actor, effects.createStunnedEffect());
  f.context.simulationTime = 10;
  effects.tickEffects(actor, f.context);
  assert.equal(actor.effects[0].duration, 3);
  const saved = JSON.parse(JSON.stringify(actor.effects));
  const { restoreEffects } = load('saveEffects', { effects, ChaliceOfBlood: class {} });
  actor.effects = restoreEffects(saved);
  if (!player) f.hero.nextActionTime = 4;
  manager.update(f.context.entities);
  assert.equal(turns, 1, 'first real action after the three skipped actions');
  assert.equal(effects.hasEffect(actor, 'stunned'), false);
  assert.equal(actor.nextActionTime, 3);
  effects.applyEffect(actor, effects.createStunnedEffect());
  assert.deepEqual(effects.cureDebuffs(actor), ['Stunned']);
}
console.log('Rogue0 wand blast: firing, walls/stuns, recoil, diagonals, roots/bodies, flight, large bodies, chasm loot, scheduler and effect persistence passed');
