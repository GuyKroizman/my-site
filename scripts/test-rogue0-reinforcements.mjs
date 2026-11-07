import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('reinforcements');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
// Direct import: the selection/floor policy has no renderer dependencies.
import {
  REINFORCEMENT_MIN_DISTANCE,
  REINFORCEMENT_BOSS_FLOOR_EVERY,
  isLivingMonster,
  floorIsEmptyOfMonsters,
  floorAllowsReinforcements,
  reinforcementCount,
  pickReinforcementKind,
  selectReinforcementTiles,
  reinforceFloor
} from '../src/games/rogue0/monsterReinforcements.ts';
import { REGION_SIZE } from '../src/games/rogue0/progression.ts';

function load(path, bindings = {}) {
  const source = fs.readFileSync(path, 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
  const exports = {};
  new Function('exports', ...Object.keys(bindings), ts.transpile(source, {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }))(exports, ...Object.values(bindings));
  return exports;
}

// --- What counts as the floor's monster population --------------------------
const player = { type: 'player', isDecoy: false, healthPoints: 10 };
const living = { type: 'enemy', isDecoy: false, healthPoints: 3 };
const decoy = { type: 'enemy', isDecoy: true, healthPoints: 1 };
const corpse = { type: 'enemy', isDecoy: false, healthPoints: 0 };
const item = { type: 'item', isDecoy: false, healthPoints: 1 };
assert.equal(isLivingMonster(living), true);
assert.equal(isLivingMonster(decoy), false, 'mirror images are not monsters');
assert.equal(isLivingMonster(corpse), false, 'a dead actor no longer populates the floor');
assert.equal(isLivingMonster(player), false);
assert.equal(isLivingMonster(item), false);
assert.equal(floorIsEmptyOfMonsters([player, item]), true);
assert.equal(floorIsEmptyOfMonsters([player, decoy, corpse]), true);
assert.equal(floorIsEmptyOfMonsters([player, living]), false);

// --- Placement: distant, unseen, unoccupied, distinct -----------------------
const field = [];
for (let y = 0; y < 15; y++) {
  for (let x = 0; x < 15; x++) field.push({ x, y });
}
const blocked = new Set(['13,13', '14,14']);
const picked = selectReinforcementTiles(field, { x: 7, y: 7 }, 5, {
  blocked: (x, y) => blocked.has(`${x},${y}`),
  random: () => 0.5
});
assert.equal(picked.length, 5);
assert.equal(new Set(picked.map(tile => `${tile.x},${tile.y}`)).size, 5,
  'a wave never stacks two monsters on one tile');
assert.ok(picked.every(tile => Math.hypot(tile.x - 7, tile.y - 7) >= REINFORCEMENT_MIN_DISTANCE),
  'reinforcements appear in another part of the floor');
assert.ok(picked.every(tile => !blocked.has(`${tile.x},${tile.y}`)));

// Distant unseen tiles outrank distant visible ones, which outrank nearby ones.
const farHidden = { x: 0, y: 0 };
const farVisible = { x: 14, y: 14 };
const nearHidden = { x: 6, y: 6 };
const nearVisible = { x: 7, y: 8 };
const hiddenOnes = new Set([`${farHidden.x},${farHidden.y}`, `${nearHidden.x},${nearHidden.y}`]);
const priority = selectReinforcementTiles(
  [nearVisible, nearHidden, farVisible, farHidden],
  { x: 7, y: 7 }, 2,
  { hidden: (x, y) => hiddenOnes.has(`${x},${y}`), random: () => 0.5 }
);
assert.deepEqual(priority, [farHidden, nearHidden],
  'the wave stays unseen even when a visible tile is farther away');
assert.deepEqual(
  selectReinforcementTiles([nearVisible, nearHidden], { x: 7, y: 7 }, 1, {
    hidden: (x, y) => hiddenOnes.has(`${x},${y}`), random: () => 0.5
  }),
  [nearHidden],
  'a nearby unseen tile still beats a visible one'
);
// A wave never spills into view while any unseen tile remains. If the unseen
// space is smaller than the requested wave, spawn fewer rather than reveal it.
assert.deepEqual(
  selectReinforcementTiles([nearHidden, farVisible, nearVisible], { x: 7, y: 7 }, 3, {
    hidden: (x, y) => x === nearHidden.x && y === nearHidden.y, random: () => 0.5
  }),
  [nearHidden],
  'unseen placement is mandatory, not merely preferred'
);

// A map with no unseen walkable tile at all may still refill as a last resort.
const degenerate = selectReinforcementTiles(
  [{ x: 1, y: 1 }, { x: 2, y: 1 }], { x: 0, y: 0 }, 2, { random: () => 0 }
);
assert.equal(new Set(degenerate.map(tile => `${tile.x},${tile.y}`)).size, 2,
  'visible tiles are only a degenerate-map fallback');

// A cramped floor still refills, even though nothing is distant or hidden.
const cramped = selectReinforcementTiles(
  [{ x: 1, y: 1 }, { x: 2, y: 1 }], { x: 0, y: 0 }, 2, { random: () => 0 }
);
assert.equal(new Set(cramped.map(tile => `${tile.x},${tile.y}`)).size, 2,
  'the wave falls back to any free walkable tile rather than leaving the floor empty');

// --- Wave size and composition ----------------------------------------------
assert.equal(reinforcementCount(1, () => 0.99), 2);
assert.equal(reinforcementCount(1, () => 0), 3);
assert.equal(reinforcementCount(8, () => 0.99), 3);
assert.equal(reinforcementCount(20, () => 0), 4);
for (const floor of [1, 2, 3, 8, 25]) {
  for (const roll of [0, 0.1, 0.5, 0.9, 0.999]) {
    assert.ok(reinforcementCount(floor, () => roll) >= 2, 'a refill is never empty');
  }
}
assert.equal(pickReinforcementKind(1, () => 0), 'skeleton');
assert.equal(pickReinforcementKind(1, () => 0.999), 'skeleton',
  'floor 1 does not draw later-floor monsters');
const floor3Kinds = new Set();
for (let i = 0; i < 100; i++) floor3Kinds.add(pickReinforcementKind(3, () => i / 100));
assert.deepEqual([...floor3Kinds].sort(), ['brute', 'cultist', 'elemental', 'ghoul', 'goblin', 'quloptsh', 'skeleton', 'swarm', 'wraith']);
assert.equal(pickReinforcementKind(3, () => 0.999), 'elemental');

// --- Whole-floor reinforcement through the real callback --------------------
const context = {
  entities: [player, item],
  player: { x: 7, y: 7 },
  visibleTiles: new Set()
};
const spawns = [];
const spawnedCount = reinforceFloor(context, field, (kind, x, y) => {
  spawns.push({ kind, x, y });
  context.entities.push({ type: 'enemy', isDecoy: false, healthPoints: 4, x, y });
}, { floor: 3, count: 3, random: () => 0.4 });
assert.equal(spawnedCount, 3);
assert.equal(spawns.length, 3);
assert.equal(new Set(spawns.map(s => `${s.x},${s.y}`)).size, 3);
assert.ok(spawns.every(s => Math.hypot(s.x - 7, s.y - 7) >= REINFORCEMENT_MIN_DISTANCE));
assert.equal(floorIsEmptyOfMonsters(context.entities), false,
  'the floor is populated before control returns to the game');
assert.equal(context.entities.filter(entity => entity.type === 'enemy').length, 3);

// A living monster means no wave; a decoy does not keep the floor populated.
const occupiedContext = {
  entities: [player, { type: 'enemy', isDecoy: false, healthPoints: 2 }],
  player: { x: 7, y: 7 },
  visibleTiles: new Set()
};
assert.equal(reinforceFloor(occupiedContext, field, () => assert.fail('floor was not empty')), 0);
const decoyContext = {
  entities: [player, decoy],
  player: { x: 7, y: 7 },
  visibleTiles: new Set()
};
let decoySpawned = 0;
assert.equal(reinforceFloor(decoyContext, field, () => { decoySpawned++; }, { count: 1 }), 1);
assert.equal(decoySpawned, 1);

// --- Boss floors are never repopulated --------------------------------------
// The mirrored constant must match the real region size progression uses.
assert.equal(REINFORCEMENT_BOSS_FLOOR_EVERY, REGION_SIZE,
  'the reinforcement boss-floor rule tracks the region size');
for (const floor of [1, 2, 3, 4, 6, 24]) assert.equal(floorAllowsReinforcements(floor), true);
for (const floor of [5, 10, 15, 20, 25]) {
  assert.equal(floorAllowsReinforcements(floor), false, `floor ${floor} is a boss floor`);
  const bossArena = { entities: [player], player: { x: 7, y: 7 }, visibleTiles: new Set() };
  assert.equal(reinforceFloor(bossArena, field, () => assert.fail(`floor ${floor} was repopulated`),
    { floor }), 0, `floor ${floor} stays a guardian-only arena`);
}

// --- removeEntity invokes the population hook only for real monsters --------
const { Entity, removeEntity } = load('src/games/rogue0/entity.ts', {
  Phaser: { Math: { Between: () => 1 } },
  actorOriginY: () => 0.5,
  worldDepth: () => 0,
  forgetInspectedEntity: () => {},
  sfx: { death() {} },
  tickStatusEffects: () => {},
  actionCost: () => 1,
  CURSE_NAMES: {},
  CURSE_FLAVOR: {}
});
function actor(fields) {
  return Object.assign(Object.create(Entity.prototype), {
    type: 'enemy', isDecoy: false, healthPoints: 0, name: 'Test Monster',
    effects: [], onDestroy() {}, ...fields
  });
}
const hookCalls = [];
const hookContext = {
  entities: [],
  messages: [],
  visibleTiles: new Set(),
  onMonsterRemoved: entity => hookCalls.push({ entity, remaining: hookContext.entities.length })
};
const deadMonster = actor({ context: hookContext, x: 3, y: 4 });
hookContext.entities = [deadMonster];
removeEntity(hookContext, deadMonster);
assert.equal(hookCalls.length, 1, 'the scene is asked to refill an emptied floor');
assert.equal(hookCalls[0].entity, deadMonster);
assert.equal(hookCalls[0].remaining, 0, 'the hook runs after the corpse leaves the entity list');
assert.equal(deadMonster.x, undefined);

hookCalls.length = 0;
const deadDecoy = actor({ context: hookContext, isDecoy: true, x: 3, y: 4 });
hookContext.entities = [deadDecoy];
removeEntity(hookContext, deadDecoy);
assert.equal(hookCalls.length, 0, 'decoy removal does not trigger reinforcements');

const consumedItem = actor({ context: hookContext, type: 'item', x: 5, y: 5 });
hookContext.entities = [consumedItem];
removeEntity(hookContext, consumedItem);
assert.equal(hookCalls.length, 0, 'item removal does not trigger reinforcements');

console.log('Rogue0 reinforcements: population detection, distant/hidden placement, fallbacks, wave composition and death hook passed');
