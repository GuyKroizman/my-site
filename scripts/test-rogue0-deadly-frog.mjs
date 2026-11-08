import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('deadly-frog');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
import { pickReinforcementKind } from '../src/games/rogue0/monsterReinforcements.ts';
import { applyAttackResult } from '../src/games/rogue0/combatApplication.ts';
import { UNSEEN_DEATH } from '../src/games/rogue0/combatFeedback.ts';

const { actionCost } = load('src/games/rogue0/timing.ts');
const { Entity, removeEntity } = load('src/games/rogue0/entity.ts', {
  actionCost,
  sfx: { death() {} },
  actorOriginY: () => 0.5,
  worldDepth: () => 0,
  forgetInspectedEntity: () => {},
  tickStatusEffects: () => {},
  CURSE_NAMES: {},
  CURSE_FLAVOR: {}
});
Entity.prototype.init = function(context, x, y) {
  Object.assign(this, { context, x, y, sprite: undefined });
};

const map = Array.from({ length: 9 }, () => Array(9).fill(0));
const dungeon = {
  getCurrentLevel: () => map,
  isWalkableTile: () => true,
  log(context, text) { context.messages.unshift(text); }
};
const Monster = load('src/games/rogue0/monsters/monster.ts', {
  Entity,
  enemyTurn() {},
  enemyCanSeePlayer() {},
  dungeon,
  Gold: class {
    constructor(_context, x, y) { Object.assign(this, { x, y, name: 'Gold' }); }
  },
  stashChasmFallen: () => false,
  Phaser: { Math: { Between: () => 8 } }
}).default;
const {
  DEADLY_FROG_TEXTURE,
  DEADLY_FROG_PIXELS,
  DEADLY_FROG_PALETTE,
  generateDeadlyFrogTexture
} = load('src/games/rogue0/monsters/deadlyFrogTexture.ts');
const DeadlyFrog = load('src/games/rogue0/monsters/deadlyFrog.ts', {
  Monster, dungeon, DEADLY_FROG_TEXTURE, generateDeadlyFrogTexture
}).default;

function makeContext() {
  const gas = [];
  const context = {
    entities: [], messages: [], visibleTiles: new Set(['2,2']), simulationTime: 0, kills: 0,
    player: { gainXp() {}, artifact: undefined },
    onCreatePoisonGas: (x, y) => { gas.push(`${x},${y}`); return 1; }
  };
  return { context, gas };
}

// --- Signature: every surviving wound vents gas, death vents once -----------
{
  const { context, gas } = makeContext();
  const frog = new DeadlyFrog(context, 2, 2);
  assert.equal(frog.name, 'Deadly Frog');
  assert.equal(frog.healthPoints, 14);
  assert.equal(frog.maxHealthPoints, 14);
  assert.equal(frog.healthPoints, frog.maxHealthPoints);
  assert.equal(frog.attackDamage, 3);
  assert.equal(frog.range(), 0);
  assert.equal(frog.textureKey, DEADLY_FROG_TEXTURE);
  assert.equal(frog.poisonImmune, true, 'poison immunity is configured through MonsterConfig');
  assert.equal(gas.length, 0, 'merely spawning does not vent gas');

  frog.takeDamage(3);
  assert.equal(frog.healthPoints, 11);
  assert.deepEqual(gas, ['2,2'], 'surviving a hit releases gas on its tile');
  frog.takeDamage(0);
  assert.deepEqual(gas, ['2,2'], 'zero-damage hits never vent');
  frog.takeDamage(4);
  assert.equal(frog.healthPoints, 7);
  assert.deepEqual(gas, ['2,2', '2,2'], 'each damaging hit vents again');
}

// Lethal damage is vented by the death burst, never twice for one blow.
{
  const { context, gas } = makeContext();
  context.entities = [];
  const frog = new DeadlyFrog(context, 3, 3);
  context.entities.push(frog);
  frog.takeDamage(999);
  context.visibleTiles.add('3,3');
  assert.equal(frog.healthPoints < 0, true);
  assert.equal(gas.length, 0, 'the killing blow defers its cloud to death');
  removeEntity(context, frog);
  assert.deepEqual(gas, ['3,3'], 'death releases exactly one cloud');
  assert.equal(context.kills, 1);
  assert.match(context.messages.join('\n'), /bursts in a cloud of poison gas/);
  assert.match(context.messages.join('\n'), /Deadly Frog was killed/);
  assert.equal(frog.x, undefined);
  assert.equal(frog.y, undefined);
}

// A frog removed without a melee hit (wand kill, chasm, cleanup) still bursts.
{
  const { context, gas } = makeContext();
  const frog = new DeadlyFrog(context, 4, 4);
  context.entities.push(frog);
  removeEntity(context, frog);
  assert.deepEqual(gas, ['4,4']);
}

// An unseen death burst is heard, but neither the frog's name nor its loot
// text is revealed.
{
  const { context, gas } = makeContext();
  context.visibleTiles.clear();
  const frog = new DeadlyFrog(context, 5, 5);
  context.entities.push(frog);
  removeEntity(context, frog);
  assert.deepEqual(gas, ['5,5']);
  assert.deepEqual(context.messages, [UNSEEN_DEATH]);
}

