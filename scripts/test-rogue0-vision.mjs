import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('vision');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function load(path, bindings = {}) {
  const source = fs.readFileSync(path, 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
  const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
  const exports = {};
  new Function('exports', ...Object.keys(bindings), js)(exports, ...Object.values(bindings));
  return exports;
}
const tiles = load('src/games/rogue0/tiles.ts');
const { computeFOV, hasLineOfSight, resolveVision } = load('src/games/rogue0/fov.ts', tiles);
const map = Array.from({ length: 31 }, () => Array(31).fill(0));
const sees = (x, y) => computeFOV(map, 15, 15).has(`${x},${y}`);
assert.ok(sees(23, 15));
assert.ok(!sees(24, 15));
assert.ok(!sees(23, 23), 'Euclidean radius excludes distant diagonal');
assert.deepEqual([...computeFOV(map, 15, 15, 0)], ['15,15']);
assert.equal(hasLineOfSight(map, -1, 0, 0, 0), false);

map[15][17] = 1;
assert.ok(sees(17, 15), 'opaque endpoint is visible');
assert.ok(!sees(18, 15), 'wall blocks tiles behind it');
map[15][17] = 0;
for (const feature of ['door', 'grass']) {
  tiles.setFeature(17, 15, feature);
  assert.ok(sees(17, 15), `${feature} is visible`);
  assert.ok(!sees(18, 15), `${feature} blocks sight through it`);
  tiles.clearAllFeatures();
}
tiles.setFeature(17, 15, 'door');
tiles.setDoorState(17, 15, 'open');
assert.ok(sees(18, 15), 'opening a door restores sight');
tiles.setFeature(17, 15, 'door', { blocksSight: false, door: 'closed' });
assert.ok(sees(18, 15), 'transparent closed door passes light');
assert.ok(tiles.isBlocking(17, 15), 'transparent closed door still blocks movement');
tiles.setFeature(17, 15, 'chasm');
assert.ok(sees(18, 15), 'chasm is transparent');
assert.ok(tiles.isBlocking(17, 15));
tiles.clearAllFeatures();

// A doorway in a solid wall produces angular shadows at its jambs.
for (let y = 0; y < 31; y++) map[y][17] = y === 15 ? 0 : 1;
assert.ok(sees(20, 15), 'see straight through doorway');
assert.ok(!sees(18, 13), 'doorway jamb hides adjacent room corner');
for (let x = 12; x <= 20; x++) {
  for (let y = 12; y <= 20; y++) {
    assert.equal(hasLineOfSight(map, 15, 15, x, y), hasLineOfSight(map, x, y, 15, 15), 'LOS is reciprocal');
  }
}
const vision = resolveVision({ magicalSight: true, dark: true });
assert.equal(vision.radius, 12);
assert.ok(computeFOV(map, 15, 15, vision.radius, vision.ignoreObstacles).has('20,13'), 'magical sight ignores walls');
assert.equal(resolveVision().radius, 8);
assert.equal(resolveVision({ dark: true }).radius, 4);
assert.equal(resolveVision({ dark: true, torch: true }).radius, 8);
assert.equal(resolveVision({ magicalSight: true, blinded: true }).radius, 0);
assert.equal(resolveVision({ magicalSight: true, blinded: true }).ignoreObstacles, false);
assert.equal(resolveVision({ mindVision: true, blinded: true }).mindVision, true, 'mind sense is separate from optical sight');
const ordinary = computeFOV(map, 15, 15, resolveVision().radius);
const mind = computeFOV(map, 15, 15, resolveVision({ mindVision: true }).radius);
assert.deepEqual(mind, ordinary, 'mind vision never reveals extra terrain');
const effects = load('src/games/rogue0/effects.ts', { ...tiles, spawnEntityFloatingText() {} });
const context = { simulationTime: 0, messages: [] };
const hero = { name: 'Hero', effects: [], accuracy: 100, context };
for (const factory of [effects.createTorchEffect, effects.createMagicalSightEffect,
  effects.createMindVisionEffect, effects.createBlindedEffect]) {
  const effect = factory(1);
  effects.applyEffect(hero, effect);
  assert.ok(effects.hasEffect(hero, effect.id));
  context.simulationTime++;
  effects.tickEffects(hero, context);
  assert.ok(!effects.hasEffect(hero, effect.id), 'vision buffs expire on world time, including while waiting');
}
assert.equal(hero.accuracy, 100, 'blindness restores accuracy');
// Grass hides occupants, not the terrain endpoint. All detection uses the
// same distance rule; mind markers remain separate from optical targeting.
tiles.clearAllFeatures();
const clearing = Array.from({ length: 9 }, () => Array(9).fill(0));
const sight = load('src/games/rogue0/fov.ts', tiles);
for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
  tiles.setFeature(4 + dx, 4 + dy, 'grass');
  const fov = sight.computeFOV(clearing, 4, 4);
  assert.ok(fov.has(`${4 + dx},${4 + dy}`), 'adjacent grass remains visible');
  for (const side of [-1, 1]) {
    const x = 4 + dx - dy * side, y = 4 + dy + dx * side;
    assert.ok(fov.has(`${x},${y}`), 'see one tile to either side of the adjacent grass');
    assert.ok(sight.canSee(clearing, 4, 4, x, y, 8), 'targeting agrees with grass-side visibility');
    assert.ok(sight.hasLineOfSight(clearing, x, y, 4, 4), 'grass-side sight stays reciprocal');
  }
  assert.ok(!fov.has(`${4 + 2 * dx},${4 + 2 * dy}`), 'grass still hides tiles directly behind it');
  tiles.clearAllFeatures();
}
tiles.setFeature(5, 4, 'grass');
tiles.setFeature(4, 5, 'grass');
assert.ok(!sight.hasLineOfSight(clearing, 4, 4, 5, 5), 'two touching grass blockers do not open a diagonal sight leak');
tiles.clearAllFeatures();
clearing[4][5] = 1;
assert.ok(!sight.hasLineOfSight(clearing, 4, 4, 5, 5), 'hard wall corners still block peeking');
clearing[4][5] = 0;

