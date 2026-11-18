import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('throw-past-sight');
import assert from 'node:assert/strict';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';
import { createTerrain } from '../src/games/rogue0/terrain.ts';
import {
  bresenhamLine, hasLineOfSight, projectileLandingTile,
} from '../src/games/rogue0/fov.ts';

const load = (name, bindings) => loadLogic(`src/games/rogue0/${name}.ts`, bindings);

// A thrown object is a physical projectile, not an optical sight check.
const corridor = Array.from({ length: 5 }, (_, y) =>
  Array.from({ length: 24 }, (_, x) => (y === 0 || y === 4 || x === 0 ? 1 : 0)));
const terrain = createTerrain();

assert.deepEqual(projectileLandingTile(corridor, 1, 2, 20, 2, terrain), [20, 2],
  'a clear path carries the object all the way to the target');
corridor[2][10] = 1;
assert.deepEqual(projectileLandingTile(corridor, 1, 2, 20, 2, terrain), [9, 2],
  'a wall stops the object in the last free cell before it');
corridor[2][10] = 0;
terrain.setFeature(10, 2, 'grass');
assert.equal(hasLineOfSight(corridor, 1, 2, 20, 2, terrain), false,
  'tall grass hides the target from sight');
assert.deepEqual(projectileLandingTile(corridor, 1, 2, 20, 2, terrain), [20, 2],
  'tall grass never stops a thrown object');
terrain.setFeature(10, 2, 'door', { door: 'closed' });
assert.deepEqual(projectileLandingTile(corridor, 1, 2, 20, 2, terrain), [10, 2],
  'an object lands on a closed door so it can knock it open');
terrain.setFeature(10, 2, 'secretDoor');
assert.deepEqual(projectileLandingTile(corridor, 1, 2, 20, 2, terrain), [9, 2],
  'a disguised door stops the object just short of it');
terrain.clearAllFeatures();

// ---- Real throwAt: sight never gates a throw, solid terrain ends the flight ----
const level = Array.from({ length: 7 }, (_, y) =>
  Array.from({ length: 24 }, (_, x) => (y === 0 || y === 6 || x === 0 ? 1 : 0)));
const messages = [];
const dungeon = {
  log: (_context, message) => messages.push(message),
  getCurrentLevel: () => level,
  firstActorInPath(context, attacker, tx, ty) {
    const points = bresenhamLine(attacker.x, attacker.y, tx, ty);
    for (const [x, y] of points.slice(1)) {
      const actor = context.entities.find(entity =>
        (entity.type === 'enemy' || entity.type === 'player') && entity !== attacker &&
        (entity.healthPoints ?? 0) > 0 && entity.x === x && entity.y === y);
      if (actor) return actor;
    }
    return undefined;
  },
  openDoor(x, y) { terrain.setDoorState(x, y, 'open'); return true; },
  triggerArrowTrap() {},
  entityAtTile: () => undefined,
  procWandCurse: () => false,
};
const { Entity } = load('entity');
const Hero = load('classes/basicHero', {
  Entity, Wand: class {}, dungeon,
  terrainFor: () => terrain,
  isHostile: entity => entity?.type === 'enemy',
  removeEntity: (context, item) => {
    context.entities = context.entities.filter(entity => entity !== item);
  },
}).default;

function sprite() {
  return { tint: 0xffffff, setOrigin() { return this; }, setDepth() { return this; },
    destroy() {} };
}
function fixture({ visibleTiles = new Set(), entities = [] } = {}) {
  messages.length = 0;
  terrain.clearAllFeatures();
  for (const row of level) row.fill(0);
  for (let y = 0; y < level.length; y++) { level[y][0] = 1; }
  level[0].fill(1); level[6].fill(1);
  const context = {
    entities, messages, visibleTiles, floor: 1,
    map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 },
    scene: { add: { sprite }, tweens: { add(opts) { opts.onComplete?.(); }, killTweensOf() {} } },
  };
  const stone = { type: 'item', name: 'Stone', displayName: 'Stone', count: 1,
    consumable: false, x: undefined, y: undefined };
  context.entities.push(stone);
  const hero = Object.assign(Object.create(Hero.prototype), {
    context, x: 1, y: 3, turns: 0, backpack: [stone],
    canAct: () => true, spendTurn() { this.turns += 1; }, refreshUI() {},
  });
  context.entities.push(hero);
  context.throwMode = true;
  context.throwItem = stone;
  return { context, hero, stone };
}

