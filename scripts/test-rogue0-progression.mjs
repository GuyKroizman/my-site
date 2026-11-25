import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('progression');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
import { createTerrain } from '../src/games/rogue0/terrain.ts';
import { floorMonsterRoster, elementalKindsForFloor } from '../src/games/rogue0/monsterBalance.ts';
import { bossEncounter, hasLivingHostiles, isMawFloor, isWandFactoryFloor } from '../src/games/rogue0/bossEncounters.ts';
const { Entity, upgrade } = load('src/games/rogue0/entity.ts');
// No rendering in simulation tests; retain the real item constructors/stats.
Entity.prototype.init = function(context, x, y) { Object.assign(this, { context, x, y }); };
let maximum = false;
const Phaser = { Scene: class {}, Math: { Between: (min, max) => maximum ? max : min } };
const { TieredWeapon, TieredArmor } = load('src/games/rogue0/items/tieredEquipment.ts', { Entity, Phaser });
const Gold = load('src/games/rogue0/items/gold.ts', { Entity }).default;
const progression = load('src/games/rogue0/progression.ts', { bossEncounter, hasLivingHostiles });
const { rollFoundUpgrade } = load('src/games/rogue0/foundUpgrades.ts', { Entity });
const { createGameContext } = load('src/games/rogue0/context.ts');
const { bossSealsFloor } = progression;
assert.equal(createGameContext().maxFloor, 25);
{
  const locked = { ...createGameContext(), floor: 5 };
  assert.equal(bossSealsFloor(locked), true, 'floor 5 is sealed while the Writhing Maw lives');
  locked.bossesSlain.add(5);
  assert.equal(bossSealsFloor(locked), false, 'killing the Writhing Maw unseals the floor');
  locked.floor = 6;
  assert.equal(bossSealsFloor(locked), false, 'ordinary floors are never sealed');
}
{
  const factory = { ...createGameContext(), floor: 10, bossesSlain: new Set(),
    entities: [{ type: 'enemy', healthPoints: 5 }] };
  assert.equal(bossSealsFloor(factory), true, 'the factory is sealed while a hostile lives');
  factory.bossesSlain.add(10);
  assert.equal(bossSealsFloor(factory), true,
    'a stale cleared flag cannot open a factory that still has enemies');
  factory.entities = [];
  assert.equal(bossSealsFloor(factory), false, 'clearing every hostile opens the factory');
  assert.equal(bossEncounter(10).win, 'all-hostiles-cleared');
  assert.equal(bossEncounter(5).win, 'boss-slain');
}

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
    assert.equal(item.displayName, `${item.name} ? (Tier ${tier})`);
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
    assert.equal(item.displayName, `${item.name} ? (Tier ${tier})`,
      'unidentified gear never leaks its upgrade level through its name');
    item.identified = true;
    assert.equal(item.displayName, `${item.name} +4 (Tier ${tier})`);
    assert.match(item.strengthDescription(10), new RegExp(`Tier ${tier}`));
  }
}
for (let floor = 1; floor <= 25; floor++) {
  const tier = Math.ceil(floor / 5);
  assert.equal(progression.lootTier(floor, 0.5), tier);
  assert.equal(progression.lootTier(floor, 0), Math.max(1, tier - 1));
  assert.equal(progression.lootTier(floor, 0.99), Math.min(5, tier + 1));
}
// Tier-1 Cloth Armor is thinned out, but weapons keep the original tier curve.
assert.equal(progression.TIER1_ARMOR_KEEP_CHANCE, 0.35);
for (const keepRoll of [0, 0.34, 0.35, 0.99]) {
  assert.equal(progression.thinTier1Armor(1, keepRoll), keepRoll < 0.35 ? 1 : 2);
  assert.equal(progression.thinTier1Armor(3, keepRoll), 3, 'higher armor tiers are never bumped');
}
assert.equal(progression.armorLootTier(1, 0.5, 0.1), 1, 'a kept tier-1 roll stays cloth');
assert.equal(progression.armorLootTier(1, 0.5, 0.9), 2, 'most tier-1 armor rolls become leather');
assert.equal(progression.armorLootTier(6, 0, 0.9), 2, 'a floor-6 tier-1 roll is bumped too');
assert.equal(progression.armorLootTier(16, 0.99, 0.9), 5, 'deep armor tiers are unaffected');
{
  const samples = 1000;
  let cloth = 0;
  for (let i = 0; i < samples; i++) {
    if (progression.armorLootTier(3, i / samples, ((i * 7919) % samples) / samples) === 1) cloth++;
  }
  assert.ok(cloth / samples < 0.35,
    'tier-1 armor is a minority of first-band armor finds');
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
const bindings = { Phaser, Gold, TieredWeapon, TieredArmor, ...progression,
  hasLivingHostiles, isMawFloor, isWandFactoryFloor };
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
bindings.floorRollsLevitationLoot = mapgen.floorRollsLevitationLoot;
bindings.pickChasmRoomFloor = mapgen.pickChasmRoomFloor;
bindings.CHASM_ROOM_FLOORS = mapgen.CHASM_ROOM_FLOORS;
let currentMap;
bindings.dungeon = { getCurrentLevel: () => currentMap, log() {} };
bindings.sfx = { stairs() {} };
// resolveFall applies the lingering wound through the shared effect helpers;
// this suite only exercises floor generation, not falls.
bindings.applyEffect = () => {};
bindings.createWoundedEffect = duration => ({ id: 'wounded', name: 'Wounded', duration });
bindings.tiles = createTerrain();
bindings.maybeCurse = () => false; // progression suite asserts supply placement, not curse rolls
bindings.rollFoundUpgrade = rollFoundUpgrade;
const equipmentFinds = load('src/games/rogue0/equipmentFinds.ts', {
  ...progression, TieredWeapon, TieredArmor, rollFoundUpgrade, maybeCurse: bindings.maybeCurse,
});
Object.assign(bindings, equipmentFinds);
let equipmentRoll = 0;
bindings.rollFloorEquipment = floor => equipmentFinds.rollFloorEquipment(floor, () => equipmentRoll);
bindings.createEquipmentFind = (...args) => Object.assign(equipmentFinds.createEquipmentFind(...args), { bonusFind: true });
const { Scene0 } = load('src/games/rogue0/scene0.ts', bindings);
// Exercise the real scene's reinforcement constructor route at both ends of
// each elemental variant pool, not merely the pure unlock helper.
{
  const originalRandom = Math.random;
  try {
    for (const [floor, expected] of [[18, ['FireElemental', 'FireElemental']],
      [21, ['FireElemental', 'IceElemental']], [23, ['FireElemental', 'ShockElemental']]]) {
      const scene = Object.create(Scene0.prototype);
      scene.context = { floor };
      for (const [index, roll] of [0, 0.999999].entries()) {
        Math.random = () => roll;
        assert.equal(scene.reinforcementActor('elemental', 2, 3).kind, expected[index]);
      }
    }
  } finally { Math.random = originalRandom; }
}
for (let run = 0; run < 5; run++) {
  equipmentRoll = run % 2 ? equipmentFinds.FLOOR_EQUIPMENT_CHANCE : 0;
  // One run settles its chasm room on a single early floor.
  const chasmRoomFloor = mapgen.pickChasmRoomFloor();
  const totals = { strength: 0, upgrades: 0, bosses: 0 };
  for (let floor = 1; floor <= 25; floor++) {
    const scene = Object.create(Scene0.prototype);
    const generated = mapgen.generateMap(floor, chasmRoomFloor);
    const { map, rooms, secretRoom, chasmRoom } = generated;
    scene.secretRoom = secretRoom;
    scene.chasmRoom = chasmRoom;
    scene.bossArena = generated.bossArena;
    currentMap = map;
    const spawn = generated.spawn ?? { x: rooms[0].cx, y: rooms[0].cy };
    // Mirror the scene: the map may state its exit (the boss arena does),
    // otherwise it is the farthest walkable tile from the arrival.
    const stairs = generated.stairs ?? mapgen.findFarthestWalkable(map, spawn.x, spawn.y, 80);
    scene.context = { ...createGameContext(), floor, currentLevel: map,
      player: { getAllItems: () => [] }, upstairsX: spawn.x, upstairsY: spawn.y,
      stairsX: stairs.x, stairsY: stairs.y };
    scene.spawnFloorContent(floor, map, spawn);
    const items = scene.context.entities;
    const treasure = items.filter(item => item instanceof Gold);
    if (mapgen.floorHasSecretRoom(floor)) {
      assert.equal(treasure.length, 1, 'exactly one gold pile rewards each secret room');
      for (const gold of treasure) {
        assert.equal(gold.x, secretRoom.cx);
        assert.equal(gold.y, secretRoom.cy);
        assert.equal(gold.goldAmount, 25);
      }
      assert.ok(items.filter(item => !(item instanceof Gold)).every(item => item.y >= secretRoom.y + 5), 'random content stays outside the hidden room and corridor');
    } else {
      assert.equal(treasure.length, 0, 'no gold reward without a secret room');
      assert.equal(secretRoom, undefined, 'secret room only appears on band floors');
    }
    const count = kind => items.filter(item => item.kind === kind).length;
    const roster = floorMonsterRoster(floor);
    for (const [kind, cls] of Object.entries({ skeleton: 'Skeleton', frog: 'DeadlyFrog', swarm: 'SwarmOfFlies',
      goblin: 'Goblin', quloptsh: 'Quloptsh', ghoul: 'Ghoul', brute: 'Brute', cultist: 'Cultist',
      wraith: 'Wraith', mimic: 'Mimic', boss: 'Boss',
      firePotionThrower: 'FirePotionThrower' })) {
      assert.equal(count(cls), roster[kind], `floor ${floor}: actual ${kind} quota`);
    }
    const elementalClasses = { fire: 'FireElemental', ice: 'IceElemental', shock: 'ShockElemental' };
    assert.equal(Object.values(elementalClasses).reduce((sum, cls) => sum + count(cls), 0), roster.elemental);
    for (const [kind, cls] of Object.entries(elementalClasses)) {
      if (!elementalKindsForFloor(floor).includes(kind)) assert.equal(count(cls), 0,
        `floor ${floor} must not place locked ${kind} elementals`);
    }
    const spec = progression.floorProgression(floor);
    assert.equal(count('PotionOfStrength'), spec.strengthPotions);
    assert.equal(count('ScrollOfUpgrade'), spec.upgradeScrolls);
    assert.equal(count('Boss'), isMawFloor(floor) ? 1 : 0, `Maw boss floor ${floor}`);
    assert.ok(count('Ration') >= 1);
    assert.equal(count('Chest'), chasmRoom ? 3 : 2,
      'two real treasure chests accompany the encounter roster, plus the chasm room treasure');
    // A chasm room always carries exactly one Potion of Levitation, now placed
    // at a random walkable tile on the open floor rather than on the band, and
    // its extra chest waits on the otherwise unreachable island. Floors 1-7
    // never roll levitation as ordinary loot.
    const levitations = items.filter(item => item.kind === 'PotionOfLevitation');
    if (chasmRoom) {
      const potion = levitations[0];
      assert.ok(potion, `floor ${floor} chasm room still guarantees a levitation potion`);
      // The key is no longer parked on the band beside the moat. It must lie on
      // an ordinary walkable tile outside the whole chasm chamber.
      assert.notDeepEqual({ x: potion.x, y: potion.y },
        { x: chasmRoom.approach.x, y: chasmRoom.approach.y },
        `floor ${floor} levitation potion no longer sits on the chasm band`);
      const chamber = chasmRoom.room;
      const insideChamber = potion.x >= chamber.x && potion.x < chamber.x + chamber.w &&
        potion.y >= chamber.y && potion.y < chamber.y + chamber.h;
      assert.equal(insideChamber, false,
        'the guaranteed levitation potion lies on the open floor, not in the chasm room');
      assert.equal(map[potion.y][potion.x], 0, 'levitation potion rests on a walkable floor tile');
      // Only the run's own chasm floor is certain; deeper floors get there 5%
      // of the time.
      if (floor === chasmRoomFloor) {
        assert.ok(mapgen.floorHasChasmRoom(floor, chasmRoomFloor));
      }
      // The item classes are fakes here, so only assert that generation never
      // forces identification on the instance.
      assert.ok(!potion.identified,
        'the chasm room potion stays unidentified like every other potion');
      if (floor < 8) {
        assert.equal(levitations.length, 1,
          `floor ${floor} hands out levitation only through its chasm room`);
      }
      const islandKeys = new Set(chasmRoom.island.map(tile => `${tile.x},${tile.y}`));
      const islandChest = items.find(item => item.kind === 'Chest' &&
        islandKeys.has(`${item.x},${item.y}`));
      assert.ok(islandChest, 'the chasm room treasure chest waits on the island');
      assert.deepEqual({ x: islandChest.x, y: islandChest.y }, chasmRoom.reward);
    } else if (floor < 8) {
      assert.equal(levitations.length, 0,
        `floor ${floor} has no levitation potion without a chasm room`);
    } else {
      assert.ok(levitations.length <= 3,
        `floor ${floor} may roll levitation as ordinary loot, never more than its loot slots`);
    }
    assert.equal(count('SkeletalRemains'), progression.isBossFloor(floor) ? 0 : 1,
      'one searchable bone pile per non-boss floor');
    const bonusFinds = items.filter(item => item.bonusFind);
    assert.equal(bonusFinds.length,
      !progression.isBossFloor(floor) && equipmentRoll < equipmentFinds.FLOOR_EQUIPMENT_CHANCE ? 1 : 0,
      'floor equipment roll spawns exactly one bonus find on success, never on boss floors');
    for (const item of bonusFinds) assert.equal(item.identified, false);
    assert.equal(count('Mimic'), !progression.isBossFloor(floor) && floor >= 2 ? 1 : 0,
      'no mimic disguises itself on a boss floor');
    if (isMawFloor(floor)) {
      // A Maw arena carries the boss, two chests, one ration and the hidden
      // room's gold, nothing else.
      const nameOf = item => item.kind ?? item.constructor?.name;
      const allowed = new Set(['Boss', 'Chest', 'Ration', 'Gold']);
      const strays = items.filter(item => !allowed.has(nameOf(item)));
      assert.deepEqual(strays.map(nameOf), [],
        `boss floor ${floor} holds no other monsters, loot or bone piles`);
      assert.equal(items.filter(item => nameOf(item) === 'Boss').length, 1,
        `boss floor ${floor} holds exactly one Writhing Maw`);
      const writhingMaw = items.find(item => nameOf(item) === 'Boss');
      assert.deepEqual({ x: writhingMaw.x, y: writhingMaw.y }, generated.bossArena,
        `boss floor ${floor} places its Writhing Maw in the middle of the arena`);
      assert.notDeepEqual({ x: writhingMaw.x, y: writhingMaw.y }, spawn,
        'the hero does not arrive on top of the Writhing Maw');
    } else if (isWandFactoryFloor(floor)) {
      const nameOf = item => item.kind ?? item.constructor?.name;
      const allowed = new Set(['FirePotionThrower', 'Skeleton', 'Goblin', 'FireElemental',
        'Chest', 'Ration', 'Gold']);
      const strays = items.filter(item => !allowed.has(nameOf(item)));
      assert.deepEqual(strays.map(nameOf), [],
        'the factory keeps the sparse boss-floor policy but has no boss or loot');
      assert.equal(count('FirePotionThrower'), 2, 'the factory is guarded by two throwers');
      assert.equal(count('FireElemental'), roster.elemental, 'fire elements guard the factory');
      assert.equal(count('Boss'), 0, 'the factory has no Writhing Maw');
    }
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
    assert.equal(snapshot.entities.filter(item => item instanceof Gold).length, 0, 'collected gold stays collected across floor revisits');
    scene.context.floor = floor - 1;
    let restored = false;
    scene.restoreFloor = (number, saved) => {
      assert.equal(number, floor);
      assert.equal(saved, snapshot);
      restored = true;
    };
    scene.spawnFloorContent = () => assert.fail('revisit regenerated supplies');
    // This loop exercises snapshot/restore travel, not the boss gate. Mark
    // the floor we are leaving as cleared so descending is permitted.
    scene.context.bossesSlain = new Set([floor - 1]);
    scene.descend();
    assert.equal(restored, true);
  }
  assert.deepEqual(totals, { strength: 10, upgrades: 15, bosses: 4 },
    'floor 10 is the Wand Factory, so only four Writhing Maws are generated');
}

// SoU are also excluded from every other loot source, so the 15-item budget
// only ever comes from the guaranteed floor allocation above.
const lootTableSource = sceneSource.match(/const LOOT_TABLE[\s\S]*?\];/)?.[0] ?? '';
assert.ok(lootTableSource.length > 0, 'found the random loot table');
assert.ok(!lootTableSource.includes('ScrollOfUpgrade'), 'upgrade scrolls never roll as random floor loot');
const chestSource = fs.readFileSync('src/games/rogue0/items/chest.ts', 'utf8');
assert.ok(!chestSource.includes('ScrollOfUpgrade'), 'treasure chests never add upgrade scrolls');
assert.ok(chestSource.includes('forcedContents'), 'chests accept authored reward contents');
assert.ok(sceneSource.includes('new StoneOfInfusion'), 'the chasm island chest is stocked with a Stone of Infusion');
assert.ok(sceneSource.includes('CHASM_CHEST_GOLD'), 'the chasm island chest carries a larger purse');

