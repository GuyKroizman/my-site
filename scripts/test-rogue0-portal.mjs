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
const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
{
  const map = blank();
  const features = [];
  const portal = placeStorePortal(6, map, features, spawn, { random: () => 0.5 });
  assert.ok(portal);
  assert.equal(map[portal.y][portal.x], 0, 'free-standing door occupies floor, not a wall');
  assert.equal(map[portal.y + 1][portal.x], 0, 'front approach is open');
  assert.equal(map[portal.y - 1][portal.x], 0, 'hero can walk behind the door');
  for (const [dx, dy] of neighbors) assert.equal(map[portal.y + dy]?.[portal.x + dx], 0, 'door needs a clear 3x3 ring');
  assert.deepEqual([portal.approachX, portal.approachY], [portal.x, portal.y + 1], 'front faces the viewer');
  assert.equal(features.length, 1);
  assert.deepEqual([features[0].x, features[0].y, features[0].feature, features[0].portal],
    [portal.x, portal.y, 'portal', 'closed']);
  const again = placeStorePortal(6, map, features, spawn, { random: () => 0 });
  assert.deepEqual(again, portal);
  assert.equal(features.length, 1, 'revisits never add a second portal');
  assert.equal(placeStorePortal(5, map, [], spawn), undefined);
  assert.equal(placeStorePortal(7, map, [], spawn), undefined);

  const terrain = createTerrain();
  terrain.setFeature(portal.x, portal.y, 'portal', { portal: 'closed' });
  assert.equal(terrain.isBlocking(portal.x, portal.y), true, 'actors route around the door');
  terrain.setFeature(portal.x, portal.y, 'portal', { portal: 'open' });
  const restored = createTerrain();
  restored.restore(JSON.parse(JSON.stringify(terrain.snapshot())));
  assert.equal(restored.getTileState(portal.x, portal.y).portal, 'open');
}
// An older wall-mounted portal is migrated to a free-standing room door.
{
  const map = blank();
  const old = { x: 4, y: 9, feature: 'portal', portal: 'open' };
  assert.equal(map[old.y][old.x], 1);
  const features = [old];
  const portal = placeStorePortal(6, map, features, spawn, { random: () => 0 });
  assert.ok(portal);
  assert.notDeepEqual([portal.x, portal.y], [old.x, old.y]);
  assert.equal(features.length, 1, 'the old wall portal was replaced');
  assert.equal(features[0].portal, 'open', 'an open door stays open across the migration');
}
for (let roll = 0; roll < 20; roll++) {
  const generated = generateMap(6);
  const spawnRoom = generated.rooms.find(room => room.cx < 70) ?? generated.rooms[0];
  const features = generated.features.slice();
  const portal = placeStorePortal(6, generated.map, features, { x: spawnRoom.cx, y: spawnRoom.cy });
  assert.ok(portal, `floor 6 roll ${roll} must always fit a store door`);
  assert.equal(features.filter(tile => tile.feature === 'portal').length, 1);
  assert.equal(generated.map[portal.y][portal.x], 0);
  assert.equal(generated.map[portal.y + 1][portal.x], 0);
  assert.equal(generated.map[portal.y - 1][portal.x], 0);
  assert.notDeepEqual([portal.x, portal.y], [generated.rooms[0].cx, generated.rooms[0].cy]);
}
const generated7 = generateMap(7);
assert.equal(placeStorePortal(7, generated7.map, generated7.features.slice(), { x: 20, y: 20 }), undefined);
assert.equal(portalFrame(false, 99999), 0);
assert.equal(portalFrame(false, 0, true), 9);
assert.deepEqual([0, 1, 7, 8].map(n => portalFrame(true, n * 110)), [1, 2, 8, 1]);
assert.deepEqual([0, 1, 7, 8].map(n => portalFrame(true, n * 110, true)), [10, 11, 17, 10]);
assert.equal(isModalOpen({ storeOpen: true }), true);
assert.equal(isModalOpen({ storeOpen: false }), false);
console.log('Portal passed: free-standing room door, walk-behind clearance, front/back frames, migration and modal gating.');
