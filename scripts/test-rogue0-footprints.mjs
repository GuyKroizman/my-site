import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('footprints');
import assert from 'node:assert/strict';
import PF from 'pathfinding';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
import {
  TILE_FOOTPRINT, resolveFootprint, footprintBounds, footprintContains,
  footprintTiles, footprintsOverlap, footprintGap, footprintCenter,
  footprintAnchorForCenter
} from '../src/games/rogue0/footprint.ts';
import {
  actorFootprint, actorBodyAtTile, bodyAtTile, bodyDistance, bodyOverlapsAt
} from '../src/games/rogue0/actorBodies.ts';
import { bresenhamLine, canSee } from '../src/games/rogue0/fov.ts';
import { createGameContext } from '../src/games/rogue0/context.ts';
import { createHeroTargeting } from '../src/games/rogue0/heroTargeting.ts';
import { createHeroInput } from '../src/games/rogue0/heroInput.ts';
import { actorHasVisibleTile, actorIsConcealed, actorIsVisible } from '../src/games/rogue0/actorVisibility.ts';
import { isEnemyVisible } from '../src/games/rogue0/combatFeedback.ts';
import { terrainFor } from '../src/games/rogue0/terrain.ts';

// --- Anchor conventions -----------------------------------------------------
assert.deepEqual({ ...resolveFootprint({ width: 1, height: 1 }) }, { ...TILE_FOOTPRINT },
  'a 1x1 footprint is the ordinary cell');
assert.deepEqual({ ...resolveFootprint({ width: 2, height: 2 }) },
  { width: 2, height: 2, originX: 0, originY: 0 },
  'the default anchor is the top-left corner');
assert.deepEqual({ ...resolveFootprint({ width: 3, height: 3, anchor: 'center' }) },
  { width: 3, height: 3, originX: 1, originY: 1 },
  'an odd footprint can be centre-anchored');
assert.throws(() => resolveFootprint({ width: 2, height: 2, anchor: 'center' }),
  /odd width and height/, 'an even footprint has no centre tile and fails loudly');
assert.deepEqual({ ...resolveFootprint({ width: 2, height: 2, anchor: 'feet' }) },
  { width: 2, height: 2, originX: 1, originY: 1 },
  'feet anchoring is deterministic for even widths');
assert.deepEqual({ ...resolveFootprint({ width: 2, height: 4, originX: 1, originY: 2 }) },
  { width: 2, height: 4, originX: 1, originY: 2 },
  'explicit origins win over the authoring sugar');
assert.throws(() => resolveFootprint({ width: 0, height: 1 }), /positive integer/);
assert.throws(() => resolveFootprint({ width: 2, height: 2, originX: 2, originY: 0 }),
  /originX must be an integer/);

// --- Rectangle math ---------------------------------------------------------
const square = resolveFootprint({ width: 2, height: 2 });
assert.deepEqual(footprintBounds(square, 10, 10), { x0: 10, y0: 10, x1: 11, y1: 11 });
assert.equal(footprintContains(square, 10, 10, 11, 11), true, 'the far corner is body');
assert.equal(footprintContains(square, 10, 10, 12, 10), false, 'one cell beyond the body is empty');
assert.deepEqual([...footprintTiles(square, 10, 10)], [[10, 10], [11, 10], [10, 11], [11, 11]]);

const boss = resolveFootprint({ width: 3, height: 3, anchor: 'center' });
assert.equal(footprintContains(boss, 10, 10, 9, 9), true, 'centre anchoring still reaches the far corner');
assert.deepEqual(footprintCenter(square, 10, 10), { x: 10.5, y: 10.5 });
assert.deepEqual(footprintCenter(boss, 10, 10), { x: 10, y: 10 });
assert.deepEqual(footprintAnchorForCenter(square, 10.5, 10.5), { x: 10, y: 10 });
assert.deepEqual(footprintAnchorForCenter(boss, 10, 10), { x: 10, y: 10 });

assert.equal(footprintGap(boss, 10, 10, TILE_FOOTPRINT, 12, 10), 1,
  'the gap to a touching neighbour is one empty cell');
assert.equal(footprintGap(boss, 10, 10, TILE_FOOTPRINT, 13, 10), 2);
assert.equal(footprintGap(boss, 10, 10, TILE_FOOTPRINT, 11, 11), 0,
  'overlapping rectangles touch');
assert.equal(footprintsOverlap(boss, 10, 10, TILE_FOOTPRINT, 11, 11), true);
assert.equal(footprintsOverlap(boss, 10, 10, TILE_FOOTPRINT, 12, 12), false);

// --- Actor compatibility layer ---------------------------------------------
const legacyWide = { x: 10, y: 10, bodyRadius: 1 };
assert.equal(bodyDistance(legacyWide, { x: 12, y: 10 }), 1,
  'legacy bodyRadius fixtures keep their old distance');