// The shared attack pipeline reaches the frog's vent, including a lethal blow
// that must not double up the gas cloud.
{
  const { context, gas } = makeContext();
  const frog = new DeadlyFrog(context, 2, 2);
  context.entities = [frog];
  const attacker = { type: 'player', effects: [] };
  const hooks = { applyEffect() {}, removeEffect() {}, removeEntity };
  applyAttackResult(context, attacker, frog, {
    hit: true, damage: 3, crit: false, damageType: 'physical', appliedEffects: []
  }, hooks);
  assert.equal(frog.healthPoints, 11);
  assert.deepEqual(gas, ['2,2'], 'a non-lethal pipeline hit vents gas');

  applyAttackResult(context, attacker, frog, {
    hit: true, damage: 99, crit: false, damageType: 'physical', appliedEffects: []
  }, hooks);
  assert.equal(context.entities.includes(frog), false);
  assert.deepEqual(gas, ['2,2', '2,2'], 'a lethal pipeline hit vents exactly one death cloud');
}

// --- Its own gas never poisons it; other creatures are still exposed --------
{
  const tiles = load('src/games/rogue0/tiles.ts');
  const effects = load('src/games/rogue0/effects.ts', { spawnEntityFloatingText() {} });
  const gasLogic = load('src/games/rogue0/gas.ts', { ...tiles, ...effects });
  const level = Array.from({ length: 7 }, () => Array(7).fill(0));
  tiles.clearAllFeatures();
  const context = {
    entities: [], messages: [], visibleTiles: new Set(['2,2']), simulationTime: 0,
    currentLevel: level
  };
  const actor = (x, y, extra = {}) => ({
    context, x, y, type: 'enemy', name: 'actor', healthPoints: 10,
    effects: [], ...extra
  });
  const frog = actor(2, 2, { poisonImmune: true });
  const victim = actor(2, 2);
  const legacyEnemy = actor(2, 2);
  context.entities = [frog, victim, legacyEnemy];

  assert.equal(gasLogic.createPoisonGas(context, level, 2, 2), 1);
  assert.equal(effects.hasEffect(frog, 'poisoned'), false,
    'a poison-immune frog can stand in its own cloud');
  effects.applyEffect(frog, effects.createPoisonedEffect(4));
  assert.equal(effects.hasEffect(frog, 'poisoned'), false,
    'poison immunity covers direct poison sources too');
  assert.equal(effects.hasEffect(victim, 'poisoned'), true);
  assert.equal(effects.hasEffect(legacyEnemy, 'poisoned'), true,
    'actors without the new field still take gas damage');
}

// --- Pixel art and one-time texture generation ------------------------------
{
  assert.equal(DEADLY_FROG_PIXELS.length, 16);
  assert.ok(DEADLY_FROG_PIXELS.every(row => row.length === 16), 'frog art is 16x16');
  const drawn = DEADLY_FROG_PIXELS.join('').replace(/\./g, '');
  assert.ok(drawn.length > 0);
  assert.ok(drawn.length < 256, 'background stays transparent');
  for (const pixel of new Set(drawn)) {
    assert.equal(typeof DEADLY_FROG_PALETTE[pixel], 'number', `palette covers '${pixel}'`);
  }
  assert.notEqual(DEADLY_FROG_PALETTE.B, DEADLY_FROG_PALETTE.W, 'eyes read as pupils on white');

  const generated = [];
  const writes = [];
  const textures = new Set();
  const graphics = {
    fillStyle() {},
    fillRect(...args) { writes.push(args); },
    destroy() {},
    generateTexture(key, width, height) {
      generated.push({ key, width, height });
      textures.add(key);
    }
  };
  const scene = { textures: { exists: key => textures.has(key) }, make: { graphics: () => graphics } };
  generateDeadlyFrogTexture(scene);
  generateDeadlyFrogTexture(scene);
  assert.deepEqual(generated, [{ key: DEADLY_FROG_TEXTURE, width: 16, height: 16 }],
    'the texture is generated only once');
  assert.ok(writes.every(([x, y]) => x >= 0 && x < 16 && y >= 0 && y < 16));
}

// --- Roster wiring: depth-gated spawns and reinforcements -------------------
{
  const floor3Kinds = new Set();
  const floor4Kinds = new Set();
  for (let i = 0; i < 1000; i++) {
    const roll = Math.min(0.9999, i / 1000);
    floor3Kinds.add(pickReinforcementKind(3, () => roll));
    floor4Kinds.add(pickReinforcementKind(4, () => roll));
  }
  assert.equal(floor3Kinds.has('frog'), false, 'frogs start on floor 4, after the floor-3 roster');
  assert.equal(floor4Kinds.has('frog'), true, 'frogs join reinforcement waves from floor 4');

  const scene0 = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
  assert.match(scene0, /const frogCount = roster\(floor >= 4 \? 1 : 0\)/);
  assert.match(scene0, /const roster = \(count: number\) => \(bossFloor \? 0 : count\)/,
    'boss floors suppress the wandering roster');
  assert.match(scene0, /spawnGroup\(DeadlyFrog, frogCount\)/);
  assert.match(scene0, /case "frog": return new DeadlyFrog\(context, x, y\)/);
  assert.match(scene0, /generateDeadlyFrogTexture\(this\)/,
    'resumed frog floors rebuild the generated texture');
  assert.match(fs.readFileSync('src/games/rogue0/saveRegistry.ts', 'utf8'),
    /'\.\/monsters\/deadlyFrog\.ts:default': DeadlyFrog/,
    'saved frogs have a permanent wire ID');
}

console.log('Rogue0 Deadly Frog: damage/death gas, poison immunity, texture art, depth-gated spawns, reinforcement and save wiring passed');
