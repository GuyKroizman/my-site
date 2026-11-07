import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('progression');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
import { createTerrain } from '../src/games/rogue0/terrain.ts';
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

// Scrolls of Upgrade are a fixed budget, not an RNG outcome: 3 per five-floor
// region, 15 per standard run, and none on the region's boss floor.
assert.equal(progression.REGION_SIZE, 5);
assert.equal(progression.FINAL_FLOOR, 25);
assert.equal(progression.REGIONS_PER_RUN, 5);
assert.equal(progression.UPGRADE_SCROLLS_PER_REGION, 3);
assert.equal(progression.TOTAL_UPGRADE_SCROLLS, 15);
assert.deepEqual([...progression.UPGRADE_SCROLL_FLOOR_POSITIONS], [1, 3, 4]);
const expectedScrollFloors = [1, 3, 4, 6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24];
const actualScrollFloors = [];
for (let floor = 1; floor <= progression.FINAL_FLOOR; floor++) {
  const spec = progression.floorProgression(floor);
  assert.equal(spec.upgradeScrolls, progression.upgradeScrollsForFloor(floor));
  if (spec.upgradeScrolls) actualScrollFloors.push(floor);
}
assert.deepEqual(actualScrollFloors, expectedScrollFloors, 'fixed SoU floor layout');
for (let region = 0; region < progression.REGIONS_PER_RUN; region++) {
  let scrolls = 0;
  for (let floor = region * 5 + 1; floor <= region * 5 + 5; floor++) {
    scrolls += progression.floorProgression(floor).upgradeScrolls;
  }
  assert.equal(scrolls, progression.UPGRADE_SCROLLS_PER_REGION, `region ${region + 1} SoU total`);
}
for (const floor of [5, 10, 15, 20, 25]) {
  assert.equal(progression.isBossFloor(floor), true, `floor ${floor} is a boss floor`);
  assert.equal(progression.floorProgression(floor).upgradeScrolls, 0,
    `boss floor ${floor} never carries a Scroll of Upgrade`);
}
for (let tier = 1; tier <= 5; tier++) {
  for (const Cls of [TieredWeapon, TieredArmor]) {
    const item = new Cls({ messages: [] }, undefined, undefined, tier);
    assert.equal(item.tier, tier);
    assert.equal(item.requiredStrength, 8 + tier * 2);
    assert.equal(item.identified, false);
    assert.match(item.strengthDescription(10), new RegExp(`Tier ${tier}`));
    assert.equal(item.displayName, `${item.name} (Tier ${tier})`);
    const visibleName = item.displayName;
    item.cursed = true;
    assert.equal(item.displayName, visibleName, 'unknown curse must not change the visible name');
    assert.equal(item.identified, false);
    item.cursed = false;
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
// Each band's four ordinary floors carry exactly two Strength potions. The
// fifth floor of every band is the secret-room floor and carries none.
for (const [start, end] of [[1, 4], [6, 9], [11, 14], [16, 19], [21, 24]]) {
  let potions = 0;
  for (let floor = start; floor <= end; floor++) potions += progression.floorProgression(floor).strengthPotions;
  assert.equal(potions, 2, `two Strength potions between floors ${start}-${end}`);
  assert.equal(progression.floorProgression(end + 1).strengthPotions, 0,
    `floor ${end + 1} is the band's secret-room floor with no Strength potion`);
}
// Exercise real spawnFloorContent with real maps and item classes. Monsters and
// unrelated items only need identity/position here; their own suites cover AI.
const sceneSource = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
const bindings = { Phaser, Gem, TieredWeapon, TieredArmor, ...progression };
for (const match of sceneSource.matchAll(/import (\w+) from "\.\/(?:items|monsters)\/[^";]+";/g)) {
  const name = match[1];
  bindings[name] = class { constructor(context, x, y) { Object.assign(this, { context, x, y, kind: name }); } };
}
for (const name of ['FireElemental', 'IceElemental', 'ShockElemental']) {
  bindings[name] = class { constructor(context, x, y) { Object.assign(this, { context, x, y, kind: name }); } };
}
const mapgen = load('src/games/rogue0/mapgen.ts', { isBlocking: () => false });
let walkableTiles = mapgen.randomWalkableTiles;
bindings.randomWalkableTiles = (...args) => walkableTiles(...args);
let currentMap;
bindings.dungeon = { getCurrentLevel: () => currentMap, log() {} };
bindings.sfx = { stairs() {} };
bindings.tiles = createTerrain();
bindings.maybeCurse = () => false; // progression suite asserts supply placement, not curse rolls
const { Scene0 } = load('src/games/rogue0/scene0.ts', bindings);
for (let run = 0; run < 5; run++) {
  const totals = { strength: 0, upgrades: 0, bosses: 0 };
  for (let floor = 1; floor <= 25; floor++) {
    const scene = Object.create(Scene0.prototype);
    const { map, rooms, secretRoom } = mapgen.generateMap(floor);
    scene.secretRoom = secretRoom;
    currentMap = map;
    const spawn = { x: rooms[0].cx, y: rooms[0].cy };
    scene.context = { ...createGameContext(), floor, currentLevel: map,
      player: { getAllItems: () => [] }, upstairsX: spawn.x, upstairsY: spawn.y,
      stairsX: rooms.at(-1).cx, stairsY: rooms.at(-1).cy };
    scene.spawnFloorContent(floor, map, spawn);
    const items = scene.context.entities;
    const treasure = items.filter(item => item instanceof Gem);
    if (mapgen.floorHasSecretRoom(floor)) {
      assert.equal(treasure.length, 1, 'exactly one ordinary gem rewards each secret room');
      for (const gem of treasure) {
        assert.equal(gem.x, secretRoom.cx);
        assert.equal(gem.y, secretRoom.cy);
      }
      assert.ok(items.filter(item => !(item instanceof Gem)).every(item => item.y >= secretRoom.y + 5), 'random content stays outside the hidden room and corridor');
    } else {
      assert.equal(treasure.length, 0, 'no gem reward without a secret room');
      assert.equal(secretRoom, undefined, 'secret room only appears on band floors');
    }
    const count = kind => items.filter(item => item.kind === kind).length;
    const spec = progression.floorProgression(floor);
    assert.equal(count('PotionOfStrength'), spec.strengthPotions);
    assert.equal(count('ScrollOfUpgrade'), spec.upgradeScrolls);
    assert.equal(count('Boss'), floor === 25 ? 1 : 0, `boss floor ${floor}`);
    assert.ok(count('Ration') >= 1);
    assert.equal(count('Chest'), 2, 'two real treasure chests accompany the encounter roster');
    assert.equal(count('Mimic'), floor >= 2 ? 1 : 0);
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
    if (treasure.length) items.splice(items.indexOf(treasure[0]), 1); // Pick up one reward before leaving.
    scene.floors = new Map();
    scene.seen = map.map(row => row.map(() => false));
    scene.saveFloor();
    const snapshot = scene.floors.get(floor);
    assert.ok(!supply || !snapshot.entities.includes(supply));
    assert.equal(snapshot.entities.filter(item => item instanceof Gem).length, 0, 'collected gems stay collected across floor revisits');
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

// SoU are also excluded from every other loot source, so the 15-item budget
// only ever comes from the guaranteed floor allocation above.
const lootTableSource = sceneSource.match(/const LOOT_TABLE[\s\S]*?\];/)?.[0] ?? '';
assert.ok(lootTableSource.length > 0, 'found the random loot table');
assert.ok(!lootTableSource.includes('ScrollOfUpgrade'), 'upgrade scrolls never roll as random floor loot');
const chestSource = fs.readFileSync('src/games/rogue0/items/chest.ts', 'utf8');
assert.ok(!chestSource.includes('ScrollOfUpgrade'), 'treasure chests never add upgrade scrolls');

// Adversarial map budget: even with no shuffled tiles available at all, the
// deterministic fallback still places every guaranteed scroll and never puts
// one on a boss floor.
walkableTiles = () => [];
for (const [floor, expected] of [[1, 1], [2, 0], [3, 1], [4, 1], [5, 0], [6, 1], [10, 0], [25, 0]]) {
  const scene = Object.create(Scene0.prototype);
  const { map, rooms, secretRoom } = mapgen.generateMap(floor);
  scene.secretRoom = secretRoom;
  currentMap = map;
  const spawn = { x: rooms[0].cx, y: rooms[0].cy };
  scene.context = { ...createGameContext(), floor, currentLevel: map,
    player: { getAllItems: () => [] }, upstairsX: spawn.x, upstairsY: spawn.y,
    stairsX: rooms.at(-1).cx, stairsY: rooms.at(-1).cy };
  scene.spawnFloorContent(floor, map, spawn);
  const scrolls = scene.context.entities.filter(item => item.kind === 'ScrollOfUpgrade');
  assert.equal(scrolls.length, expected, `floor ${floor} keeps its SoU quota without shuffled tiles`);
  const occupied = new Set(scene.context.entities.map(item => `${item.x},${item.y}`));
  assert.equal(occupied.size, scene.context.entities.length, 'fallback spawns never overlap');
}
walkableTiles = mapgen.randomWalkableTiles;
console.log('Rogue0 progression: deterministic 15 SoU / 3 per region / no boss-floor SoU, 25 floors, final boss, five equipment tiers, supply quotas and revisits passed');
