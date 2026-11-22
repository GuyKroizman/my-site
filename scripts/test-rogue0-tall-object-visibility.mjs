import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('tall-object-visibility');
import assert from 'node:assert/strict';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
import { createTerrain } from '../src/games/rogue0/terrain.ts';
import { computeFOV } from '../src/games/rogue0/fov.ts';
import { resolveEntityVisibility } from '../src/games/rogue0/actorVisibility.ts';

const { Entity } = load('src/games/rogue0/entity.ts');
Entity.prototype.init = function(context, x, y) { Object.assign(this, { context, x, y }); };
const rewards = {};
for (const name of ['Gold', 'Ration', 'PotionOfHealing', 'TieredWeapon', 'TieredArmor']) {
  rewards[name] = class extends Entity {};
}
const dungeon = { canStepBetween: () => true, log: () => {}, getCurrentLevel: () => [] };
const { thinTier1Armor } = load('src/games/rogue0/progression.ts');
const Chest = load('src/games/rogue0/items/chest.ts', { Entity, dungeon,
  maybeCurse: () => false,
  rollFoundUpgrade: load('src/games/rogue0/foundUpgrades.ts', { Entity }).rollFoundUpgrade,
  CHEST_TEXTURE: 'chest-closed', thinTier1Armor, ...rewards }).default;
const Monster = class extends Entity {
  constructor(context, config, x, y) {
    super();
    Object.assign(this, config);
    this.type = 'enemy';
    this.init(context, x, y);
  }
};
const Mimic = load('src/games/rogue0/monsters/mimic.ts', {
  Monster, CHEST_TEXTURE: 'chest-closed', MIMIC_TEXTURE: 'mimic-revealed',
}).default;

const context = { floor: 11, messages: [], entities: [] };
const chest = new Chest(context, 4, 4, []);
const mimic = new Mimic(context, 4, 4);
const item = Object.assign(new Entity(), { type: 'item', x: 4, y: 4 });
const monster = Object.assign(new Entity(), { type: 'enemy', x: 4, y: 4 });
const occupants = { chest, mimic, item, monster };
const map = Array.from({ length: 9 }, () => Array(9).fill(0));
const tiles = createTerrain();

function viewFrom(x, y, overrides = {}) {
  const visibleTiles = computeFOV(map, x, y, 8, false, tiles);
  return {
    visibleTiles,
    isSeen: (tx, ty) => visibleTiles.has(`${tx},${ty}`),
    isGrassConcealed: (tx, ty) => tiles.isGrassConcealed(tx, ty, x, y),
    foreground: new Set(),
    ...overrides,
  };
}

function rendered(entity, x, y, overrides) {
  const view = viewFrom(x, y, { foreground: new Set([entity]), ...overrides });
  return resolveEntityVisibility(entity, view);
}

try {
  // Only tall chest-shaped objects opt out of the grass-under-foot rule.
  assert.equal(chest.visibleAboveGrass, true, 'a chest stands above its grass');
  assert.equal(mimic.visibleAboveGrass, true, 'a chest-shaped mimic stands above its grass');
  assert.equal(item.visibleAboveGrass, false, 'ordinary loot stays hidden in grass');
  assert.equal(monster.visibleAboveGrass, false, 'ordinary monsters stay hidden in grass');

  // Grass on the object's own tile is the reported bug: the tile is in sight,
  // but a distance-based concealment test used to switch the sprite off.
  tiles.setFeature(4, 4, 'grass');
  let view = viewFrom(1, 4);
  assert.ok(view.visibleTiles.has('4,4'), 'the grass tile itself stays in sight');
  assert.equal(tiles.isGrassConcealed(4, 4, 1, 4), true, 'ordinary occupants are concealed at range');
  for (const [name, entity] of Object.entries(occupants)) {
    const result = rendered(entity, 1, 4);
    assert.equal(result.rendered, name === 'chest' || name === 'mimic',
      `${name} ${name === 'chest' || name === 'mimic' ? 'is drawn' : 'stays concealed'} on grass at range`);
  }

  // Another grass tile along the line of sight still interrupts the view: the
  // object's cell drops out of the FOV, so no exception can reveal it.
  tiles.setFeature(3, 4, 'grass');
  view = viewFrom(1, 4);
  assert.ok(!view.visibleTiles.has('4,4'), 'grass before the object hides its tile');
  for (const name of ['chest', 'mimic']) {
    assert.equal(rendered(occupants[name], 1, 4).rendered, false,
      `${name} hidden behind intervening grass`);
  }
  tiles.clearFeature(3, 4);

  // Nothing changes next to the object: adjacency already revealed occupants,
  // so the new rule is only a wider version of the same sightline.
  view = viewFrom(3, 4);
  assert.ok(view.visibleTiles.has('4,4'));
  for (const [name, entity] of Object.entries(occupants)) {
    assert.equal(rendered(entity, 3, 4).rendered, true, `${name} is drawn when adjacent`);
  }

  // A chest on plain floor remains visible at range, with or without the flag.
  tiles.clearAllFeatures();
  assert.equal(rendered(chest, 1, 4).rendered, true, 'chest on floor is seen across the room');

  // Remembered items are still drawn outside current sight (dimmed by fog).
  const remembered = Object.assign(new Entity(), { type: 'item', x: 7, y: 4 });
  const outsideSight = rendered(remembered, 1, 4, { visibleTiles: new Set(), isSeen: () => true });
  assert.deepEqual(outsideSight, { visible: false, rendered: true }, 'seen loot stays remembered');

  // The flag lives on the prototype, so old saves decoded without the field
  // still draw their chests and mimics above grass.
  const { encodeGraph, decodeGraph } = load('src/games/rogue0/saveCodec.ts');
  const registry = { Entity, Chest, Mimic, ...rewards };
  const graph = JSON.parse(JSON.stringify(encodeGraph([chest, mimic], registry)));
  const [restoredChest, restoredMimic] = decodeGraph(graph, registry);
  assert.equal(restoredChest.visibleAboveGrass, true, 'restored chest keeps the tall-object rule');
  assert.equal(restoredMimic.visibleAboveGrass, true, 'restored mimic keeps the tall-object rule');
  tiles.clearAllFeatures();
} finally {
  tiles.clearAllFeatures();
}
console.log('Rogue0 tall-object visibility: chests and mimics show above their grass; intervening grass and ordinary concealment still hide occupants');
