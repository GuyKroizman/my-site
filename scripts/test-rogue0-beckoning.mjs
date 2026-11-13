import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('beckoning');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import PF from 'pathfinding';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
import { encodeGraph, decodeGraph } from '../src/games/rogue0/saveCodec.ts';

const { actionCost } = load('src/games/rogue0/timing.ts');
const { Entity, removeEntity } = load('src/games/rogue0/entity.ts', { actionCost });
Entity.prototype.init = function(context, x, y) { Object.assign(this, { context, x, y }); };
const tiles = load('src/games/rogue0/tiles.ts');
const sight = load('src/games/rogue0/fov.ts', tiles);
const hasEffect = (e, id) => e.effects.some(effect => effect.id === id);
const dungeon = load('src/games/rogue0/dungeon.ts', { PF, tiles, hasEffect, ...sight }).default;
// Keep real pathfinding, sight, body clearance and occupancy; replace display,
// audio and combat presentation only.
dungeon.moveEntityTo = (_context, e, x, y) => { e.x = x; e.y = y; };
dungeon.openDoor = (x, y) => { tiles.setDoorState(x, y, 'open'); return true; };
dungeon.log = (context, text) => context.messages.push(text);
let attacked;
dungeon.attackEntity = (_context, _attacker, victim) => { attacked = victim; };
const ai = load('src/games/rogue0/ai.ts', { dungeon, tiles, ...sight, hasEffect, fleeStep: () => false });
const Monster = load('src/games/rogue0/monsters/monster.ts', {
  Entity, ...ai, dungeon, Gold: class {}, Phaser: { Math: { Between: () => 8 } },
}).default;
const Mimic = load('src/games/rogue0/monsters/mimic.ts', {
  Monster, CHEST_TEXTURE: 'chest', MIMIC_TEXTURE: 'mimic',
}).default;
const Scroll = load('src/games/rogue0/items/ScrollOfBeckoning.ts', { Entity, removeEntity, dungeon }).default;
const config = { name: 'Listener', description: '', healthPoints: 10, movementSpeed: 1,
  attackDelay: 1, visionRadius: 5, attackDamage: 1, protection: 0, range: 0 };
function setup(turn = ai.enemyTurn) {
  tiles.clearAllFeatures();
  const map = Array.from({ length: 20 }, () => Array(20).fill(0));
  const context = { entities: [], messages: [], simulationTime: 0, visibleTiles: new Set() };
  const player = Object.assign(new Entity(), { context, type: 'player', x: 7, y: 2,
    healthPoints: 10, effects: [{ id: 'invisible' }], backpack: [] });
  player.removeItem = item => { player.backpack = player.backpack.filter(e => e !== item); };
  context.player = player;
  const monster = new Monster(context, config, 2, 2);
  monster.turn = function() { if (!this.waitWhileSleeping()) turn(this); };
  context.entities = [player, monster];
  dungeon.context = context;
  dungeon.currentLevel = map;
  dungeon.pathGrid = new PF.Grid(map);
  dungeon.diagonalFinder = new PF.AStarFinder({ diagonalMovement: PF.DiagonalMovement.Always });
  attacked = undefined;
  return { context, player, monster, map };
}
function read(context) {
  const scroll = new Scroll(context);
  context.player.backpack.push(scroll);
  context.entities.push(scroll);
  scroll.equip();
  assert.ok(!context.player.backpack.includes(scroll), 'reading consumes the carried scroll');
  assert.ok(!context.entities.includes(scroll), 'reading removes the floor entity too');
  return scroll;
}

