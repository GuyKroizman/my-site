import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('potion-splash');
import assert from 'node:assert/strict';

import { loadLogic } from './lib/rogue0-logic-loader.mjs';
import { potionSplashCells } from '../src/games/rogue0/potionSplash.ts';
import { createTerrain } from '../src/games/rogue0/terrain.ts';

// A 12x12 open room with an optional closed door on (6,5).
function room(withDoor = false) {
  const map = Array.from({ length: 12 }, () => Array(12).fill(0));
  for (let i = 0; i < 12; i++) {
    map[0][i] = 1; map[11][i] = 1; map[i][0] = 1; map[i][11] = 1;
  }
  const context = { currentLevel: map, messages: [] };
  const terrain = createTerrain(context);
  context.terrainObj = terrain;
  if (withDoor) terrain.setFeature(6, 5, 'door');
  return { map, context, terrain };
}

// --- 4x4 splash shape, anchored upper-left of centre ---
{
  const { map, context, terrain } = room();
  const { origin, cells } = potionSplashCells(map, terrain, 5, 5, 2, 5);
  assert.deepEqual(origin, { x: 5, y: 5 });
  assert.equal(cells.length, 16, 'an open room takes the full 4x4 splash');
  assert.ok(cells.some(c => c.x === 4 && c.y === 4), 'splash extends up-left');
  assert.ok(cells.some(c => c.x === 7 && c.y === 7), 'splash reaches the fourth cell');
  assert.ok(!cells.some(c => c.x === 8 || c.y === 8), 'splash stops after four cells');
}

// --- Walls clip the splash instead of leaking around corners ---
{
  const { map, context, terrain } = room();
  for (let y = 4; y <= 7; y++) map[y][7] = 1; // wall beside the impact
  const { cells } = potionSplashCells(map, terrain, 5, 5, 2, 5);
  assert.ok(!cells.some(c => c.x >= 7), 'a wall shadows the cells behind it');
  assert.equal(cells.length, 12);
}

// --- A bottle thrown at a closed door breaks on the thrower's side ---
{
  const { map, context, terrain } = room(true);
  const { origin, cells } = potionSplashCells(map, terrain, 6, 5, 3, 5);
  assert.deepEqual(origin, { x: 5, y: 5 }, 'the splash centre is pulled back off the door');
  assert.ok(!cells.some(c => c.x === 6 && c.y === 5), 'the door tile itself is not splashed');
}

// --- Hero landing resolution: objects open doors, potions burst ---
const logs = [];
const traps = [];
const removed = [];
const applied = [];
const dungeon = {
  log(_context, text) { logs.push(text); },
  triggerArrowTrap(_context, x, y) { traps.push([x, y]); },
  openDoor(x, y) { this.opened ??= []; this.opened.push([x, y]); return true; },
  onTerrainChanged() { this.changed = true; }
};
const Hero = loadLogic('src/games/rogue0/classes/basicHero.ts', {
  Entity: class Entity { init() {} },
  dungeon,
  removeEntity: (_context, entity) => { removed.push(entity); },
  applyEffect: (entity, effect) => { applied.push({ entity, effect }); },
  createBurningEffect: duration => ({ id: 'burning', duration }),
  createFrozenEffect: duration => ({ id: 'frozen', duration }),
  createChilledEffect: duration => ({ id: 'chilled', duration }),
  createPoisonedEffect: duration => ({ id: 'poisoned', duration }),
  terrainFor: context => context.terrainObj,
}).default;

function scene() {
  return {
    add: { sprite: () => ({ setOrigin() { return this; }, setDepth() { return this; }, destroy() {} }) },
    tweens: { add() {}, killTweensOf() {} }
  };
}
function setup({ withDoor = false, entities = [] } = {}) {
  const { map, context, terrain } = room(withDoor);
  Object.assign(context, {
    entities, map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 },
    scene: scene(), visibleTiles: new Set(),
    mapTile: map, terrain
  });
  const hero = Object.assign(Object.create(Hero.prototype), {
    context, x: 2, y: 5, name: 'Hero'
  });
  return { context, hero };
}
function monster(name, damageType, x, y) {
  return {
    type: 'enemy', name, damageType, x, y, healthPoints: 20,
    resistance: {}, vulnerability: {}, effects: [],
    onAttacked() {}, takeDamage(amount) { this.healthPoints -= amount; }
  };
}
const potion = (name, texture = 'potion-3') => ({
  type: 'item', name, displayName: name, consumable: true, textureKey: texture, count: 1
});