assert.equal(bodyAtTile(legacyWide, 9, 9), true);
assert.deepEqual({ ...actorFootprint(legacyWide) }, { width: 3, height: 3, originX: 1, originY: 1 });
const wideActor = { x: 4, y: 4, type: 'enemy', healthPoints: 5, footprint: square };
assert.equal(bodyAtTile(wideActor, 5, 5), true, 'footprints prefer the rectangle over the old radius');
assert.equal(actorBodyAtTile([wideActor], 5, 5), wideActor);
assert.equal(actorBodyAtTile([{ ...wideActor, type: 'item' }], 5, 5), undefined,
  'items never claim extra cells');
assert.equal(actorBodyAtTile([{ ...wideActor, healthPoints: 0 }], 5, 5), undefined,
  'a corpse does not block or intercept');

// --- Real dungeon resolution ------------------------------------------------
const terrainStub = {
  getTileState: () => undefined, getDoorState: () => undefined, getFeature: () => undefined,
  isBlocking: () => false, forEachFeature: () => {}, isGrassConcealed: () => false
};
const dungeon = load('src/games/rogue0/dungeon.ts', { PF, bresenhamLine, tiles: terrainStub }).default;
dungeon.currentLevel = Array.from({ length: 12 }, () => Array(12).fill(0));
dungeon.diagonalFinder = new PF.AStarFinder({ diagonalMovement: PF.DiagonalMovement.Always });
const context = { entities: [], visibleTiles: new Set(), map: {}, scene: {} };
const guardian = {
  type: 'enemy', name: 'Guardian', x: 5, y: 5, healthPoints: 20, sprite: {},
  footprint: resolveFootprint({ width: 3, height: 3, anchor: 'center' })
};
const loot = { type: 'item', name: 'Loot', x: 4, y: 4, healthPoints: 1, sprite: {} };
context.entities = [loot, guardian];

assert.equal(dungeon.entityAtTile(context, 4, 4), guardian,
  'a body cell resolves the creature, not the item sharing it');
assert.equal(dungeon.entityAtTile(context, 6, 6), guardian, 'every occupied cell resolves the creature');
assert.equal(dungeon.entityAtTile(context, 8, 8), undefined, 'empty floor resolves nothing');
loot.x = 2; loot.y = 2;
assert.equal(dungeon.entityAtTile(context, 2, 2), loot, 'an item outside the body keeps its own cell');
context.entities = [loot, guardian];
assert.equal(dungeon.entityAtTile(context, 4, 4), guardian);

// A projectile on any body cell intercepts the creature; corpses and loot do not.
const shooter = { type: 'player', x: 0, y: 5, healthPoints: 20, sprite: {} };
context.entities = [shooter, guardian];
assert.equal(dungeon.firstActorInPath(context, shooter, 9, 5), guardian,
  'a bolt entering the body edge stops at the creature');
guardian.x = 9; guardian.y = 9;
guardian.healthPoints = 0;
context.entities = [shooter, { type: 'item', x: 4, y: 5, healthPoints: 1, sprite: {} },
  { type: 'enemy', x: 6, y: 5, healthPoints: 0, sprite: {} }];
assert.equal(dungeon.firstActorInPath(context, shooter, 9, 5), undefined,
  'loot and corpses never intercept a bolt');

const blocker = { type: 'enemy', x: 6, y: 6, healthPoints: 10, sprite: {}, footprint: square };
context.entities = [shooter, blocker];
assert.equal(dungeon.firstActorInPath(context, shooter, 10, 6), blocker,
  'a top-left-anchored rectangle intercepts on its body cells');

// --- Movement clearance and pathfinding for rectangles ----------------------
const movementContext = {
  entities: [], visibleTiles: new Set(), currentLevel: undefined,
  map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 },
  scene: { add: { sprite: () => ({ setOrigin() { return this; }, setDepth() { return this; } }) },
    tweens: { add() {}, killTweensOf() {} } }
};
const squareActor = {
  type: 'enemy', name: 'Square', x: 1, y: 1, healthPoints: 10, sprite: {},
  footprint: square
};
movementContext.entities = [squareActor];

// A one-tile-wide corridor cannot hold a 2x2 body; a two-tile corridor can.
const corridor = Array.from({ length: 10 }, () => Array(10).fill(0));
corridor[4] = Array(10).fill(1);
corridor[6] = Array(10).fill(1);
dungeon.currentLevel = corridor;
assert.equal(dungeon.canFootprintOccupy(movementContext, squareActor, 3, 5), false,
  'a 2x2 body cannot occupy a one-tile-wide corridor');
assert.equal(dungeon.canMoveActor(movementContext, { ...squareActor, x: 2, y: 5 }, 3, 5), false,
  'movement into the blocked rectangle is refused');
