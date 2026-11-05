import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('terrain-core');
import assert from 'node:assert/strict';
import PF from 'pathfinding';
import { createGameContext } from '../src/games/rogue0/context.ts';
import { createTerrain, terrainFor } from '../src/games/rogue0/terrain.ts';
import { blocksSight, canSee, computeFOV, hasLineOfSight } from '../src/games/rogue0/fov.ts';
import { randomWalkableTiles } from '../src/games/rogue0/mapgen.ts';
import { describeTile, describeTileLabel } from '../src/games/rogue0/tiles.ts';

// Whole production modules, no import stripping or implicit active overlay.
// Even the very same base-map object may have different overlays in two runs.
const map = [Array(7).fill(0)];
const a = createGameContext(), b = createGameContext();
a.currentLevel = b.currentLevel = map;
const first = terrainFor(a), second = terrainFor(b);
assert.equal(terrainFor(a), first);
assert.notEqual(first, second);
assert.notEqual(createTerrain(), first);
first.setFeature(2, 0, 'door');
second.setFeature(2, 0, 'door', { door: 'open' });
assert.equal(first.getDoorState(2, 0), 'closed');
assert.equal(second.getDoorState(2, 0), 'open');
assert.equal(hasLineOfSight(map, 0, 0, 6, 0, first), false);
assert.equal(hasLineOfSight(map, 0, 0, 6, 0, second), true);
assert.equal(canSee(map, 0, 0, 6, 0, 8, first), false);
assert.equal(canSee(map, 0, 0, 6, 0, 8, second), true);
assert.equal(computeFOV(map, 0, 0, 8, false, first).has('2,0'), true, 'closed door itself remains visible');
assert.equal(computeFOV(map, 0, 0, 8, false, first).has('3,0'), false);
assert.equal(computeFOV(map, 0, 0, 8, true, first).has('6,0'), true, 'magical sight ignores obstacles');
assert.equal(hasLineOfSight(map, 0, 0, 6, 0), true, 'bare-map helpers do not read either run');
assert.equal(canSee(map, 0, 0, 6, 0, 3, second), false, 'range still bounds sight');
assert.equal(blocksSight(map, -1, 0, first), true);

// Optical overrides are independent of movement, including a glass door and
// an explicitly opaque open door. Grass cover stays distinct from FOV.
first.setFeature(2, 0, 'door', { blocksSight: false });
assert.equal(first.isBlocking(2, 0), true);
assert.equal(hasLineOfSight(map, 0, 0, 6, 0, first), true);
second.setFeature(2, 0, 'door', { blocksSight: true });
assert.equal(second.isBlocking(2, 0), false);
assert.equal(hasLineOfSight(map, 0, 0, 6, 0, second), false);
first.setFeature(2, 0, 'grass');
assert.equal(first.getTileState(2, 0).door, undefined, 'feature replacement removes stale door state');
assert.equal(computeFOV(map, 0, 0, 8, false, first).has('2,0'), true);
assert.equal(first.isGrassConcealed(2, 0, 0, 0), true);
assert.equal(canSee(map, 0, 0, 2, 0, 8, first), false);
assert.equal(canSee(map, 1, 0, 2, 0, 8, first), true);
assert.equal(first.isGrassConcealed(undefined, 0, 0, 0), false);
first.clearFeature(2, 0);
assert.equal(first.getFeature(2, 0), undefined);
assert.equal(second.getFeature(2, 0), 'door');

// Walkability and spawn selection use the selected overlay, not another run's
// doors or the last grid to be initialized. Base-map data is never changed.
first.restore([{ x: 2, y: 0, feature: 'chasm' }, { x: 3, y: 0, feature: 'secretDoor' }]);
second.restore([{ x: 4, y: 0, feature: 'door' }]);
const gridA = new PF.Grid(map), gridB = new PF.Grid(map);
first.applyToPathGrid(gridA); second.applyToPathGrid(gridB);
assert.equal(gridA.isWalkableAt(2, 0), false);
assert.equal(gridB.isWalkableAt(2, 0), true);
assert.equal(gridA.isWalkableAt(4, 0), true);
assert.equal(gridB.isWalkableAt(4, 0), false);
const cells = terrain => randomWalkableTiles(map, 100, new Set(['0,0']), 6, terrain).map(p => p.x).sort();
assert.deepEqual(cells(first), [1, 4, 5]);
assert.deepEqual(cells(second), [1, 2, 3, 5]);
assert.deepEqual(cells(undefined), [1, 2, 3, 4, 5]);
assert.deepEqual(map, [Array(7).fill(0)]);

