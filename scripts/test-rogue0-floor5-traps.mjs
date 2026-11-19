import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('floor5-traps');
import assert from 'node:assert/strict';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';
const load = (name, bindings) => loadLogic(`src/games/rogue0/${name}.ts`, bindings);
const tiles = load('tiles');
const {
  generateMap, floorIsBossArena, TRAP_HEAVY_FLOOR,
  floorVisibleTrapQuota, floorArrowPlateCount
} = load('mapgen', tiles);

const HIDDEN = ['dart', 'fire', 'frost', 'teleport', 'alarm', 'geyser', 'confusion'];
const REUSABLE = ['frost', 'teleport', 'alarm'];
const FLOOR_5_QUOTA = [
  { kind: 'fire', count: 5 },
  { kind: 'teleport', count: 5 },
  { kind: 'arrow', count: 30 }
];

// The budget is a pure function of the floor number, so it is cheap to pin down
// even before generating a map.
assert.equal(TRAP_HEAVY_FLOOR, 5, 'the trap gauntlet is the floor-5 boss arena');
assert.equal(floorIsBossArena(5), true, 'floor 5 stays a boss arena');
assert.deepEqual(floorVisibleTrapQuota(5), FLOOR_5_QUOTA, 'floor 5 has 5 fire, 5 teleport and 30 arrow traps');
for (const floor of [1, 2, 3, 4, 6, 9, 10, 15, 25]) {
  assert.deepEqual(floorVisibleTrapQuota(floor), [], `floor ${floor} has no extra visible traps`);
  assert.equal(floorArrowPlateCount(floor), 1, `floor ${floor} keeps its single arrow plate`);
}
assert.equal(floorArrowPlateCount(5), 2, 'the gauntlet keeps its two throwable arrow plates');

function traps(generated) {
  return generated.features.filter((f) => f.feature === 'trap');
}

// Sample many generated halls: the counts must be exact, the plates distinct and
// the visible field must not turn the guardian arena into a monster factory.
for (let i = 0; i < 80; i++) {
  const generated = generateMap(5);
  const all = traps(generated);
  const hidden = all.filter((f) => f.trap === 'hidden');
  const visible = all.filter((f) => f.trap === 'visible');
  const countKind = (kind) => visible.filter((f) => f.trapKind === kind).length;

  assert.equal(hidden.length, 2, 'floor 5 keeps the usual hidden pair');
  assert.equal(countKind('fire'), 5, 'floor 5 has five visible fire traps');
  assert.equal(countKind('teleport'), 5, 'floor 5 has five visible teleport traps');
  assert.equal(countKind('dart'), 0, 'no visible dart traps remain on floor 5');
  assert.equal(countKind('arrow'), 32, 'floor 5 has 30 arrow traps plus its two arrow plates');
  assert.equal(all.length, 44, 'the gauntlet has forty-four traps in total, arrow plates included');

  const positions = new Set(all.map((f) => `${f.x},${f.y}`));
  assert.equal(positions.size, all.length, 'no two traps share a tile');
  for (const f of all) {
    assert.equal(generated.map[f.y][f.x], 0, `trap at ${f.x},${f.y} sits on a walkable hall tile`);
    assert.ok(HIDDEN.includes(f.trapKind) || f.trapKind === 'arrow', `known trap kind: ${f.trapKind}`);
    assert.notEqual(f.trapKind, 'summon', 'the guardian arena never summons extra monsters');
    assert.equal(!!f.trapReusable, REUSABLE.includes(f.trapKind), 'reuse policy still follows the trap kind');
  }
}

// Neighbouring floors keep the quiet, hidden-only budget.
for (const floor of [4, 6]) {
  for (let i = 0; i < 20; i++) {
    const all = traps(generateMap(floor));
    assert.equal(all.filter((f) => f.trap === 'hidden').length, 2, `floor ${floor} has its usual pair`);
    assert.equal(all.filter((f) => f.trap === 'visible').length, 1, `floor ${floor} has its single visible plate`);
    assert.equal(all.filter((f) => f.trapKind === 'arrow').length, 1, `floor ${floor} has its arrow plate`);
  }
}