// Adversarial map budget: even with no shuffled tiles available at all, the
// deterministic fallback still places every guaranteed scroll and never puts
// one on a boss floor.
walkableTiles = () => [];
for (const [floor, expected] of [[1, 1], [2, 0], [3, 1], [4, 1], [5, 0], [6, 1], [10, 0], [25, 0]]) {
  const scene = Object.create(Scene0.prototype);
  const generated = mapgen.generateMap(floor);
  const { map, rooms, secretRoom } = generated;
  scene.secretRoom = secretRoom;
  scene.chasmRoom = generated.chasmRoom;
  scene.bossArena = generated.bossArena;
  currentMap = map;
  const spawn = generated.spawn ?? { x: rooms[0].cx, y: rooms[0].cy };
  const stairs = generated.stairs ?? mapgen.findFarthestWalkable(map, spawn.x, spawn.y, 80);
  scene.context = { ...createGameContext(), floor, currentLevel: map,
    player: { getAllItems: () => [] }, upstairsX: spawn.x, upstairsY: spawn.y,
    stairsX: stairs.x, stairsY: stairs.y };
  scene.spawnFloorContent(floor, map, spawn);
  const scrolls = scene.context.entities.filter(item => item.kind === 'ScrollOfUpgrade');
  assert.equal(scrolls.length, expected, `floor ${floor} keeps its SoU quota without shuffled tiles`);
  if (generated.chasmRoom) {
    assert.equal(scene.context.entities.filter(item => item.kind === 'PotionOfLevitation').length, 1,
      'the chasm room potion is placed even when no shuffled tiles are available');
  }
  const occupied = new Set(scene.context.entities.map(item => `${item.x},${item.y}`));
  assert.equal(occupied.size, scene.context.entities.length, 'fallback spawns never overlap');
}
walkableTiles = mapgen.randomWalkableTiles;

