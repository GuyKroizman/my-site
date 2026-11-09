import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('portal');
import assert from 'node:assert/strict';
import { placeStorePortal } from '../src/games/rogue0/store/portal.ts';
import { generateMap } from '../src/games/rogue0/mapgen.ts';
import { createTerrain } from '../src/games/rogue0/terrain.ts';
import { isModalOpen } from '../src/games/rogue0/context.ts';
import { portalFrame } from '../src/games/rogue0/portalVisuals.ts';

const blank = (w = 30, h = 24) => Array.from({ length: h }, (_, y) =>
  Array.from({ length: w }, (_, x) => x > 4 && x < 24 && y > 5 && y < 18 ? 0 : 1));
const spawn = { x: 14, y: 11 };
{
  const map = blank();
  const features = [];
  const portal = placeStorePortal(6, map, features, spawn, () => 0.5);
  assert.ok(portal);
  assert.equal(map[portal.y][portal.x], 1, 'portal stays a wall');
  assert.equal(map[portal.approachY][portal.approachX], 0);
  assert.equal(Math.max(Math.abs(portal.x - portal.approachX), Math.abs(portal.y - portal.approachY)), 1);
  assert.equal(features.length, 1);
  assert.deepEqual([features[0].x, features[0].y, features[0].feature, features[0].portal],
    [portal.x, portal.y, 'portal', 'closed']);
  const again = placeStorePortal(6, map, features, spawn, () => 0);
  assert.deepEqual(again, portal);
  assert.equal(features.length, 1, 'revisits never add a second portal');
  assert.equal(placeStorePortal(5, map, [], spawn), undefined);
  assert.equal(placeStorePortal(7, map, [], spawn), undefined);
}
for (let roll = 0; roll < 20; roll++) {
  const generated = generateMap(6);
  const spawnRoom = generated.rooms.find(room => room.cx < 70) ?? generated.rooms[0];
  const features = generated.features.slice();
  const portal = placeStorePortal(6, generated.map, features, { x: spawnRoom.cx, y: spawnRoom.cy });
  assert.ok(portal, `floor 6 roll ${roll} must always fit a store door`);
  assert.equal(features.filter(tile => tile.feature === 'portal').length, 1);
  assert.equal(generated.map[portal.y][portal.x], 1);
  assert.equal(generated.map[portal.approachY][portal.approachX], 0);
  assert.notDeepEqual([portal.x, portal.y], [generated.rooms[0].cx, generated.rooms[0].cy]);
}
const generated7 = generateMap(7);
assert.equal(placeStorePortal(7, generated7.map, generated7.features.slice(), { x: 20, y: 20 }), undefined);
{
  const terrain = createTerrain();
  terrain.setFeature(3, 3, 'portal', { portal: 'closed' });
  assert.equal(terrain.getTileState(3, 3).portal, 'closed');
  assert.equal(terrain.isBlocking(3, 3), true);
  terrain.setFeature(3, 3, 'portal', { portal: 'open' });
  assert.equal(terrain.getTileState(3, 3).portal, 'open');
  const saved = terrain.snapshot();
  const restored = createTerrain();
  restored.restore(JSON.parse(JSON.stringify(saved)));
  assert.equal(restored.getTileState(3, 3).portal, 'open');
  assert.equal(terrain.getFeature(3, 3), 'portal');
}
assert.equal(portalFrame(false, 99999), 0);
assert.deepEqual([0, 1, 7, 8].map(n => portalFrame(true, n * 110)), [1, 2, 8, 1]);
assert.equal(isModalOpen({ storeOpen: true }), true);
assert.equal(isModalOpen({ storeOpen: false }), false);
console.log('Portal passed: wall-only random door, one per floor 6, approach walkable, state save and modal gating.');