corridor[6] = Array(10).fill(0);
assert.equal(dungeon.canFootprintOccupy(movementContext, squareActor, 3, 5), true,
  'opening a second row lets the same body fit');

// Diagonal squeezing: destination cells are free but the swept union is not.
const corner = Array.from({ length: 10 }, () => Array(10).fill(0));
corner[5][3] = 1;
dungeon.currentLevel = corner;
const cornerActor = { ...squareActor, x: 3, y: 3 };
movementContext.entities = [cornerActor];
assert.equal(dungeon.canFootprintOccupy(movementContext, cornerActor, 4, 4), true,
  'the destination rectangle itself is free');
assert.equal(dungeon.canFootprintOccupy(movementContext, cornerActor, 4, 4, { swept: true }), false,
  'a rectangle cannot cut the corner through a wall');
const single = { type: 'enemy', name: 'Single', x: 3, y: 3, healthPoints: 10, sprite: {} };
movementContext.entities = [single];
assert.equal(dungeon.canFootprintOccupy(movementContext, single, 4, 4, { swept: true }), true,
  'one-tile actors keep the legacy corner rounding');

// Shared-grid A* plans within the footprint; a one-tile gap is impassable.
dungeon.currentLevel = Array.from({ length: 12 }, () => Array(12).fill(0));
dungeon.pathGrid = new PF.Grid(dungeon.currentLevel);
const openPath = dungeon.findPath(1, 1, 8, 8, false, false, squareActor);
assert.ok(openPath.length > 1, 'a 2x2 body plans across open floor');
for (let y = 0; y < 12; y++) dungeon.currentLevel[y][6] = 1;
dungeon.currentLevel[6][6] = 0;
dungeon.pathGrid = new PF.Grid(dungeon.currentLevel);
assert.deepEqual(dungeon.findPath(1, 1, 9, 9, false, false, squareActor), [],
  'a one-tile gap does not admit a 2x2 footprint');
assert.ok(dungeon.findPath(1, 1, 4, 4, false, false, squareActor).length > 1,
  'the same body still reaches the gap side of the wall');

// The shared move primitive refuses a corner cut for a wide body.
dungeon.currentLevel = Array.from({ length: 10 }, () => Array(10).fill(0));
dungeon.currentLevel[5][3] = 1;
squareActor.x = 3; squareActor.y = 3;
movementContext.entities = [squareActor];
dungeon.moveEntityTo(movementContext, squareActor, 4, 4);
assert.deepEqual([squareActor.x, squareActor.y], [3, 3],
  'moveEntityTo will not squeeze a rectangle diagonally past a wall');

// --- Inspect resolves every body cell ---------------------------------------
const inspection = createGameContext();
inspection.visibleTiles = new Set(Array.from({ length: 12 }, (_, y) =>
  Array.from({ length: 12 }, (_, x) => `${x},${y}`)).flat());
const inspectedBoss = {
  type: 'enemy', name: 'Guardian', x: 5, y: 5, healthPoints: 20, sprite: {},
  footprint: resolveFootprint({ width: 3, height: 3, anchor: 'center' })
};
inspection.entities = [inspectedBoss];
const targeting = createHeroTargeting({
  dungeon: { inspectTileInfo: () => ({ description: 'Stone floor.' }),
    inspectTile: () => 'Stone floor.' },
  isGrassConcealed: () => false,
  hasLineOfSight: () => true
});
const inspectingHero = { context: inspection, x: 1, y: 1 };
for (const [x, y] of [[4, 4], [5, 5], [6, 6]]) {
  targeting.inspectTile(inspectingHero, x, y);
  assert.equal(inspection.inspectedEntity, inspectedBoss, `inspect resolves body cell ${x},${y}`);
  assert.equal(inspection.inspectedTerrain, undefined);
}
targeting.inspectTile(inspectingHero, 8, 5);
assert.equal(inspection.inspectedEntity, undefined);
assert.equal(inspection.inspectedTerrain, 'Stone floor.', 'empty floor still describes terrain');

inspection.visibleTiles.delete('4,4');
targeting.inspectTile(inspectingHero, 4, 4);
assert.equal(inspection.inspectedEntity, inspectedBoss,
  'a body cell stays inspectable while another body cell is visible');
inspection.visibleTiles.delete('5,5'); inspection.visibleTiles.delete('6,5');
targeting.inspectTile(inspectingHero, 4, 4);
assert.equal(inspection.inspectedEntity, inspectedBoss,
  'the remaining visible body cells keep the creature inspectable');

// --- Wand taps snap to the anchor ------------------------------------------
const wandContext = createGameContext();
wandContext.visibleTiles = new Set(Array.from({ length: 12 }, (_, y) =>
  Array.from({ length: 12 }, (_, x) => `${x},${y}`)).flat());