for (const turn of [ai.enemyTurn, ai.swarmTurn]) {
  // Call has unlimited floor-local range and wakes sleepers, but not corpses,
  // items, illusions, future spawns or actors stored on another floor.
  {
    const { context, player, monster } = setup(turn);
    const far = new Monster(context, config, 18, 18);
    const dead = new Monster(context, config, 3, 8); dead.healthPoints = 0;
    const decoy = new Monster(context, config, 4, 8); decoy.isDecoy = true;
    const loot = Object.assign(new Entity(), { type: 'item', x: 5, y: 8, healthPoints: 1 });
    const offFloor = new Monster({ ...context, entities: [] }, config, 2, 2);
    context.entities.push(far, dead, decoy, loot);
    read(context);
    for (const e of [monster, far]) {
      assert.deepEqual(e.beckoningTarget, { x: 7, y: 2 });
      assert.equal(e.sleeping, false);
      assert.equal(e.awareOfPlayer, false, 'call does not grant sight');
    }
    const later = new Monster(context, config, 10, 10);
    context.entities.push(later);
    for (const e of [dead, decoy, loot, offFloor, later]) assert.equal(e.beckoningTarget, undefined);
    Object.assign(player, { x: 19, y: 19 });
    monster.hearNoise(1, 1);
    monster.turn();
    assert.deepEqual(monster.beckoningTarget, { x: 7, y: 2 }, 'movement and other noises cannot move the call');
    assert.equal(monster.x, 3);
    for (let i = 0; i < 10 && monster.beckoningTarget; i++) monster.turn();
    assert.equal(monster.beckoningTarget, undefined, 'arrival ends investigation');
    assert.equal(monster.lastSeenX, undefined, 'arrival does not revive stale pursuit');
    const random = Math.random;
    try {
      Math.random = () => 0;
      const before = [monster.x, monster.y];
      monster.turn();
      assert.notDeepEqual([monster.x, monster.y], before, 'resumes ordinary roaming');
    } finally { Math.random = random; }
  }
  {
    const { context, player, monster } = setup(turn);
    read(context);
    Object.assign(player, { x: 3, y: 2, effects: [] });
    monster.turn();
    assert.equal(attacked, player, 'seeing an adjacent hero immediately switches to attack');
    assert.equal(monster.beckoningTarget, undefined);
    assert.deepEqual([monster.lastSeenX, monster.lastSeenY], [3, 2]);
    player.effects = [{ id: 'invisible' }];
    monster.turn();
    assert.equal(monster.beckoningTarget, undefined, 'losing sight never restores the call');
  }
  {
    const { context, player, monster } = setup(turn);
    read(context);
    Object.assign(player, { x: 2, y: 6, effects: [] });
    monster.turn();
    assert.equal(monster.beckoningTarget, undefined);
    assert.ok(monster.y > 2, 'visible hero overrides the scroll destination for pursuit too');
  }
  {
    const { context, player, monster, map } = setup(turn);
    // A wall with one closed doorway forces the call to route through it.
    for (let y = 0; y < 20; y++) map[y][4] = y === 2 ? 0 : 1;
    dungeon.pathGrid = new PF.Grid(map);
    tiles.setFeature(4, 2, 'door');
    tiles.setDoorState(4, 2, 'closed');
    dungeon.pathGrid.setWalkableAt(4, 2, false);
    read(context);
    Object.assign(player, { x: 19, y: 19 });
    const blocker = new Monster(context, config, 3, 2);
    context.entities.push(blocker);
    monster.turn();
    assert.deepEqual([monster.x, monster.y], [2, 2], 'does not overlap a blocking monster');
    assert.ok(monster.beckoningTarget, 'temporary crowding retains the call');
    blocker.x = 1; blocker.y = 10;
    monster.turn(); monster.turn();
    assert.deepEqual([monster.x, monster.y], [4, 2], 'crosses the closed doorway');
    assert.equal(tiles.getDoorState(4, 2), 'open');
    monster.effects = [{ id: 'rooted' }];
    monster.turn();
    assert.deepEqual([monster.x, monster.y], [4, 2], 'rooting still prevents movement');
    assert.ok(monster.beckoningTarget, 'rooting does not forget destination');
  }
}
{
  const { context, player } = setup();
  const mimic = new Mimic(context, 3, 5);
  context.entities.push(mimic);
  assert.equal(mimic.spriteTextureKey, 'chest');
  const scroll = read(context);
  assert.equal(mimic.spriteTextureKey, 'mimic', 'even dormant mimics answer the call');
  assert.equal(mimic.sleeping, false);
  const before = [mimic.x, mimic.y];
  mimic.turn();
  assert.notDeepEqual([mimic.x, mimic.y], before);
  const registry = { mimic: Mimic, scroll: Scroll };
  const saved = JSON.parse(JSON.stringify(encodeGraph({ mimic, scroll }, registry)));
  const restored = decodeGraph(saved, registry, e => { e.context = context; });
  assert.ok(restored.scroll instanceof Scroll, 'new scroll survives save/load');
  assert.deepEqual(restored.mimic.beckoningTarget, { x: 7, y: 2 }, 'call survives save/load');
  assert.equal(restored.mimic.spriteTextureKey, 'mimic');
  Object.assign(player, { x: 12, y: 12 });
  read(context);
  assert.deepEqual(mimic.beckoningTarget, { x: 12, y: 12 }, 'a second scroll replaces the first destination');
}
// All item entry points and the extra shuffled appearance are registered.
for (const [file, marker] of [
  ['scene0.ts', '[ScrollOfBeckoning, 2]'],
  ['saveRegistry.ts', "'./items/ScrollOfBeckoning.ts:default': ScrollOfBeckoning"],
  ['store/shopItems.ts', "'scroll-beckoning': './items/ScrollOfBeckoning.ts:default'"],
  ['store/shopStock.ts', "'beckoning'"],
]) assert.ok(fs.readFileSync(`src/games/rogue0/${file}`, 'utf8').includes(marker));
assert.ok(fs.existsSync('public/rogue0/items/scroll-beckoning.png'));
console.log('Beckoning: floor-local calls, sleep/mimics, melee/swarm pursuit, arrival, doors, crowding and saves passed.');