// A ring thrown at a closed door opens it and lands in the doorway.
{
  logs.length = 0; traps.length = 0; removed.length = 0;
  dungeon.opened = [];
  const { context, hero } = setup({ withDoor: true });
  const ring = { type: 'item', name: 'Ring of Might', displayName: 'Ring of Might',
    equipSlot: 'ring', consumable: false, count: 1 };
  context.entities.push(ring);
  hero.resolveThrowLanding(ring, 6, 5);
  assert.deepEqual(dungeon.opened, [[6, 5]], 'the object knocks the door open');
  assert.ok(logs.some(line => /knocks the door open/.test(line)));
  assert.equal(ring.x, 6, 'the item lands in the opened doorway');
  assert.equal(context.terrain.getDoorState(6, 5), 'closed', 'the stub door state is unchanged');
}

// A Liquid Flame flask burns every creature in its 4x4 splash, not only the
// monster it hit, and scorches the grass inside the area.
{
  logs.length = 0; applied.length = 0; removed.length = 0;
  const hit = monster('Goblin', 'physical', 5, 5);
  const neighbour = monster('Rat', 'physical', 6, 6);
  const outside = monster('Bat', 'physical', 8, 8);
  const { context, hero } = setup({ entities: [hit, neighbour, outside] });
  context.terrain.setFeature(4, 4, 'grass');
  context.terrain.setFeature(8, 8, 'grass');
  const flask = potion('Potion of Liquid Flame', 'potion-red');
  context.entities.push(flask);
  context.onCreatePoisonGas = () => assert.fail('fire does not release gas');
  hero.resolveThrowLanding(flask, 5, 5);
  const burning = applied.filter(a => a.effect.id === 'burning').map(a => a.entity.name);
  assert.deepEqual(burning.sort(), ['Goblin', 'Rat'], 'the whole 4x4 splash ignites');
  assert.equal(applied.find(a => a.effect.id === 'burning').effect.duration, 4,
    'thrown fire keeps its longer burn');
  assert.equal(outside.effects.length, 0, 'creatures outside the splash are untouched');
  assert.ok(!context.terrain.getFeature(4, 4), 'grass in the splash burns away');
  assert.equal(context.terrain.getFeature(8, 8), 'grass', 'grass outside is untouched');
  assert.deepEqual(removed, [flask], 'the flask is consumed');
  assert.deepEqual(traps, [[6, 5], [5, 5]], 'the doorway and splash probe traps');
}

// Frost chills a group, freezes the water in its own 4x4 area only, and keeps
// the direct ice damage against fire elementals.
{
  logs.length = 0; applied.length = 0; removed.length = 0;
  const elemental = monster('Fire Elemental', 'fire', 5, 5);
  elemental.healthPoints = 20;
  const friend = monster('Goblin', 'physical', 4, 4);
  const { context, hero } = setup({ entities: [elemental, friend] });
  context.terrain.setFeature(6, 6, 'water');
  context.terrain.setFeature(9, 9, 'water');
  const flask = potion('Potion of Frost', 'potion-blue');
  context.entities.push(flask);
  hero.resolveThrowLanding(flask, 5, 5);
  assert.ok(applied.some(a => a.entity === elemental && a.effect.id === 'frozen'));
  assert.ok(applied.some(a => a.entity === friend && a.effect.id === 'frozen'),
    'a non-fire neighbour is frozen by the splash');
  assert.ok(applied.some(a => a.entity === friend && a.effect.id === 'chilled'),
    'the splash also chills')
  assert.equal(elemental.healthPoints, 16, 'fire elementals take the direct 4 ice damage');
  assert.equal(context.terrain.getFeature(6, 6), 'ice', 'water inside the splash freezes');
  assert.equal(context.terrain.getFeature(9, 9), 'water', 'water outside the splash stays liquid');
}

// Toxic gas seeds the same expanding cloud, poisons the target and clips at a
// closed door instead of gassing the room behind it.
{
  logs.length = 0; applied.length = 0; removed.length = 0;
  const seeds = [];
  const hit = monster('Goblin', 'physical', 5, 5);
  const { context, hero } = setup({ entities: [hit] });
  context.onCreatePoisonGas = (x, y) => { seeds.push([x, y]); return 1; };
  const flask = potion('Potion of Toxic Gas', 'potion-green');
  context.entities.push(flask);
  hero.resolveThrowLanding(flask, 5, 5);
  assert.deepEqual(seeds, [[5, 5]], 'the cloud starts at the impact tile');
  assert.ok(applied.some(a => a.entity === hit && a.effect.id === 'poisoned'));
  assert.deepEqual(removed, [flask]);

  const doorSeeds = [];
  const doorSetup = setup({ withDoor: true });
  doorSetup.context.onCreatePoisonGas = (x, y) => { doorSeeds.push([x, y]); return 1; };
  const doorFlask = potion('Potion of Toxic Gas', 'potion-green');
  doorSetup.context.entities.push(doorFlask);
  doorSetup.hero.resolveThrowLanding(doorFlask, 6, 5);
  assert.deepEqual(doorSeeds, [[5, 5]], 'the gas starts on the thrower side of a closed door');
}

console.log('Rogue0 potion splash: door knocks, 4x4 fire/frost areas, gas clouds and door clipping passed');