wandContext.map = { worldToTileX: x => x, worldToTileY: y => y };
wandContext.throwMode = true;
wandContext.throwItem = { name: 'Wand' };
const wandBoss = {
  type: 'enemy', name: 'Guardian', x: 5, y: 5, healthPoints: 20, sprite: {},
  footprint: resolveFootprint({ width: 3, height: 3, anchor: 'center' })
};
const wandHero = { context: wandContext, x: 2, y: 5, zapping: true, canAct: () => true };
wandContext.entities = [wandHero, wandBoss];
const throws = [];
wandHero.throwAt = (x, y) => throws.push([x, y]);
const input = createHeroInput({
  dungeon,
  isModalOpen: () => false,
  isGrassConcealed: () => false,
  hasLineOfSight: () => true
});
input.processTouchInput(wandHero, wandContext, { worldX: 4, worldY: 4 });
assert.deepEqual([wandContext.cursorX, wandContext.cursorY], [5, 5],
  'the first tap selects the creature and snaps the cursor to its anchor');
input.processTouchInput(wandHero, wandContext, { worldX: 4, worldY: 4 });
assert.deepEqual(throws, [[5, 5]],
  'the confirm tap fires at the anchor instead of the empty body-edge tile');
assert.equal(wandContext.throwMode, true, 'input routing does not resolve the zap itself');

// --- Multi-tile sight -------------------------------------------------------
{
  const ai = load('src/games/rogue0/ai.ts', {
    dungeon, canSee, tiles: terrainStub,
    hasEffect: (entity, id) => (entity.effects ?? []).some(effect => effect.id === id),
    fleeStep: () => false
  });
  const sightMap = Array.from({ length: 12 }, () => Array(12).fill(0));
  dungeon.currentLevel = sightMap;
  const sightContext = { entities: [], currentLevel: sightMap, visibleTiles: new Set(), messages: [] };
  const wide = {
    type: 'enemy', name: 'Wide', x: 5, y: 5, healthPoints: 10,
    visionRadius: 2, effects: [], context: sightContext, footprint: square
  };
  // Outside the anchor's Euclidean sight radius but inside the far body
  // cell's radius: the wide creature sees, the same anchor alone does not.
  const hero = { type: 'player', name: 'Hero', x: 7, y: 4, healthPoints: 10, effects: [] };
  sightContext.entities = [wide, hero]; sightContext.player = hero;
  assert.equal(ai.enemyCanSeePlayer(wide), true,
    'a wide creature sees past a corner through any body cell');
  wide.footprint = TILE_FOOTPRINT;
  assert.equal(ai.enemyCanSeePlayer(wide), false,
    'the same anchor without the wide body has no sight line');
}


// --- Melee visibility through tall grass ------------------------------------
{
  const vision = createGameContext();
  const meleeBoss = {
    type: 'enemy', name: 'Guardian', x: 5, y: 5, healthPoints: 20,
    footprint: resolveFootprint({ width: 3, height: 3, anchor: 'center' })
  };
  const meleeHero = { type: 'player', name: 'Hero', x: 4, y: 3, healthPoints: 10 };
  vision.entities = [meleeBoss, meleeHero];
  vision.player = meleeHero;

  // Only the adjacent body cell is in view; the centre is two tiles away and
  // stands in tall grass, which is exactly the reported melee case.
  vision.visibleTiles = new Set(['4,4']);
  terrainFor(vision).setFeature(5, 5, 'grass');
  const concealed = (x, y) => terrainFor(vision).isGrassConcealed(x, y, 4, 3);
  assert.equal(actorHasVisibleTile(meleeBoss, vision.visibleTiles), true,
    'the exposed body edge counts as visible');
  assert.equal(actorIsConcealed(meleeBoss, concealed), false,
    'a body is only concealed when every occupied cell is grass-concealed');
  assert.equal(actorIsVisible(meleeBoss, vision.visibleTiles, concealed), true,
    'the guardian stays visible while its edge is in melee range');
  assert.equal(isEnemyVisible(vision, meleeBoss), true,
    'combat feedback names the adjacent guardian rather than hiding it');

  // Anchor-only visibility would fail both cases: the centre is concealed.
  vision.visibleTiles = new Set(['5,5']);
  assert.equal(actorIsConcealed(meleeBoss, concealed), false);
  assert.equal(isEnemyVisible(vision, meleeBoss), false,
    'seeing only the grass-covered centre is not enough to see the body');

  terrainFor(vision).clearFeature(5, 5);
  assert.equal(isEnemyVisible(vision, meleeBoss), true,
    'without grass the visible centre reveals the guardian');
}

console.log('Rogue0 footprints: rectangle anchoring, body resolution, projectile interception, inspection, wand taps, movement clearance, pathfinding, sight and melee visibility passed');


