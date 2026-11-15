import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('swarm');
import assert from 'node:assert/strict';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
import { actorOrigin } from '../src/games/rogue0/rendering.ts';
import { forgetInspectedEntity } from '../src/games/rogue0/context.ts';
import { actionCost } from '../src/games/rogue0/timing.ts';

const tiles = load('src/games/rogue0/tiles.ts');
const { Entity } = load('src/games/rogue0/entity.ts', { actionCost });
Entity.prototype.init = function (context, x, y) {
  this.context = context;
  this.x = x;
  this.y = y;
  this.sprite = {
    setScale() { this.scale = arguments[0]; return this; },
    setOrigin() { return this; },
    setDepth() { return this; },
    setPosition() { return this; },
    destroy() {},
  };
};

const map = Array.from({ length: 10 }, () => Array(10).fill(0));
let attacks = 0;
let moves = 0;
const dungeon = {
  getCurrentLevel: () => map,
  log() {},
  canStepBetween: (x, y, nx, ny) => Math.max(Math.abs(nx - x), Math.abs(ny - y)) === 1,
  isWalkableTile: (ctx, x, y) => map[y]?.[x] === 0 && !ctx.entities.some(e =>
    e.healthPoints > 0 && e.x === x && e.y === y && e.type !== 'item'),
  moveEntityTo(_ctx, e, x, y) { e.x = x; e.y = y; moves++; },
  findPath: (x, y, tx, ty) => x === tx && y === ty
    ? [[x, y]]
    : [[x, y], [x + Math.sign(tx - x), y + Math.sign(ty - y)]],
  firstActorInPath: () => undefined,
  attackEntity(_ctx, attacker, victim, tile) { attacks++; },
  openDoor: () => false,
  confusedMove: () => false,
};

const hasEffect = (e, id) => (e.effects ?? []).some(effect => effect.id === id);
const ai = load('src/games/rogue0/ai.ts', {
  dungeon, tiles, canSee: () => true, hasEffect, fleeStep: () => false,
});

const Gold = class { constructor(ctx, x, y, gold) { this.name = 'Gold'; this.x = x; this.y = y; this.gold = gold; } };
const PotionOfHealing = class { constructor(ctx, x, y) { this.name = 'Potion of Healing'; this.x = x; this.y = y; } };
const Phaser = { Math: { Between: () => 1 } };

const Monster = load('src/games/rogue0/monsters/monster.ts', {
  Entity, actorOrigin, dungeon, ...ai, Gold, Phaser,
}).default;

const SwarmOfFlies = load('src/games/rogue0/monsters/swarmOfFlies.ts', {
  Monster, dungeon, tiles, swarmTurn: ai.swarmTurn, Gold, PotionOfHealing, Phaser,
  FLY_SWARM_TEXTURE: 'monster-fly-swarm', generateFlySwarmTexture: () => {}, forgetInspectedEntity,
}).default;

function setup(swarmX = 5, swarmY = 3) {
  attacks = 0;
  moves = 0;
  const context = {
    entities: [], messages: [], visibleTiles: new Set(), scene: undefined, kills: 0,
  };
  const player = { type: 'player', x: 3, y: 3, healthPoints: 20, effects: [], gainXp() {} };
  context.player = player;
  context.entities.push(player);
  const swarm = new SwarmOfFlies(context, swarmX, swarmY);
  context.entities.push(swarm);
  swarm.wakeUp();
  return { context, player, swarm };
}

// Natural flight (distinct from the temporary levitating status effect).
{
  const { swarm } = setup();
  assert.equal(swarm.flying, true, 'swarms are naturally airborne');
  assert.equal(swarm.isFlying, true, 'isFlying reports natural flight');
  assert.equal(swarm.healthPoints, 28, 'parent swarm has 28 health');
  assert.equal(swarm.attack(), 6, 'damage is tripled from 2 to 6');
}

// Physical hero hits split a living swarm and preserve its remaining health pool.
{
  const { context, player, swarm } = setup();
  swarm.takeDamage(3); // 28 -> 25
  swarm.onHitBy(player, 'physical', 3);
  const enemies = context.entities.filter(e => e.type === 'enemy');
  assert.equal(enemies.length, 2, 'a physical hit splits the swarm in two');
  assert.equal(context.entities.includes(swarm), false, 'the parent is replaced');
  assert.equal(enemies.reduce((sum, e) => sum + e.healthPoints, 0), 25,
    'the remaining health pool is split between offspring');
  for (const e of enemies) {
    assert.equal(e.isFlying, true, 'offspring keep flying');
    assert.equal(e.attack(), 6, 'offspring keep tripled damage without multiplying it again');
  }
}

