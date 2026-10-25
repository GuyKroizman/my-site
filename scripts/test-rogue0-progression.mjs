import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('progression');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function load(path, bindings = {}) {
  const source = fs.readFileSync(path, 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
  const exports = {};
  new Function('exports', ...Object.keys(bindings), ts.transpile(source, {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }))(exports, ...Object.values(bindings));
  return exports;
}
const { Entity, upgrade } = load('src/games/rogue0/entity.ts');
// No rendering in simulation tests; retain the real item constructors/stats.
Entity.prototype.init = function(context, x, y) { Object.assign(this, { context, x, y }); };
let maximum = false;
const Phaser = { Scene: class {}, Math: { Between: (min, max) => maximum ? max : min } };
const { TieredWeapon, TieredArmor } = load('src/games/rogue0/items/tieredEquipment.ts', { Entity, Phaser });
const Gem = load('src/games/rogue0/items/gem.ts', { Entity }).default;
const gem = new Gem({});
assert.equal(gem.canEnchant(new TieredArmor({})), true);
assert.equal(gem.canEnchant(new TieredWeapon({})), true);
assert.equal(gem.canEnchant(new Entity()), false);
const progression = load('src/games/rogue0/progression.ts');
const { createGameContext } = load('src/games/rogue0/context.ts');
assert.equal(createGameContext().maxFloor, 25);
for (let tier = 1; tier <= 5; tier++) {
  for (const Cls of [TieredWeapon, TieredArmor]) {
    const item = new Cls({ messages: [] }, undefined, undefined, tier);
    assert.equal(item.tier, tier);
    assert.equal(item.requiredStrength, 8 + tier * 2);
    assert.equal(item.identified, false);
    assert.equal(item.strengthDescription(10), '');
    assert.ok(!item.displayName.includes(item.name));
    for (let level = 0; level < 4; level++) {
      assert.equal(item.level, level);
      if (Cls === TieredWeapon) {
        maximum = false; assert.equal(item.damage(), tier + level);
        maximum = true; assert.equal(item.damage(), 5 * tier + (tier + 1) * level);
      } else {
        assert.equal(item.protection(), 2 * tier + tier * level);
      }
      upgrade(item);
      assert.equal(item.tier, tier);
      assert.equal(item.identified, false);
    }
    item.identified = true;
    assert.match(item.strengthDescription(10), new RegExp(`Tier ${tier}`));
  }
}
for (let floor = 1; floor <= 25; floor++) {
  const tier = Math.ceil(floor / 5);
  assert.equal(progression.lootTier(floor, 0.5), tier);
  assert.equal(progression.lootTier(floor, 0), Math.max(1, tier - 1));
  assert.equal(progression.lootTier(floor, 0.99), Math.min(5, tier + 1));
}
// Exercise real spawnFloorContent with real maps and item classes. Monsters and
// unrelated items only need identity/position here; their own suites cover AI.
const sceneSource = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
const bindings = { Phaser, TieredWeapon, TieredArmor, ...progression };
for (const match of sceneSource.matchAll(/import (\w+) from "\.\/(?:items|monsters)\/[^";]+";/g)) {
  const name = match[1];
  bindings[name] = class { constructor(context, x, y) { Object.assign(this, { context, x, y, kind: name }); } };
}
for (const name of ['FireElemental', 'IceElemental', 'ShockElemental']) {
  bindings[name] = class { constructor(context, x, y) { Object.assign(this, { context, x, y, kind: name }); } };
}
const mapgen = load('src/games/rogue0/mapgen.ts', { isBlocking: () => false });
bindings.randomWalkableTiles = mapgen.randomWalkableTiles;
let currentMap;
bindings.dungeon = { getCurrentLevel: () => currentMap, log() {} };
bindings.sfx = { stairs() {} };
bindings.tiles = { forEachFeature() {} };
const { Scene0 } = load('src/games/rogue0/scene0.ts', bindings);
for (let run = 0; run < 5; run++) {
  const totals = { strength: 0, upgrades: 0, bosses: 0 };
  for (let floor = 1; floor <= 25; floor++) {
    const scene = Object.create(Scene0.prototype);
    const { map, rooms } = mapgen.generateMap(floor);
    currentMap = map;
    const spawn = { x: rooms[0].cx, y: rooms[0].cy };
    scene.context = { ...createGameContext(), floor, currentLevel: map,
      player: { getAllItems: () => [] }, upstairsX: spawn.x, upstairsY: spawn.y,
      stairsX: rooms.at(-1).cx, stairsY: rooms.at(-1).cy };
    scene.spawnFloorContent(floor, map, spawn);
    const items = scene.context.entities;
    const count = kind => items.filter(item => item.kind === kind).length;
    const spec = progression.floorProgression(floor);
    assert.equal(count('PotionOfStrength'), spec.strengthPotions);
    assert.equal(count('ScrollOfUpgrade'), spec.upgradeScrolls);
    assert.equal(count('Boss'), floor === 25 ? 1 : 0, `boss floor ${floor}`);
    assert.ok(count('Ration') >= 1);
    const occupied = new Set(items.map(item => `${item.x},${item.y}`));
    assert.equal(occupied.size, items.length, 'spawns never overlap');
    assert.ok(!occupied.has(`${spawn.x},${spawn.y}`));
    assert.ok(!occupied.has(`${scene.context.stairsX},${scene.context.stairsY}`));
    for (const [Cls, guaranteed] of [[TieredWeapon, spec.weapon], [TieredArmor, spec.armor]]) {
      if (guaranteed) assert.ok(items.some(item => item instanceof Cls && item.tier === spec.tier));
    }
    totals.strength += count('PotionOfStrength');
    totals.upgrades += count('ScrollOfUpgrade');
    totals.bosses += count('Boss');
    // Saved-floor revisit path reuses remaining items, not generation. Remove a
    // supply before saving to represent picking it up, then descend to snapshot.
    const supply = items.find(item => item.kind === 'PotionOfStrength' || item.kind === 'ScrollOfUpgrade');
    if (supply) items.splice(items.indexOf(supply), 1);
    scene.floors = new Map();
    scene.seen = map.map(row => row.map(() => false));
    scene.saveFloor();
    const snapshot = scene.floors.get(floor);
    assert.ok(!supply || !snapshot.entities.includes(supply));
    scene.context.floor = floor - 1;
    let restored = false;
    scene.restoreFloor = (number, saved) => {
      assert.equal(number, floor);
      assert.equal(saved, snapshot);
      restored = true;
    };
    scene.spawnFloorContent = () => assert.fail('revisit regenerated supplies');
    scene.descend();
    assert.equal(restored, true);
  }
  assert.deepEqual(totals, { strength: 10, upgrades: 15, bosses: 1 });
}
console.log('Rogue0 progression: 25 floors, final boss, five equipment tiers, upgrades, supply quotas and revisits passed');