const { fogFeatherRects } = load('src/games/rogue0/rendering.ts');
// Scene0 creates exploration rows lazily; new floors have holes before and
// between discovered rows. Saved/restored arrays can contain nulls instead.
const sparseSeen = [];
sparseSeen[3] = [];
sparseSeen[3][2] = true;
sparseSeen[6] = [];
sparseSeen[6][4] = true;
const denseSeen = Array.from({ length: 7 }, () => Array(5).fill(false));
denseSeen[3][2] = denseSeen[6][4] = true;
assert.deepEqual(fogFeatherRects(sparseSeen), fogFeatherRects(denseSeen), 'sparse exploration matches a dense map');
assert.deepEqual(fogFeatherRects(JSON.parse(JSON.stringify(sparseSeen))), fogFeatherRects(denseSeen), 'restored null rows remain unexplored');
assert.deepEqual(fogFeatherRects([]), [], 'fresh empty exploration is safe');
assert.equal(0 in sparseSeen, false, 'rendering does not fill undiscovered rows');
const explored = [[false, false, false], [false, true, false], [false, false, false]];
const edges = fogFeatherRects(explored);
assert.equal(edges.length, 20, 'five fade bands on each exposed edge');
for (const edge of edges) {
  assert.ok(edge.x >= 16 && edge.y >= 16 && edge.x + edge.width <= 32 && edge.y + edge.height <= 32,
    'fog feather never exposes any part of unknown cells');
  assert.ok(edge.alpha > 0 && edge.alpha < 1);
}
assert.ok(edges[0].alpha > edges[4].alpha, 'fade gets lighter toward the explored interior');
assert.deepEqual(fogFeatherRects([[false]]), [], 'unexplored map has no transparent fringes');
assert.deepEqual(explored, [[false, false, false], [false, true, false], [false, false, false]], 'visual feather never changes exploration');

tiles.setFeature(4, 4, 'grass');
assert.ok(sight.computeFOV(clearing, 1, 4).has('4,4'));
assert.ok(!sight.canSee(clearing, 1, 4, 4, 4, 8));
assert.ok(sight.canSee(clearing, 3, 4, 4, 4, 8));
assert.ok(tiles.isGrassConcealed(4, 4, 1, 4));
assert.ok(!tiles.isGrassConcealed(4, 4, 3, 3), 'diagonal adjacency reveals');
const ai = load('src/games/rogue0/ai.ts', {
  ...sight, tiles, hasEffect: () => false, dungeon: { getCurrentLevel: () => clearing }
});
const ambusher = { type: 'player', x: 4, y: 4, attack: () => 4, effects: [], accuracy: 100 };
const guard = { type: 'enemy', name: 'Guard', x: 1, y: 4, visionRadius: 8,
  awareOfPlayer: true, protection: () => 0, evasion: 0, effects: [], resistance: {}, vulnerability: {} };
let refreshes = 0;
const coverContext = { player: ambusher, currentLevel: clearing, visibleTiles: new Set(['4,4']),
  messages: [], onCoverChanged: () => refreshes++ };
guard.context = ambusher.context = coverContext;
assert.ok(!ai.enemyCanSeePlayer(guard), 'grass breaks current awareness');
const combat = load('src/games/rogue0/combat.ts', { ...sight, tiles, ...effects });
assert.ok(combat.isSurpriseAttack(coverContext, ambusher, guard));
combat.resolveAttack(coverContext, ambusher, guard);
assert.equal(tiles.getFeature(4, 4), undefined, 'attack flattens cover');
assert.equal(refreshes, 1);
assert.ok(ai.enemyCanSeePlayer(guard));
assert.ok(!combat.isSurpriseAttack(coverContext, ambusher, guard), 'no repeated cover ambush');
const Hero = load('src/games/rogue0/classes/basicHero.ts', {
  Entity: class {}, ...tiles, dungeon: { inspectTile: () => 'Tall grass' }
}).default;
const hidden = { type: 'enemy', x: 4, y: 4, sprite: {} };
const observer = Object.assign(Object.create(Hero.prototype), { x: 1, y: 4,
  context: { visibleTiles: new Set(['4,4']), entities: [hidden] } });
tiles.setFeature(4, 4, 'grass');
assert.equal(observer.nearestVisibleEnemy(8), undefined);
assert.deepEqual(observer.visibleEnemiesInRadius(8), []);
observer.inspectTile(4, 4);
assert.equal(observer.context.inspectedEntity, undefined);
assert.equal(observer.context.inspectedTerrain, 'Tall grass');
// Loot uses the same inspection guard as actors.
hidden.type = 'item';
observer.inspectTile(4, 4);
assert.equal(observer.context.inspectedEntity, undefined);
hidden.type = 'enemy';
observer.x = 3;
observer.inspectTile(4, 4);
assert.equal(observer.context.inspectedEntity, hidden);
assert.equal(observer.nearestVisibleEnemy(8), hidden);
tiles.clearAllFeatures();
console.log('Rogue0 vision geometry, terrain, grass concealment/ambush/targeting, modifiers and effect expiry passed');