// Traps retain single-use/reusable policy, including legacy teleport saves.
// Revealing or firing a trap in A cannot consume the same coordinate in B.
first.setFeature(1, 0, 'trap'); second.setFeature(1, 0, 'trap');
assert.equal(first.getTrapState(1, 0), 'hidden');
assert.equal(first.getTrapKind(1, 0), 'dart');
assert.equal(describeTile(first.getTileState(1, 0), false), 'Stone floor.');
assert.equal(describeTileLabel(first.getTileState(1, 0), false), undefined);
first.setTrapState(1, 0, 'visible');
assert.equal(first.activateTrap(1, 0), true);
assert.equal(first.activateTrap(1, 0), false);
assert.equal(second.getTrapState(1, 0), 'hidden');
assert.match(describeTileLabel(first.getTileState(1, 0), false), /Triggered Dart/);
first.setFeature(1, 0, 'trap', { trap: 'hidden', trapKind: 'frost', trapReusable: true });
assert.equal(first.activateTrap(1, 0), true);
assert.equal(first.activateTrap(1, 0), true);
assert.equal(first.getTrapState(1, 0), 'visible');
first.restore([{ x: 1, y: 0, feature: 'trap', trapKind: 'teleport' }]);
assert.equal(first.getTileState(1, 0).trapReusable, true);
assert.equal(first.activateTrap(1, 0), true);
assert.equal(first.getTrapState(1, 0), 'visible');
first.setFeature(1, 0, 'water');
assert.equal(first.getTrapState(1, 0), undefined);
assert.equal(first.getTrapKind(1, 0), undefined);
assert.equal(first.getTileState(1, 0).trapReusable, undefined);
first.setDoorState(1, 0, 'closed'); first.setTrapState(1, 0, 'visible');
assert.equal(first.getFeature(1, 0), 'water', 'state setters cannot change feature type');
assert.equal(first.activateTrap(1, 0), false);

// Floor/save snapshots copy both ways. Restoring keeps the store identity (and
// bound readers used by controls) stable, without modifying inactive snapshots.
const placements = [
  { x: 1, y: 0, feature: 'door', door: 'open', blocksSight: false },
  { x: 2, y: 0, feature: 'trap', trap: 'visible', trapKind: 'frost', trapReusable: true },
  { x: 3, y: 0, feature: 'ice' },
];
first.restore(placements);
const saved = first.snapshot();
const otherSaved = second.snapshot();
const readDoor = first.getDoorState;
first.setDoorState(1, 0, 'closed');
first.setTrapState(2, 0, 'triggered');
assert.equal(saved[0].door, 'open');
assert.equal(saved[1].trap, 'visible');
assert.equal(placements[0].door, 'open');
first.clearAllFeatures();
first.restore(saved);
assert.equal(terrainFor(a), first);
assert.equal(readDoor(1, 0), 'open', 'bound readers follow floor restoration');
assert.equal(first.getTrapState(2, 0), 'visible');
saved[0].door = 'closed'; placements[0].blocksSight = true;
assert.equal(readDoor(1, 0), 'open', 'restore does not retain snapshot objects');
assert.equal(first.getTileState(1, 0).blocksSight, false);
const wire = JSON.parse(JSON.stringify(first.snapshot()));
const resumed = createTerrain(); resumed.restore(wire);
assert.deepEqual(JSON.parse(JSON.stringify(resumed.snapshot())), wire, 'v1 placement format round-trips unchanged');
first.restore([]);
assert.deepEqual(first.snapshot(), []);
assert.deepEqual(second.snapshot(), otherSaved, 'clear/restore in one run leaves the other untouched');
assert.equal(readDoor(1, 0), undefined);
assert.equal(Object.hasOwn(a, 'terrain'), false, 'runtime association does not add a persisted context field');
console.log('Rogue0 terrain core: owner isolation, explicit FOV/LOS, cover, path grids, spawn filtering, trap policy and detached v1 snapshots passed');