// A stone thrown into total darkness, along a clear path, still reaches its tile.
{
  const { context, hero, stone } = fixture();
  assert.equal(context.visibleTiles.size, 0);
  hero.throwAt(20, 3);
  assert.equal(stone.x, 20, 'an unseen destination does not block the throw');
  assert.equal(stone.y, 3);
  assert.equal(hero.turns, 1, 'the throw spends a turn');
  assert.equal(context.throwMode, false, 'throwing ends targeting');
  assert.equal(messages.some(line => /can't throw there/.test(line)), false,
    'a valid throw is not rejected');
}

// Tall grass hides the target, but the stone flies straight through it.
{
  const { hero, stone } = fixture();
  terrain.setFeature(10, 3, 'grass');
  assert.equal(hasLineOfSight(level, 1, 3, 20, 3, terrain), false,
    'the destination really is out of sight');
  hero.throwAt(20, 3);
  assert.deepEqual([stone.x, stone.y], [20, 3], 'grass does not stop the stone');
  assert.equal(hero.turns, 1);
  terrain.clearAllFeatures();
}

// A stone aimed past a wall bumps into it and lands on the near side instead
// of being rejected outright.
{
  const { hero, stone } = fixture();
  level[3][10] = 1;
  hero.throwAt(20, 3);
  level[3][10] = 0;
  assert.deepEqual([stone.x, stone.y], [9, 3], 'the stone stops against the wall');
  assert.equal(hero.turns, 1, 'bumping into a wall still spends the throw');
  assert.equal(messages.some(line => /can't throw there/.test(line)), false,
    'a blocked flight is not a rejected throw');
}

// A closed door stops the flight, but the stone knocks it open and lands there.
{
  const { hero, stone } = fixture();
  terrain.setFeature(10, 3, 'door', { door: 'closed' });
  hero.throwAt(20, 3);
  assert.deepEqual([stone.x, stone.y], [10, 3], 'the stone lands in the doorway');
  assert.equal(terrain.getDoorState(10, 3), 'open', 'the impact opens the door');
  assert.ok(messages.some(line => /knocks the door open/.test(line)));
}

// An unseen creature intercepts the stone before it reaches the aimed tile.
{
  const enemy = { type: 'enemy', name: 'Goblin', x: 12, y: 3, healthPoints: 10,
    resistance: {}, vulnerability: {}, onAttacked() {} };
  const { hero, stone } = fixture({ entities: [] });
  terrain.setFeature(8, 3, 'grass');
  hero.context.entities.push(enemy);
  assert.equal(hasLineOfSight(level, 1, 3, 12, 3, terrain), false,
    'the creature is hidden from the hero');
  hero.throwAt(20, 3);
  assert.deepEqual([stone.x, stone.y], [12, 3], 'the stone hits the hidden creature');
  assert.ok(messages.some(line => /at Goblin/.test(line)));
  terrain.clearAllFeatures();
}

// Tiles outside the map remain invalid targets.
{
  const { hero, stone } = fixture();
  hero.throwAt(30, 30);
  assert.equal(stone.x, undefined, 'no object is consumed by an off-map throw');
  assert.equal(hero.turns, 0, 'an off-map throw costs no turn');
  assert.match(messages.at(-1), /can't throw there/);
}

console.log('Rogue0 throw past sight: stones fly beyond vision and stop only at solid blockers');
