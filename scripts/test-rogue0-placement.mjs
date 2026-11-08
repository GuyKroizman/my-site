import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('placement');
import assert from 'node:assert/strict';
import { resolveFootprint, TILE_FOOTPRINT } from '../src/games/rogue0/footprint.ts';
import {
  reserveFootprint, footprintIsFree, takeFootprintPlacement,
  firstFreeFootprintAnchor, nearestFreeFootprintAnchor
} from '../src/games/rogue0/placement.ts';
import { selectReinforcementTiles, reinforceFloor } from '../src/games/rogue0/monsterReinforcements.ts';

const square = resolveFootprint({ width: 2, height: 2 });
const open = Array.from({ length: 9 }, () => Array(9).fill(0));

// --- Reservation covers every body cell -------------------------------------
{
  const reserved = new Set();
  reserveFootprint(reserved, square, 3, 3);
  assert.deepEqual([...reserved].sort(),
    ['3,3', '3,4', '4,3', '4,4'].sort(),
    'reserving a 2x2 body blocks all four cells');
  reserveFootprint(reserved, TILE_FOOTPRINT, 7, 7);
  assert.equal(reserved.has('7,7'), true);
}

// --- Whole-rectangle fit ----------------------------------------------------
{
  const corridor = open.map(row => [...row]);
  corridor[3][4] = 1;
  const terrain = { isBlocking: (x, y) => corridor[y][x] === 1 };
  assert.equal(footprintIsFree(corridor, square, 3, 2, 9, terrain), false,
    'a wall under one body cell rejects the anchor');
  assert.equal(footprintIsFree(corridor, square, 5, 2, 9, terrain), true);
  assert.equal(footprintIsFree(open, square, 8, 8, 9, undefined), false,
    'the footprint may not hang off the map');
  assert.equal(footprintIsFree(open, square, 5, 5, 6, undefined), false,
    'the maxX frontier applies to every body cell');
  const reserved = new Set(['4,4']);
  assert.equal(footprintIsFree(open, square, 3, 3, 9, undefined,
    (x, y) => reserved.has(`${x},${y}`)), false,
    'a reserved cell anywhere in the rectangle rejects the anchor');
  assert.equal(footprintIsFree(open, square, 3, 5, 9, undefined,
    (x, y) => reserved.has(`${x},${y}`)), true,
    'the same reserved cell outside the rectangle is harmless');
}

// --- Candidate cursors and deterministic fallbacks --------------------------
{
  const reserved = new Set(['5,5']);
  const blocked = (x, y) => reserved.has(`${x},${y}`);
  const candidates = [{ x: 5, y: 5 }, { x: 6, y: 5 }];
  const cursor = { index: 0 };
  const first = takeFootprintPlacement(candidates, cursor, square, open, 9, undefined, blocked);
  assert.deepEqual(first, { x: 6, y: 5 },
    'the cursor skips an anchor whose rectangle overlaps a reserved cell');
  assert.equal(cursor.index, 2);
  assert.equal(takeFootprintPlacement(candidates, cursor, square, open, 9, undefined, blocked),
    undefined);
  assert.deepEqual(firstFreeFootprintAnchor(open, square, 9, undefined, blocked), { x: 0, y: 0 },
    'the row-major fallback finds the first valid anchor');
  assert.deepEqual(nearestFreeFootprintAnchor(open, square, 4, 4, 9, undefined, blocked),
    { x: 4, y: 3 },
    'restore repair chooses the nearest valid anchor (row scan tie-break)');
}

// --- Reinforcement selection understands rectangles ------------------------
function field(size = 15) {
  const cells = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) cells.push({ x, y });
  return cells;
}
{
  const cells = field();
  const player = { x: 7, y: 7 };
  const blockedCell = '10,10';
  const picked = selectReinforcementTiles(cells, player, 3, {
    footprint: square,
    minDistance: 5,
    blocked: (x, y) => `${x},${y}` === blockedCell,
    hidden: () => true,
    random: () => 0.5
  });
  assert.equal(picked.length, 3);
  const covered = new Set();
  for (const tile of picked) {
    for (const [x, y] of [[tile.x, tile.y], [tile.x + 1, tile.y],
      [tile.x, tile.y + 1], [tile.x + 1, tile.y + 1]]) {
      const key = `${x},${y}`;
      assert.equal(covered.has(key), false, 'two wide reinforcement bodies never overlap');
      assert.notEqual(key, blockedCell, 'a blocked body cell rejects the whole anchor');
      covered.add(key);
    }
    const nearest = Math.min(
      Math.hypot(tile.x - player.x, tile.y - player.y),
      Math.hypot(tile.x + 1 - player.x, tile.y - player.y),
      Math.hypot(tile.x - player.x, tile.y + 1 - player.y),
      Math.hypot(tile.x + 1 - player.x, tile.y + 1 - player.y)
    );
    assert.ok(nearest >= 5, 'distance is measured from the nearest body cell');
  }
}

{
  const cells = field();
  const picked = selectReinforcementTiles(cells, { x: 7, y: 7 }, 1, {
    footprint: square,
    hidden: (x, y) => !(x === 6 && y === 6) // one cell of the (5,5) body is visible
  });
  assert.notDeepEqual(picked, [{ x: 5, y: 5 }],
    'a partially visible body is not treated as a hidden arrival');
}

{
  const context = {
    entities: [{ type: 'player', healthPoints: 10, x: 0, y: 0 }],
    player: { x: 7, y: 7 },
    visibleTiles: new Set()
  };
  const spawns = [];
  const count = reinforceFloor(context, field(), (kind, x, y) => {
    spawns.push({ kind, x, y });
    context.entities.push({ type: 'enemy', healthPoints: 4, x, y, footprint: square });
  }, {
    floor: 1, count: 2, footprintsFor: () => square, random: () => 0.3,
    hidden: () => true, minDistance: 4
  });
  assert.equal(count, 2);
  assert.equal(spawns.length, 2);
  const cells = new Set();
  for (const spot of spawns) {
    for (const key of [`${spot.x},${spot.y}`, `${spot.x + 1},${spot.y}`,
      `${spot.x},${spot.y + 1}`, `${spot.x + 1},${spot.y + 1}`]) {
      assert.equal(cells.has(key), false, 'mixed-size wave reservations never overlap');
      cells.add(key);
    }
  }
}

console.log('Rogue0 placement: whole-footprint reservations, corridors, cursors, restore anchors and wide reinforcement waves passed');
