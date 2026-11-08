import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('swarm');
import assert from 'node:assert/strict';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
import { actorOrigin } from '../src/games/rogue0/rendering.ts';
import { forgetInspectedEntity } from '../src/games/rogue0/context.ts';

const tiles = load('src/games/rogue0/tiles.ts');
const { Entity } = load('src/games/rogue0/entity.ts', { actionCost: () => 1 });
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
  assert.equal(swarm.healthPoints, 16, 'parent swarm has 16 health');
}

// Physical hero hits split a living swarm and preserve its remaining health pool.
{
  const { context, player, swarm } = setup();
  swarm.takeDamage(3); // 16 -> 13
  swarm.onHitBy(player, 'physical', 3);
  const enemies = context.entities.filter(e => e.type === 'enemy');
  assert.equal(enemies.length, 2, 'a physical hit splits the swarm in two');
  assert.equal(context.entities.includes(swarm), false, 'the parent is replaced');
  assert.equal(enemies.reduce((sum, e) => sum + e.healthPoints, 0), 13,
    'the remaining health pool is split between offspring');
  for (const e of enemies) assert.equal(e.isFlying, true, 'offspring keep flying');
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
  swarm.takeDamage(15); // 16 -> 1
  swarm.onHitBy(player, 'physical', 15);
  assert.equal(context.entities.filter(e => e.type === 'enemy').length, 1,
    'a 1-health swarm cannot split');
}

// Kills drop a Potion of Healing on a favorable roll.
{
  const { context, swarm } = setup();
  const oldRandom = Math.random;
  try {
    Math.random = () => 0.1;
    swarm.onDestroy();
  } finally {
    Math.random = oldRandom;
  }
  assert.equal(context.entities.some(e => e.name === 'Potion of Healing'), true,
    'killed swarm drops a healing potion');
  assert.equal(context.kills, 1, 'kills are still counted');
}

// Swarming AI: an adjacent swarm attacks; otherwise it moves to box the hero in.
{
  const { context, swarm, player } = setup(4, 3); // already adjacent
  swarm.turn();
  assert.equal(attacks, 1, 'adjacent swarm attacks');
  assert.equal(moves, 0, 'adjacent swarm does not move');

  const second = setup(5, 3); // two tiles away, an open ring tile ahead
  second.swarm.turn();
  assert.equal(attacks, 0, 'distant swarm does not attack yet');
  assert.equal(moves, 1, 'distant swarm advances one tile');
  const cheb = Math.max(Math.abs(second.swarm.x - second.player.x), Math.abs(second.swarm.y - second.player.y));
  assert.equal(cheb, 1, 'swarm steps onto a tile adjacent to the hero');
  assert.notDeepEqual([second.swarm.x, second.swarm.y], [second.player.x, second.player.y],
    'swarm boxes in instead of occupying the hero');
}

console.log('Rogue0 swarm of flies: flight, splitting, magical immunity, potion drops and swarming AI passed');