// Magical damage and non-player attackers never split the swarm.
{
  const { context, player, swarm } = setup();
  swarm.takeDamage(3);
  swarm.onHitBy(player, 'magic', 3);
  assert.equal(context.entities.filter(e => e.type === 'enemy').length, 1,
    'magical damage does not split');
  assert.equal(context.entities.includes(swarm), true, 'the swarm survives magic');
}

// A 1-health swarm is too small to split, preventing infinite splitting.
{
  const { context, player, swarm } = setup();
  swarm.takeDamage(27); // 28 -> 1
  swarm.onHitBy(player, 'physical', 27);
  assert.equal(context.entities.filter(e => e.type === 'enemy').length, 1,
    'a 1-health swarm cannot split');
}

// Kills drop only a Potion of Healing, at a 33% chance.
{
  const { context, swarm } = setup();
  const oldRandom = Math.random;
  try {
    Math.random = () => 0.32; // just below the 0.33 threshold
    swarm.onDestroy();
  } finally {
    Math.random = oldRandom;
  }
  assert.equal(context.entities.some(e => e.name === 'Potion of Healing'), true,
    'killed swarm drops a healing potion');
  assert.equal(context.kills, 1, 'kills are still counted');
}

// Flies never carry gold: an unlucky roll drops nothing at all.
{
  const { context, swarm } = setup();
  swarm.gold = 10;
  const oldRandom = Math.random;
  try {
    Math.random = () => 0.34; // just above the 0.33 threshold
    swarm.onDestroy();
  } finally {
    Math.random = oldRandom;
  }
  assert.equal(context.entities.length, 2,
    'a failed roll drops neither a potion nor gold');
  assert.equal(context.kills, 1, 'kills are still counted');
}

// Swarming AI: an adjacent swarm attacks; otherwise it moves to box the hero in.
{
  const { context, swarm, player } = setup(4, 3); // already adjacent
  swarm.turn();
  assert.equal(attacks, 1, 'adjacent swarm attacks');
  assert.equal(moves, 0, 'adjacent swarm does not move');
  assert.equal(swarm.nextActionTime, 1, 'attacking spends exactly one action');

  const second = setup(5, 3); // two tiles away, an open ring tile ahead
  second.swarm.actionReady = true;
  second.swarm.turn();
  assert.equal(second.swarm.nextActionTime, 1, 'surround movement spends a turn, not just an animation');
  assert.equal(second.swarm.actionReady, false, 'a chasing swarm relinquishes its action');
  assert.equal(attacks, 0, 'distant swarm does not attack yet');
  assert.equal(moves, 1, 'distant swarm advances one tile');
  const cheb = Math.max(Math.abs(second.swarm.x - second.player.x), Math.abs(second.swarm.y - second.player.y));
  assert.equal(cheb, 1, 'swarm steps onto a tile adjacent to the hero');
  assert.notDeepEqual([second.swarm.x, second.swarm.y], [second.player.x, second.player.y],
    'swarm boxes in instead of occupying the hero');
}

// Surrounding obeys the same movement costs as other AI paths. A door is a
// fixed-cost action even when the fly's ordinary movement is faster/slower.
for (const [effect, speed, expectedCost, door] of [
  [undefined, 2, 0.5, false],
  ['haste', 1, 0.5, false],
  ['chilled', 1, 2, false],
  [undefined, 2, 1, true],
  ['chilled', 1, 1, true],
]) {
  const { swarm } = setup(7, 3);
  swarm.movementSpeed = speed;
  if (effect) swarm.effects.push({ id: effect });
  swarm.actionReady = true;
  const originalOpenDoor = dungeon.openDoor;
  try {
    if (door) {
      // The straight-line fixture's first step toward the surrounding ring.
      tiles.setFeature(6, 2, 'door', { door: 'closed' });
      dungeon.openDoor = (x, y) => {
        assert.deepEqual([x, y], [6, 2]);
        tiles.setDoorState(x, y, 'open');
        return true;
      };
    }
    swarm.turn();
    assert.equal(moves, 1);
    assert.equal(attacks, 0);
    assert.equal(swarm.nextActionTime, expectedCost, `${effect ?? 'normal'} surround cost, door=${door}`);
    assert.equal(swarm.actionReady, false);
    if (door) assert.equal(tiles.getDoorState(6, 2), 'open');
  } finally {
    dungeon.openDoor = originalOpenDoor;
    tiles.clearAllFeatures();
  }
}

console.log('Rogue0 swarm of flies: flight, splitting, magical immunity, potion drops, swarming AI and action costs passed');