// Boss floors cannot be descended until the Writhing Maw dies, and its
// death on the final floor wins the run immediately.
{
  const scene = Object.create(Scene0.prototype);
  scene.context = { ...createGameContext(), floor: 5, entities: [], stairsX: 1, stairsY: 1 };
  scene.floors = new Map([[6, { up: { x: 0, y: 0 } }]]);
  scene.seen = [];
  let restored = false;
  scene.saveFloor = () => {};
  scene.restoreFloor = () => { restored = true; };
  scene.descend();
  assert.equal(restored, false, 'a live Writhing Maw seals the way down');
  scene.context.bossesSlain.add(5);
  scene.descend();
  assert.equal(restored, true, 'slaying the Writhing Maw permits descent');
}
{
  const emitted = [];
  const scene = Object.create(Scene0.prototype);
  scene.context = { ...createGameContext(), floor: 10, entities: [], stairsX: 1, stairsY: 1 };
  scene.events = { emit: name => emitted.push(name) };
  scene.renderStairs = () => {};
  scene.handleMonsterRemoved(new bindings.Boss(scene.context, 2, 2), false);
  assert.equal(scene.context.bossesSlain.has(10), true, 'a slain boss marks its floor cleared');
  assert.deepEqual(emitted, [], 'an intermediate boss does not end the run');
  scene.context.floor = 25;
  scene.handleMonsterRemoved(new bindings.Boss(scene.context, 2, 2), false);
  assert.equal(scene.context.bossesSlain.has(25), true);
  assert.deepEqual(emitted, ['player-won'], 'the final boss death wins immediately');
}
{
  const scene = Object.create(Scene0.prototype);
  scene.context = { ...createGameContext(), floor: 10, entities: [], stairsX: 1, stairsY: 1 };
  scene.renderStairs = () => {};
  scene.handleMonsterRemoved({ type: 'enemy', healthPoints: 0 }, false);
  assert.equal(scene.context.bossesSlain.has(10), true,
    'clearing the last factory hostile satisfies its win condition');
}
console.log('Rogue0 progression: deterministic 15 SoU / 3 per region / no boss-floor SoU, 25 floors, final boss, five equipment tiers, supply quotas and revisits passed');
