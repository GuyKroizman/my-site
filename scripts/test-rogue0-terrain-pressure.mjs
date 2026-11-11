import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('terrain-pressure');
import assert from 'node:assert/strict';
import PF from 'pathfinding';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';
import { createHeroNavigation } from '../src/games/rogue0/heroNavigation.ts';
import { createHeroInput } from '../src/games/rogue0/heroInput.ts';
import { actionCost, starvationDamageDuring } from '../src/games/rogue0/timing.ts';
const load = (name, bindings) => loadLogic(`src/games/rogue0/${name}.ts`, bindings);
const tiles = load('tiles');
const fov = load('fov', tiles);
import { bossArenaLayout } from '../src/games/rogue0/bossArenas.ts';
const { generateMap, findFarthestWalkable, floorHasSecretRoom, floorIsBossArena, floorTerrainTheme } = load('mapgen', tiles);
const {
  floorHasChasmRoom, chasmRoomChance, floorRollsLevitationLoot, floorWantsChasmRoom,
  pickChasmRoomFloor, isChasmRoomFloor, CHASM_ROOM_FLOORS, DEEP_CHASM_ROOM_CHANCE
} = load('mapgen', tiles);
// Every floor theme must be reachable: the generator rolls one per floor.
const themeRolls = new Set();
for (let i = 0; i < 400; i++) themeRolls.add(floorTerrainTheme(2));
assert.deepEqual([...themeRolls].sort(), ['flooded', 'neutral', 'overgrown'], 'floors roll between plain, overgrown and flooded biomes');
assert.equal(floorTerrainTheme(1), 'neutral', 'the introduction floor stays plain stone');
// Chasm room pacing: a run gives its chasm room to exactly one of the early
// floors (1, 2, 3, 4, 6, 7 - never the floor-5 boss arena), and only deeper
// floors may roll another, rarely. Shallower floors never carry one.
assert.deepEqual([...CHASM_ROOM_FLOORS], [1, 2, 3, 4, 6, 7],
  'the chasm room is offered to the early non-boss floors');
const pickedFloors = new Set();
for (let i = 0; i < 4000; i++) pickedFloors.add(pickChasmRoomFloor());
assert.deepEqual([...pickedFloors].sort((a, b) => a - b), [1, 2, 3, 4, 6, 7],
  'a fresh run settles its chasm room on one of those floors at random');
for (const floor of [1, 2, 3, 4, 6, 7]) assert.equal(isChasmRoomFloor(floor), true);
for (const floor of [undefined, 0, 5, 8, 10, 25, 1.5, '3', null]) {
  assert.equal(isChasmRoomFloor(floor), false, `floor ${String(floor)} can never own the run's chasm room`);
}
for (const chasmFloor of CHASM_ROOM_FLOORS) {
  assert.equal(chasmRoomChance(chasmFloor, chasmFloor), 1, `the run's chasm floor (${chasmFloor}) is guaranteed`);
  assert.equal(floorHasChasmRoom(chasmFloor, chasmFloor), true);
  for (const floor of [1, 2, 3, 4, 6, 7]) {
    if (floor === chasmFloor) continue;
    if (floor < chasmFloor) {
      assert.equal(chasmRoomChance(floor, chasmFloor), 0, `floor ${floor} is shallower than the chasm floor ${chasmFloor}`);
      assert.equal(floorHasChasmRoom(floor, chasmFloor), false);
    } else {
      assert.equal(chasmRoomChance(floor, chasmFloor), DEEP_CHASM_ROOM_CHANCE,
        `floor ${floor} is deeper than the chasm floor ${chasmFloor}, so it only rolls one`);
      assert.equal(floorHasChasmRoom(floor, chasmFloor), false);
    }
  }
  // Every shallower floor stays empty, every deeper floor rolls 5%.
  for (let floor = 1; floor <= 25; floor++) {
    if (floorIsBossArena(floor)) {
      assert.equal(floorHasChasmRoom(floor, chasmFloor), false, `boss floor ${floor} has no chasm room`);
      assert.equal(chasmRoomChance(floor, chasmFloor), 0, `boss floor ${floor} never rolls a chasm room`);
    } else if (floor > chasmFloor) {
      assert.equal(chasmRoomChance(floor, chasmFloor), DEEP_CHASM_ROOM_CHANCE,
        `floor ${floor} sits below the chasm floor ${chasmFloor} and rolls 5%`);
    }
  }
}
let roomRolls = 0;
const roomTrials = 4000;
for (let i = 0; i < roomTrials; i++) if (floorWantsChasmRoom(8, 3)) roomRolls++;
const roomRate = roomRolls / roomTrials;
assert.ok(roomRate > 0.03 && roomRate < 0.08,
  `floors below the chasm floor roll the room about 5% of the time (got ${(roomRate * 100).toFixed(1)}%)`);
// Levitation is room-bound while the dungeon teaches it, then ordinary loot.
for (const floor of [1, 2, 3, 4, 5, 6, 7]) {
  assert.equal(floorRollsLevitationLoot(floor), false, `floor ${floor} only gets levitation from its chasm room`);
}
for (const floor of [8, 9, 10, 25]) {
  assert.equal(floorRollsLevitationLoot(floor), true, `floor ${floor} can roll levitation as loot`);
}
// Contiguous same-terrain mass, used to prove patches are landscapes and not
// single decorative tiles.
function largestTerrainBlob(features, feature) {
  const cells = new Set(features.filter(f => f.feature === feature).map(f => `${f.x},${f.y}`));
  let largest = 0;
  while (cells.size) {
    const first = cells.values().next().value;
    cells.delete(first);
    const queue = [first];
    for (let qi = 0; qi < queue.length; qi++) {
      const [x, y] = queue[qi].split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const key = `${x + dx},${y + dy}`;
        if (cells.delete(key)) queue.push(key);
      }
    }
    largest = Math.max(largest, queue.length);
  }
  return largest;
}
let biggestGrass = 0, biggestWater = 0, grassTiles = 0, waterTiles = 0;
// The shared hit presentation (impact sound, flash, sparks) now also runs for
// landed trap arrows, so every fixture provides the same audio surface.
const sfxStub = { step() {}, hit() {}, hurt() {}, deflect() {}, surpriseHit() {}, death() {} };
const dungeon = load('dungeon', { PF, tiles, ...fov,
  hasEffect: () => false, sfx: sfxStub,
  removeEntity: (ctx, e) => { ctx.entities = ctx.entities.filter(v => v !== e); }
}).default;
let changes = 0;
dungeon.onTerrainChanged = () => changes++;
function floodReachable(map, start, blocked) {
  const visited = new Set([`${start.x},${start.y}`]);
  const queue = [{ x: start.x, y: start.y }];
  for (let qi = 0; qi < queue.length; qi++) {
    const { x, y } = queue[qi];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map[0].length || ny >= map.length) continue;
      if (map[ny][nx] !== 0) continue;
      const key = `${nx},${ny}`;
      if (blocked.has(key) || visited.has(key)) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return visited;
}
// A door is valid only in a straight 1-wide passage: two opposite floor
// neighbours and no floor on either side. This rejects L-bends, T-junctions
// and 2-wide corridors where a single door would leave an open lane beside it.
function isStraightDoorway(map, d) {
  const left = map[d.y]?.[d.x - 1] === 0;
  const right = map[d.y]?.[d.x + 1] === 0;
  const up = map[d.y - 1]?.[d.x] === 0;
  const down = map[d.y + 1]?.[d.x] === 0;
  return (left && right && !up && !down) || (up && down && !left && !right);
}
for (let i = 0; i < 200; i++) {
  tiles.clearAllFeatures();
  const floor = i % 25 + 1;
  const chasmRoomFloor = CHASM_ROOM_FLOORS[i % CHASM_ROOM_FLOORS.length];
  const hasSecret = floorHasSecretRoom(floor);
  const generated = generateMap(floor, chasmRoomFloor);
  const { map, rooms, features, secretRoom } = generated;
  if (hasSecret) {
    assert.ok(secretRoom, 'band floors generate a secret corridor leading to a treasure room');
    assert.equal(secretRoom.w, 3); assert.equal(secretRoom.h, 3);
    for (let ry = secretRoom.y; ry < secretRoom.y + 3; ry++) {
      for (let rx = secretRoom.x; rx < secretRoom.x + 3; rx++) {
        assert.equal(map[ry][rx], 0, 'treasure room is fully carved');
        assert.ok(!features.some(f => f.x === rx && f.y === ry), 'treasure room has no traps or obstructing terrain');
      }
    }
  } else {
    assert.equal(secretRoom, undefined, 'no secret treasure room outside band floors');
    assert.ok(!features.some(f => f.feature === 'secretDoor'), 'no secret door outside band floors');
  }
  assert.ok(map[0].every(cell => cell === 1), 'northern boundary stays sealed');
  if (floorIsBossArena(floor)) {
    // A boss floor is a single arena hall, and every boss floor builds its own.
    assert.equal(rooms.length, 1, `floor ${floor} is a single arena room`);
    const arena = rooms[0];
    const layout = bossArenaLayout(floor);
    assert.deepEqual({ w: arena.w, h: arena.h }, { w: layout.width, h: layout.height },
      `floor ${floor} carves the ${layout.id} hall (${arena.w}x${arena.h})`);
  } else {
    assert.ok(rooms.length > 1);
  }
  // Doors must sit in a straight 1-wide corridor. Junctions, L-bends and
  // 2-wide corridors are left as open archways instead of getting a door
  // that only covers one of several walkable lanes.
  const doorFeatures = features.filter(f => f.feature === 'door');  for (const d of doorFeatures) {
    assert.ok(isStraightDoorway(map, d),
      'doors sit in straight 1-wide corridors, not junctions or 2-wide corridors');
  }
  for (const f of features) tiles.setFeature(f.x, f.y, f.feature, f);
  biggestGrass = Math.max(biggestGrass, largestTerrainBlob(features, 'grass'));
  biggestWater = Math.max(biggestWater, largestTerrainBlob(features, 'water'));
  grassTiles += features.filter(f => f.feature === 'grass').length;
  waterTiles += features.filter(f => f.feature === 'water').length;
  const chasms = features.filter(f => f.feature === 'chasm');
  if (chasms.length > 0) assert.ok(chasms.length >= 2, 'chasms are multi-tile patches, never a lone tile');
  const spawn = generated.spawn ?? { x: rooms[0].cx, y: rooms[0].cy };
  const blocked = new Set(chasms.map(c => `${c.x},${c.y}`));
  // A chasm room's treasure island is the one floor area that is deliberately
  // unreachable on foot: levitation is the only way in.
  const chasmRoom = generated.chasmRoom;
  const islandKeys = new Set((chasmRoom?.island ?? []).map(t => `${t.x},${t.y}`));
  const reachable = floodReachable(map, spawn, blocked);
  for (const key of floodReachable(map, spawn, new Set())) {
    if (blocked.has(key) || islandKeys.has(key)) continue;
    assert.ok(reachable.has(key), `chasm cannot isolate ${key}`);
  }
  if (floorHasChasmRoom(floor, chasmRoomFloor)) {
    assert.ok(chasmRoom, `floor ${floor} carries the run's chasm room (chasm floor ${chasmRoomFloor})`);
    assert.equal(chasmRoomChance(floor, chasmRoomFloor), 1);
    const rect = chasmRoom.room;
    assert.ok(rect.w >= 11 && rect.h >= 11, 'the room is big enough for a moat and an island');
    assert.ok(islandKeys.has(`${chasmRoom.reward.x},${chasmRoom.reward.y}`),
      'the treasure chest anchor sits on the chasm room island');
    for (const tile of chasmRoom.island) {
      assert.ok(islandKeys.has(`${tile.x},${tile.y}`));
      assert.equal(tiles.getFeature(tile.x, tile.y), undefined, 'the island holds no chasm or other feature');
      assert.ok(!reachable.has(`${tile.x},${tile.y}`), 'the island has no land route from the spawn');
      // Every island edge is moat or wall: the chasm cannot be walked around.
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const key = `${tile.x + dx},${tile.y + dy}`;
        const solid = map[tile.y + dy][tile.x + dx] === 1;
        assert.ok(solid || blocked.has(key) || islandKeys.has(key),
          `island tile ${tile.x},${tile.y} is only reached through the moat`);
      }
    }
    for (const tile of chasmRoom.chasm) {
      assert.equal(tiles.getFeature(tile.x, tile.y), 'chasm', 'the moat is chasm terrain');
    }
    const approach = `${chasmRoom.approach.x},${chasmRoom.approach.y}`;
    assert.ok(reachable.has(approach), 'the guaranteed potion is on the reachable band');
    assert.ok(!blocked.has(approach) && !islandKeys.has(approach), 'the potion never lies on the moat or the island');
    assert.equal(tiles.getFeature(chasmRoom.approach.x, chasmRoom.approach.y), undefined,
      'the potion tile carries no door, trap or terrain feature');
  } else if (!floorIsBossArena(floor) && floor > chasmRoomFloor) {
    // Floors below the run's chasm floor roll the room rarely; when they do,
    // the same structure holds.
    if (chasmRoom) {
      assert.ok(islandKeys.has(`${chasmRoom.reward.x},${chasmRoom.reward.y}`));
      assert.ok(reachable.has(`${chasmRoom.approach.x},${chasmRoom.approach.y}`));
    }
  } else {
    assert.equal(chasmRoom, undefined,
      `floor ${floor} lies above the run's chasm floor ${chasmRoomFloor} and has no chasm room`);
  }
  const stairs = findFarthestWalkable(map, spawn.x, spawn.y, map[0].length, (sx, sy) => tiles.getFeature(sx, sy) === 'chasm');
  assert.notEqual(tiles.getFeature(stairs.x, stairs.y), 'chasm', 'stairs never land on a chasm');
  assert.ok(!islandKeys.has(`${stairs.x},${stairs.y}`), 'stairs never land on the chasm room island');
  assert.ok(features.some(f => f.trapKind === 'arrow' && f.trap === 'visible'));
  for (const f of features.filter(f => f.feature === 'trap')) {
    assert.equal(!!f.trapReusable, ['frost', 'teleport', 'alarm'].includes(f.trapKind));
    // A boss floor is a guardian-only arena: its traps never summon a monster.
    if (floorHasSecretRoom(floor)) {
      assert.notEqual(f.trapKind, 'summon', `floor ${floor} has no summon trap`);
    }
  }
  if (hasSecret) {
    const secret = features.find(f => f.feature === 'secretDoor');
    assert.ok(secret, 'band floors have a secret branch');
    const { x, y } = secret;
    assert.equal(map[y][x], 1);
    assert.equal(map[y + 1][x], 0);
    assert.equal(map[y - 1][x], 0);
    assert.equal(map[y - 2][x], 0);
    assert.equal(map[y + 1][x - 1], 1);
    assert.equal(map[y + 1][x + 1], 1);
    assert.equal(tiles.describeTile(tiles.getTileState(x, y), true), 'A wall.');
    dungeon.currentLevel = map;
    dungeon.pathGrid = new PF.Grid(map);
    tiles.applyToPathGrid(dungeon.pathGrid);
    dungeon.diagonalFinder = new PF.AStarFinder({ diagonalMovement: PF.DiagonalMovement.OnlyWhenNoObstacles });
    dungeon.context = { messages: [] };
    let redraw;
    dungeon.layer = { putTileAt: (...args) => { redraw = args; } };
    assert.equal(dungeon.findPath(x, y + 1, x, y - 1, true).length, 0);
    assert.deepEqual(dungeon.findPath(x, y + 1, secretRoom.cx, secretRoom.cy, true), [], 'no alternate entrance bypasses the secret');
    assert.equal(dungeon.inspectTile(x, y), 'A wall.', 'inspect does not leak secret doors');
    assert.equal(tiles.isBlocking(x, y), true);
    assert.equal(fov.blocksSight(map, x, y), true);
    // Other generated traps may be nearby; only the secret must stay hidden.
    dungeon.searchAround(x, y + 2);
    assert.equal(tiles.getFeature(x, y), 'secretDoor', 'search cannot reveal a distant secret');
    const changesBeforeSearch = changes;
    tiles.setFeature(x + 1, y + 1, 'trap', { trap: 'hidden' });
    assert.equal(dungeon.searchAround(x, y + 1), 2, 'search preserves trap discovery');
    assert.equal(tiles.getTrapState(x + 1, y + 1), 'visible');
    assert.equal(map[y][x], 0);
    assert.equal(tiles.getDoorState(x, y), 'closed', 'discovery does not open the door');
    assert.equal(dungeon.pathGrid.isWalkableAt(x, y), false);
    assert.equal(changes, changesBeforeSearch + 1, 'discovery refreshes terrain once');
    assert.deepEqual(redraw, [0, x, y]);
    assert.equal(fov.blocksSight(map, x, y), true);
    assert.equal(dungeon.findPath(x, y + 1, x, y - 1, true).length, 3);
    assert.equal(dungeon.searchAround(x, y + 1), 0);
    dungeon.openDoor(x, y);
    assert.equal(fov.blocksSight(map, x, y), false);
    assert.equal(dungeon.pathGrid.isWalkableAt(x, y), true);
    assert.ok(dungeon.findPath(x, y + 1, secretRoom.cx, secretRoom.cy).length > 0, 'searching and opening the door reaches the treasure room');
    const saved = [];
    tiles.forEachFeature((x, y, state) => saved.push({ ...state, x, y }));
    tiles.clearAllFeatures();
    saved.forEach(f => tiles.setFeature(f.x, f.y, f.feature, f));
    assert.equal(tiles.getDoorState(x, y), 'open', 'revisit keeps discovered/open door');
  }
}
// Across 200 maps every biome shows up, and at least one floor of each type is
// genuinely covered rather than speckled with a few lone tiles.
assert.ok(biggestGrass >= 20, `overgrown floors grow big connected grass (largest ${biggestGrass})`);
assert.ok(biggestWater >= 20, `flooded floors grow big connected water (largest ${biggestWater})`);
assert.ok(grassTiles / 200 >= 4, `grass is a regular floor feature (avg ${(grassTiles / 200).toFixed(1)} tiles)`);
assert.ok(waterTiles / 200 >= 4, `water is a regular floor feature (avg ${(waterTiles / 200).toFixed(1)} tiles)`);
// One run, one chasm room: whatever floor the run settled on, the room is
// generated there and never on a shallower floor.
for (const chasmRoomFloor of CHASM_ROOM_FLOORS) {
  for (let floor = 1; floor <= 7; floor++) {
    if (floorIsBossArena(floor)) continue;
    tiles.clearAllFeatures();
    const generated = generateMap(floor, chasmRoomFloor);
    if (floor === chasmRoomFloor) {
      assert.ok(generated.chasmRoom,
        `a run with chasm floor ${chasmRoomFloor} always builds the room there`);
      assert.equal(generated.chasmRoom.room.w * generated.chasmRoom.room.h > 0, true);
    } else if (floor < chasmRoomFloor) {
      assert.equal(generated.chasmRoom, undefined,
        `floor ${floor} stays free of chasm rooms when the run's chasm floor is ${chasmRoomFloor}`);
    }
  }
}
tiles.clearAllFeatures();
function actor(type, x, y, hp = 10) {
  return { type, x, y, healthPoints: hp, name: type, protection: () => 0,
    takeDamage(n) { this.healthPoints -= n; } };
}
function setup(actors) {
  tiles.clearAllFeatures();
  tiles.setFeature(3, 3, 'trap', { trapKind: 'arrow', trap: 'visible' });
  dungeon.currentLevel = Array.from({ length: 9 }, () => Array(9).fill(0));
  return { entities: actors, messages: [], visibleTiles: new Set() };
}
let player = actor('player', 1, 3), enemy = actor('enemy', 4, 3);
let ctx = setup([player, enemy, actor('item', 3, 3), actor('enemy', 3, 3, 0)]);
assert.equal(dungeon.triggerArrowTrap(ctx, 3, 3), true);
assert.equal(enemy.healthPoints, 5);
assert.equal(player.healthPoints, 10);
assert.equal(dungeon.triggerArrowTrap(ctx, 3, 3), false);
player = actor('player', 3, 4); enemy = actor('enemy', 7, 3);
ctx = setup([enemy, player]);
dungeon.triggerArrowTrap(ctx, 3, 3);
assert.equal(player.healthPoints, 5, 'nearest player can be hit');
ctx = setup([actor('enemy', 5, 3)]);
dungeon.currentLevel[3][4] = 1;
dungeon.triggerArrowTrap(ctx, 3, 3);
assert.equal(ctx.entities[0].healthPoints, 10, 'arrow cannot pass a wall');
ctx = setup([actor('enemy', 3, 3, 4)]);
dungeon.triggerArrowTrap(ctx, 3, 3);
assert.equal(ctx.entities.length, 0, 'lethal trap removes victim');
// Real throw landing and step entry integration, without renderer dependencies.
const { Entity } = load('entity', { actionCost: load('timing').actionCost });
const Hero = load('classes/basicHero', {
  Entity, dungeon, ...fov, Wand: class {}, hasEffect: () => false,
  tiles, getFeature: tiles.getFeature,
  removeEntity: (ctx, e) => { ctx.entities = ctx.entities.filter(v => v !== e); }
}).default;
ctx = setup([actor('enemy', 4, 3)]);
const hero = Object.create(Hero.prototype);
hero.context = ctx;
hero.placeItemOnGround = () => {};
hero.resolveThrowLanding({ type: 'item' }, 3, 3);
assert.equal(ctx.entities[0].healthPoints, 5);
const walker = actor('enemy', 2, 3);
ctx = setup([walker]);
ctx.map = { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 };
ctx.scene = sceneStub();
dungeon.moveEntityTo(ctx, walker, 3, 3);
assert.equal(walker.healthPoints, 5, 'monster stepping triggers plate at new position');
// Tall grass is trampled by walking onto it; flying actors pass over it.
tiles.setFeature(4, 3, 'grass');
const changesBeforeTrample = changes;
dungeon.moveEntityTo(ctx, walker, 4, 3);
assert.equal(tiles.getFeature(4, 3), undefined, 'walking tramples tall grass into bare floor');
assert.equal(changes, changesBeforeTrample + 1, 'trampling refreshes terrain once');
tiles.setFeature(5, 3, 'grass');
const flyer = actor('enemy', 5, 4);
flyer.isFlying = true;
ctx = setup([flyer]);
tiles.setFeature(5, 3, 'grass');
ctx.map = { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 };
ctx.scene = sceneStub();
dungeon.moveEntityTo(ctx, flyer, 5, 3);
assert.equal(tiles.getFeature(5, 3), 'grass', 'flying actors do not trample grass');
tiles.clearAllFeatures();
// Search reveals traps but never disables them, even on repeated use.
for (const trapKind of ['dart', 'fire', 'frost', 'teleport', 'arrow', 'summon', 'alarm']) {
  const searcher = Object.create(Hero.prototype);
  Object.assign(searcher, { x: 2, y: 3, context: setup([]), walkPath: [1] });
  tiles.setFeature(3, 3, 'trap', { trapKind, trap: 'visible' });
  tiles.setFeature(2, 4, 'trap', { trapKind, trap: 'hidden' });
  searcher.canAct = () => true;
  const costs = [];
  searcher.spendTurn = action => costs.push(action);
  searcher.search();
  searcher.search();
  assert.deepEqual(costs, ['search', 'search']);
  assert.equal(searcher.walkPath.length, 0);
  assert.equal(tiles.getTrapState(3, 3), 'visible', 'known trap remains armed');
  assert.equal(tiles.getTrapState(2, 4), 'visible', 'revealed trap remains armed');
  searcher.canAct = () => false;
  searcher.search();
  assert.equal(costs.length, 2, 'search respects action readiness');
}
// Physical arrows cannot cut corners, but can fly over a chasm.
ctx = setup([actor('enemy', 4, 4)]);
dungeon.currentLevel[3][4] = 1;
dungeon.triggerArrowTrap(ctx, 3, 3);
assert.equal(ctx.entities[0].healthPoints, 10);
ctx = setup([actor('enemy', 5, 3)]);
tiles.setFeature(4, 3, 'chasm');
dungeon.triggerArrowTrap(ctx, 3, 3);
assert.equal(ctx.entities[0].healthPoints, 5);
ctx = setup([actor('enemy', 5, 3)]);
tiles.setFeature(4, 3, 'door');
dungeon.triggerArrowTrap(ctx, 3, 3);
assert.equal(ctx.entities[0].healthPoints, 10);

// A visible arrow lands its damage only when the arrow arrives. Resolving it on
// the firing frame let the victim take the hit and then move away while the
// projectile was still in the air, which reads as a miss.
{
  const flights = [];
  ctx = setup([actor('enemy', 4, 3)]);
  renderContext(ctx);
  ctx.scene.tweens = { add(opts) { flights.push(opts); }, killTweensOf() {} };
  ctx.visibleTiles.add('3,3');
  ctx.visibleTiles.add('4,3');
  dungeon.triggerArrowTrap(ctx, 3, 3);
  assert.equal(flights.length, 1, 'a visible arrow flies at the victim');
  assert.equal(flights[0].x, 4 * 16 + 8, 'the arrow flies to the victim tile');
  assert.equal(ctx.entities[0].healthPoints, 10, 'the hit waits for the arrow');
  assert.equal(ctx.pendingTrapArrows, 1);
  assert.equal(ctx.messages[0], 'The arrow trap fires!');
  assert.equal(ctx.messages.length, 1, 'the hit is not logged on the firing frame');
  // Nobody may take a turn through a flying arrow.
  const { TurnManager } = load('turnManager');
  const turns = [];
  const manager = new TurnManager({ hasEffect: () => false, removeEffect() {}, log() {} });
  const skeleton = ctx.entities[0];
  skeleton.context = ctx;
  skeleton.effects = [];
  skeleton.turn = () => turns.push('skeleton');
  const hero = actor('player', 1, 3);
  hero.context = ctx;
  hero.effects = [];
  hero.turn = () => turns.push('hero');
  ctx.entities.push(hero);
  manager.reset(ctx.entities);
  manager.update(ctx.entities);
  assert.deepEqual(turns, [], 'no turn resolves while the arrow is in flight');
  flights.shift().onComplete();
  assert.equal(skeleton.healthPoints, 5, 'the arrow hits when it arrives');
  assert.equal(ctx.pendingTrapArrows, 0);
  assert.equal(ctx.messages[0], 'The arrow hits enemy for 5 damage.');
  manager.update(ctx.entities);
  assert.deepEqual(turns, ['hero'], 'the next turn resolves once the arrow lands');
}
// An unseen hit has no projectile to watch, so it resolves immediately.
ctx = setup([actor('enemy', 4, 3)]);
renderContext(ctx);
dungeon.triggerArrowTrap(ctx, 3, 3);
assert.equal(ctx.entities[0].healthPoints, 5, 'an unseen hit resolves at once');
assert.equal(ctx.pendingTrapArrows, undefined, 'nothing waits on an unseen arrow');

function sprite() {
  return { tint: 0xffffff, setTint(tint) { this.tint = tint; return this; },
    setOrigin() { return this; }, setDepth() { return this; },
    setScale(scale) { this.scale = scale; return this; },
    setRotation() { return this; }, setPosition() { return this; }, destroy() {} };
}
// A landed hit flashes its sprite, throws sparks and plays a sound, so a fake
// scene carries the pieces the shared presentation touches.
function fakeParticles() { return { explode() {}, destroy() {} }; }
function sceneStub(tweens) {
  return { add: { sprite, particles: () => fakeParticles() },
    tweens: tweens ?? { add(opts) { opts.onComplete?.(); }, killTweensOf() {} },
    time: { delayedCall() {} } };
}
function renderContext(ctx) {
  ctx.map = { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 };
  ctx.scene = sceneStub();
  return ctx;
}
function throwingHero(count = 3, Item) {
  const ctx = renderContext(setup([]));
  const item = Object.assign(Item ? new Item(ctx) : new Entity(), {
    type: 'item', count, identified: false, level: 2
  });
  ctx.entities.push(item);
  const hero = Object.assign(Object.create(Hero.prototype), {
    context: ctx, backpack: [item], effects: [], x: 1, y: 3,
    moving: false, actionReady: true, spendTurn() {}
  });
  ctx.throwItem = item;
  ctx.throwMode = true;
  return { hero, ctx, item };
}
let thrownSetup = throwingHero();
thrownSetup.hero.throwAt(3, 3);
let floorItem = thrownSetup.ctx.entities.find(e => e.x === 3 && e.y === 3);
assert.notEqual(floorItem, thrownSetup.item, 'stack throw creates independent floor entity');
assert.equal(floorItem.count, 1);
assert.equal(floorItem.level, 2);
assert.equal(floorItem.identified, false);
assert.equal(thrownSetup.item.count, 2);
assert.equal(thrownSetup.item.x, undefined);
assert.equal(thrownSetup.hero.backpack[0], thrownSetup.item);
assert.equal(tiles.getTrapState(3, 3), 'triggered');
thrownSetup = throwingHero();
thrownSetup.hero.backpack = [];
thrownSetup.hero.throwAt(3, 3);
assert.equal(tiles.getTrapState(3, 3), 'visible', 'stale throw selection cannot fire trap');
assert.equal(thrownSetup.item.count, 3);
thrownSetup = throwingHero();
thrownSetup.ctx.scene = undefined;
thrownSetup.hero.throwAt(3, 3);
assert.equal(thrownSetup.item.count, 3, 'missing renderer cannot mutate/duplicate stack');
thrownSetup = throwingHero();
const stackedEnemy = actor('enemy', 3, 3);
thrownSetup.ctx.entities.push({ type: 'item', x: 3, y: 3, sprite: sprite() }, stackedEnemy);
let struck;
thrownSetup.hero.applyThrownItemToEnemy = (_item, target) => { struck = target; };
thrownSetup.hero.throwAt(3, 3);
assert.equal(struck, stackedEnemy, 'loot does not hide the enemy from impact');
assert.equal(thrownSetup.item.count, 2);
assert.ok(thrownSetup.ctx.entities.includes(thrownSetup.item), 'hit cannot remove inventory stack');

// Actual potion and cursed-gem classes: throw one from a stack onto the plate or
// into an enemy. The remaining inventory entity survives both paths.
const Potion = load('items/PotionOfHealing', { Entity }).default;
const CursedGem = load('items/cursedGem', { Entity }).default;
// Pickup may merge only equivalent stack state, never silently erase it.
for (const difference of [
  { identified: true }, { level: 3 }, { cursed: true }, { blessed: true },
  { charges: 4 }, { tier: 2 }, { effects: [{ id: 'test', duration: 2 }] }
]) {
  const { hero, ctx, item } = throwingHero(3, Potion);
  hero.capacity = 1;
  const incoming = Object.assign(new Potion(ctx), {
    x: 2, y: 3, level: item.level, identified: item.identified, ...difference
  });
  ctx.entities.push(incoming);
  assert.equal(hero.addItem(incoming), false, 'different state cannot bypass a full backpack');
  assert.equal(item.count, 3);
  assert.equal(incoming.x, 2);
  assert.ok(ctx.entities.includes(incoming));
  hero.capacity = 2;
  assert.equal(hero.addItem(incoming), true);
  assert.deepEqual(hero.backpack, [item, incoming]);
  assert.equal(incoming.x, undefined);
  for (const [key, value] of Object.entries(difference)) assert.deepEqual(incoming[key], value);
}
{
  const { hero, ctx, item } = throwingHero(3, Potion);
  hero.capacity = 1;
  const incoming = Object.assign(new Potion(ctx), {
    x: 2, y: 3, level: item.level, identified: item.identified, count: 2
  });
  ctx.entities.push(incoming);
  assert.equal(hero.addItem(incoming), true, 'equivalent items still stack in a full backpack');
  assert.equal(item.count, 5);
  assert.deepEqual(hero.backpack, [item]);
  assert.ok(!ctx.entities.includes(incoming));
}
for (const Item of [Potion, CursedGem]) {
  // Dropping a stack must preserve the same state as throwing one unit.
  {
    const { hero, ctx, item } = throwingHero(3, Item);
    item.cursed = true; // Backpack curses do not prevent dropping.
    item.charges = 4;
    item.effects = [{ id: 'test', duration: 2 }];
    const icon = {};
    item.UISprite = icon;
    let turns = 0;
    hero.spendTurn = action => { assert.equal(action, 'drop'); turns++; };
    hero.dropItem(item);
    const dropped = ctx.entities.find(e => e.x === hero.x && e.y === hero.y);
    assert.ok(dropped instanceof Item);
    assert.notEqual(dropped, item);
    assert.equal(dropped.count, 1);
    assert.equal(dropped.level, 2);
    assert.equal(dropped.identified, false);
    assert.equal(dropped.cursed, true);
    assert.equal(dropped.charges, 4);
    assert.deepEqual(dropped.effects, item.effects);
    assert.notEqual(dropped.effects[0], item.effects[0]);
    assert.equal(dropped.UISprite, undefined);
    assert.equal(item.UISprite, icon);
    assert.ok(dropped.sprite);
    assert.equal(item.x, undefined);
    assert.equal(item.count, 2);
    assert.equal(hero.backpack[0], item);
    assert.equal(turns, 1);
  }
  for (const hitEnemy of [false, true]) {
    const { hero, ctx, item } = throwingHero(3, Item);
    if (hitEnemy) ctx.entities.push(actor('enemy', 3, 3));
    hero.throwAt(3, 3);
    assert.equal(item.count, 2, `${Item.name}: exactly one is thrown`);
    assert.equal(hero.backpack[0], item);
    assert.ok(ctx.entities.includes(item));
    assert.equal(item.x, undefined);
    if (!hitEnemy) {
      const landed = ctx.entities.find(e => e.x === 3 && e.y === 3);
      if (Item === Potion) {
        assert.equal(landed, undefined, 'a thrown potion shatters instead of resting');
        assert.equal(ctx.entities.filter(e => e.type === 'item').length, 1,
          'the shattered flask leaves only the original backpack stack');
      } else {
        assert.ok(landed instanceof Item, 'split retains cursed-gem behavior');
        assert.notEqual(landed, item);
        assert.equal(landed.count, 1);
        assert.equal(landed.level, item.level);
        assert.equal(landed.identified, item.identified);
      }
    } else {
      assert.equal(ctx.entities.filter(e => e.type === 'item').length, 1,
        'consumed projectile leaves only the original backpack stack');
    }
    assert.equal(tiles.getTrapState(3, 3), 'triggered');
  }
  const { hero, ctx, item } = throwingHero(1, Item);
  hero.throwAt(3, 3);
  assert.equal(hero.backpack.length, 0, 'last unit leaves inventory');
  if (Item === Potion) {
    assert.equal(ctx.entities.includes(item), false, 'the last potion shatters');
    assert.equal(ctx.entities.filter(e => e.type === 'item').length, 0);
  } else {
    assert.equal(ctx.entities.find(e => e.x === 3 && e.y === 3), item);
    assert.equal(item.count, 1);
  }
}

// A thrown item landing on a chasm falls in and is lost, never resting on the
// rim or triggering an arrow trap beneath.
for (const Item of [undefined, Potion, CursedGem]) {
  const label = Item?.name ?? 'plain item';
  const { hero, ctx, item } = throwingHero(3, Item);
  tiles.clearFeature(3, 3);
  tiles.setFeature(3, 3, 'chasm');
  hero.throwAt(3, 3);
  assert.equal(item.count, 2, `${label}: exactly one is thrown into the chasm`);
  assert.equal(hero.backpack[0], item);
  assert.equal(ctx.entities.filter(e => e.type === 'item').length, 1,
    `${label}: the chasm consumes the projectile, keeping only the stack`);
  assert.equal(ctx.entities.some(e => e.x === 3 && e.y === 3), false,
    `${label}: no floor item remains over the chasm`);
  assert.match(ctx.messages[0], /falls into the chasm/);
  assert.equal(tiles.getFeature(3, 3), 'chasm');
}

// Exercise actual shared death cleanup: onDestroy sees landing coordinates,
// coordinates/sprites are then cleared, and no movement tween revives it.
const realRemove = load('entity', { sfx: sfxStub }).removeEntity;
const deathDungeon = load('dungeon', { PF, tiles, ...fov, hasEffect: () => false,
  sfx: sfxStub, removeEntity: realRemove }).default;
for (const type of ['player', 'enemy']) {
  for (const visible of [false, true]) {
    const victim = actor(type, 2, 3, 4);
    victim.sprite = sprite();
    let deathPosition;
    victim.onDestroy = () => { deathPosition = [victim.x, victim.y]; };
    const ctx = renderContext(setup([victim]));
    if (visible) ctx.visibleTiles.add('3,3');
    deathDungeon.currentLevel = dungeon.currentLevel;
    deathDungeon.moveEntityTo(ctx, victim, 3, 3);
    assert.deepEqual(deathPosition, [3, 3]);
    assert.equal(ctx.entities.includes(victim), false);
    assert.equal(victim.sprite, undefined);
    assert.equal(victim.x, undefined);
    assert.ok(!victim.moving);
    assert.equal(tiles.getTrapState(3, 3), 'triggered');
  }
}
assert.ok(changes > 0);
// Exercise real levitation effects and terrain together, including fractional
// expiry timing. Rendering is synchronous; logical time advances only explicitly.
const flightDungeon = load('dungeon', { PF, tiles, ...fov,
  removeEntity: load('entity', { sfx: sfxStub }).removeEntity,
  hasEffect: (e, id) => e.effects.some(effect => effect.id === id),
  removeEffect: (e, id) => flightEffects.removeEffect(e, id),
  applyEffect: (e, effect) => flightEffects.applyEffect(e, effect),
  createPoisonedEffect: () => flightEffects.createPoisonedEffect(),
  createBurningEffect: () => flightEffects.createBurningEffect(),
  createFrozenEffect: () => flightEffects.createFrozenEffect(),
  createChilledEffect: duration => flightEffects.createChilledEffect(duration),
  createCrippledEffect: duration => flightEffects.createCrippledEffect(duration),
  createConfusedEffect: () => flightEffects.createConfusedEffect(),
  sfx: sfxStub
}).default;
const flightEffects = load('effects', { dungeon: flightDungeon, spawnEntityFloatingText() {} });
// A chasm beside a diagonal is empty space, not a solid corner. Reproduce
// the wall + chasm pinch in all four orientations without stepping into it.
for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
  tiles.clearAllFeatures();
  const map = Array.from({ length: 5 }, () => Array(5).fill(0));
  map[2 + dy][2] = 1;
  tiles.setFeature(2 + dx, 2, 'chasm');
  dungeon.currentLevel = map;
  dungeon.pathGrid = new PF.Grid(map);
  tiles.applyToPathGrid(dungeon.pathGrid);
  dungeon.diagonalFinder = new PF.AStarFinder({ diagonalMovement: PF.DiagonalMovement.Always });
  assert.equal(dungeon.canStepBetween(2, 2, 2 + dx, 2 + dy), true, 'grounded actor can step beside a chasm');
  assert.deepEqual(dungeon.findPath(2, 2, 2 + dx, 2 + dy, true, true), [[2, 2], [2 + dx, 2 + dy]], 'tap route is exactly one diagonal step');
  assert.deepEqual(dungeon.findPath(2, 2, 2 + dx, 2), [], 'ordinary routes never enter the chasm');
  assert.equal(dungeon.pathGrid.isWalkableAt(2 + dx, 2), false, 'corner handling does not make the chasm walkable');
  tiles.clearAllFeatures();
  map[2][2 + dx] = 1;
  dungeon.pathGrid = new PF.Grid(map);
  assert.equal(dungeon.canStepBetween(2, 2, 2 + dx, 2 + dy), true, 'two solid side tiles do not block diagonal movement');
  assert.deepEqual(dungeon.findPath(2, 2, 2 + dx, 2 + dy), [[2, 2], [2 + dx, 2 + dy]], 'all four diagonals route directly between wall corners');
  assert.deepEqual(dungeon.findPath(2, 2, 2 + dx, 2), [], 'wall destinations remain blocked');
  for (const [x, y] of [[2 + dx, 2], [2, 2 + dy]]) {
    map[y][x] = 0;
    tiles.setFeature(x, y, 'door', { door: 'closed' });
  }
  dungeon.pathGrid = new PF.Grid(map);
  tiles.applyToPathGrid(dungeon.pathGrid);
  assert.deepEqual(dungeon.findPath(2, 2, 2 + dx, 2 + dy), [[2, 2], [2 + dx, 2 + dy]], 'closed doors beside a diagonal do not block it');
}
function flightSetup() {
  tiles.clearAllFeatures();
  const map = Array.from({ length: 5 }, (_, y) =>
    Array.from({ length: 7 }, (_, x) => y === 2 && x > 0 && x < 6 ? 0 : 1));
  tiles.setFeature(3, 2, 'chasm');
  flightDungeon.currentLevel = map;
  flightDungeon.pathGrid = new PF.Grid(map);
  tiles.applyToPathGrid(flightDungeon.pathGrid);
  flightDungeon.diagonalFinder = new PF.AStarFinder({ diagonalMovement: PF.DiagonalMovement.OnlyWhenNoObstacles });
  const ctx = renderContext({ entities: [], messages: [], visibleTiles: new Set(), simulationTime: 0.5 });
  ctx.map.getTileAt = (x, y) => ({ index: map[y][x] === 1 ? 637 : 0 });
  const flyer = Object.assign(new Entity(), { context: ctx, type: 'player', name: 'Hero',
    healthPoints: 10, x: 2, y: 2, sprite: sprite(), protection: () => 0,
    takeDamage(amount) { this.healthPoints -= amount; } });
  ctx.player = flyer; ctx.entities = [flyer];
  return { ctx, flyer };
}
{
  const { ctx, flyer } = flightSetup();
  assert.equal(flightDungeon.isWalkableTile(ctx, 3, 2), false);
  assert.deepEqual(flightDungeon.findPath(2, 2, 4, 2, true, true, flyer), []);
  flightEffects.applyEffect(flyer, flightEffects.createLevitatingEffect(2));
  assert.equal(flightDungeon.isWalkableTile(ctx, 3, 2), true);
  assert.equal(flightDungeon.isWalkableTile(ctx, 3, 1), false, 'flight never crosses walls');
  assert.equal(flightDungeon.findPath(2, 2, 4, 2, true, true, flyer).length, 3);
  assert.equal(flightDungeon.pathGrid.isWalkableAt(3, 2), false, 'flight never changes shared grid');
  assert.equal(flightDungeon.canStepBetween(2, 2, 3, 1, flyer), true, 'flight clears the chasm-side corner; destination wall is still rejected by isWalkableTile');
  flightDungeon.moveEntityTo(ctx, flyer, 3, 2);
  ctx.simulationTime = 1.49;
  flightEffects.tickEffects(flyer, ctx);
  assert.equal(flyer.effects[0].duration, 2);
  ctx.simulationTime = 1.5; flightEffects.tickEffects(flyer, ctx);
  assert.equal(flyer.effects[0].duration, 1);
  ctx.simulationTime = 2.5; flightEffects.tickEffects(flyer, ctx);
  assert.equal(flightEffects.hasEffect(flyer, 'levitating'), false);
  assert.deepEqual([flyer.x, flyer.y], [3, 2], 'expiry does not rescue the player');
  assert.equal(ctx.pendingFall, true);
  assert.equal(flyer.actionReady, false);
  assert.equal(flightDungeon.isWalkableTile(ctx, 3, 2), false);
}
for (const feature of ['water', 'grass', 'dart', 'arrow']) {
  const { ctx, flyer } = flightSetup();
  tiles.setFeature(2, 2, feature === 'dart' || feature === 'arrow' ? 'trap' : feature,
    { trapKind: feature, trap: 'hidden' });
  flightEffects.applyEffect(flyer, flightEffects.createLevitatingEffect());
  flightEffects.applyEffect(flyer, flightEffects.createBurningEffect());
  flyer.x = 1;
  flightDungeon.moveEntityTo(ctx, flyer, 2, 2);
  assert.equal(flightEffects.hasEffect(flyer, 'burning'), true, 'flight prevents water contact');
  assert.equal(tiles.getFeature(2, 2), feature === 'dart' || feature === 'arrow' ? 'trap' : feature);
  if (feature === 'dart' || feature === 'arrow') assert.equal(tiles.getTrapState(2, 2), 'hidden');
  assert.equal(flightEffects.hasEffect(flyer, 'poisoned'), false);
  flightEffects.removeEffect(flyer, 'levitating');
  assert.equal(flyer.x, 2, 'expiry on solid ground does not relocate');
  assert.ok(!ctx.pendingFall);
  flyer.x = 1;
  flightDungeon.moveEntityTo(ctx, flyer, 2, 2);
  if (feature === 'water') assert.equal(flightEffects.hasEffect(flyer, 'burning'), false);
  if (feature === 'dart') assert.equal(flightEffects.hasEffect(flyer, 'poisoned'), true);
  if (feature === 'dart' || feature === 'arrow') assert.equal(tiles.getTrapState(2, 2), 'triggered');
}
{
  const { ctx, flyer } = flightSetup();
  flyer.x = 3;
  // Traps are not safe landing sites; an occupied tile is not displaced.
  tiles.setFeature(2, 2, 'trap', { trapKind: 'dart', trap: 'hidden' });
  ctx.entities.push(actor('enemy', 4, 2));
  flightEffects.applyEffect(flyer, flightEffects.createLevitatingEffect(1));
  flightEffects.removeEffect(flyer, 'levitating');
  assert.deepEqual([flyer.x, flyer.y], [3, 2]);
  assert.equal(ctx.pendingFall, true, 'explicit removal also falls');
}
{
  const { ctx, flyer } = flightSetup();
  flyer.x = 3;
  for (const x of [1, 2, 4, 5]) ctx.entities.push(actor('enemy', x, 2));
  flightEffects.applyEffect(flyer, flightEffects.createLevitatingEffect(1));
  ctx.simulationTime = 1.5; flightEffects.tickEffects(flyer, ctx);
  assert.equal(flightEffects.hasEffect(flyer, 'levitating'), false, 'no emergency hovering');
  assert.equal(ctx.pendingFall, true);
  assert.equal(flyer.x, 3);
}
// Confirmed chasm steps share contacts and the existing fall path.
{
  const { ctx, flyer } = flightSetup();
  assert.equal(flightDungeon.stepIntoChasm(ctx, flyer, 4, 2), false, 'no distant steps');
  assert.equal(flightDungeon.stepIntoChasm(ctx, flyer, 2, 1), false, 'no walls');
  assert.equal(flightDungeon.stepIntoChasm(ctx, flyer, 1, 2), false, 'only chasms');
  flyer.effects = [{ id: 'rooted' }];
  assert.equal(flightDungeon.stepIntoChasm(ctx, flyer, 3, 2), false);
  flyer.effects = [{ id: 'levitating' }];
  assert.equal(flightDungeon.stepIntoChasm(ctx, flyer, 3, 2), false);
  flyer.effects = [];
  const occupant = actor('enemy', 3, 2);
  ctx.entities.push(occupant);
  assert.equal(flightDungeon.stepIntoChasm(ctx, flyer, 3, 2), false, 'no occupied landing');
  ctx.entities.pop();
  tiles.setFeature(2, 2, 'door', { door: 'open' });
  assert.equal(flightDungeon.stepIntoChasm(ctx, flyer, 3, 2), true);
  assert.deepEqual([flyer.x, flyer.y], [3, 2]);
  assert.equal(ctx.pendingFall, true, 'fall deferred out of the scheduler');
  assert.equal(flyer.healthPoints, 10, 'arrival resolves damage exactly once, not here');
  assert.equal(tiles.getDoorState(2, 2), 'closed', 'stepping out closes the departure door');
  assert.equal(flightDungeon.pathGrid.isWalkableAt(3, 2), false);
}
for (const flying of [false, true]) {
  const { ctx, flyer } = flightSetup();
  flyer.x = 1;
  let deaths = 0;
  const victim = Object.assign(new Entity(), { type: 'enemy', name: 'Victim', x: 2, y: 2,
    context: ctx, healthPoints: 10, effects: flying ? [{ id: 'levitating' }] : [],
    sprite: sprite(), takeDamage(n) { this.healthPoints -= n; }, onDestroy() { deaths++; } });
  ctx.entities.push(victim);
  assert.equal(flightDungeon.knockback(ctx, victim, 1, 0), true);
  assert.equal(ctx.entities.includes(victim), flying, 'only grounded victims die');
  assert.equal(deaths, flying ? 0 : 1, 'normal removal invokes destruction once');
  assert.deepEqual([victim.lastSeenX, victim.lastSeenY], [2, 2], 'knockback alerts without revealing player position');
  if (flying) {
    assert.deepEqual([victim.x, victim.y], [3, 2]);
    victim.effects = [];
    flightDungeon.expireLevitation(ctx, victim);
    assert.equal(deaths, 1, 'pushed flyers still fall when flight expires');
  }
  assert.ok(!ctx.pendingFall, 'enemy falls never descend the hero');
  assert.equal(flightDungeon.pathGrid.isWalkableAt(3, 2), false);
}
{
  const { ctx, flyer } = flightSetup();
  flyer.x = 1;
  const victim = Object.assign(new Entity(), { type: 'enemy', x: 2, y: 2,
    healthPoints: 10, context: ctx, sprite: sprite() });
  ctx.entities.push(victim);
  for (const feature of ['door', 'secretDoor']) {
    tiles.setFeature(3, 2, feature);
    assert.equal(flightDungeon.knockback(ctx, victim, 1, 0), false, 'cannot force closed doors');
  }
  tiles.clearFeature(3, 2);
  flightDungeon.currentLevel[2][3] = 1;
  assert.equal(flightDungeon.knockback(ctx, victim, 1, 0), false, 'wall blocks knockback');
  flightDungeon.currentLevel[2][3] = 0;
  victim.effects = [{ id: 'rooted' }];
  assert.equal(flightDungeon.knockback(ctx, victim, 1, 0), false, 'roots anchor the target');
  victim.effects = [];
  ctx.entities.push(actor('enemy', 3, 2));
  assert.equal(flightDungeon.knockback(ctx, victim, 1, 0), false, 'no actor stacking');
  ctx.entities.pop();
  assert.equal(flightDungeon.knockback(ctx, victim, 1, 1), false, 'cardinal vectors only');
  assert.equal(flightDungeon.knockback(ctx, victim, 0.5, 0.5), false, 'no fractional tiles');
  tiles.setFeature(3, 2, 'ice');
  assert.equal(flightDungeon.knockback(ctx, victim, 1, 0), true);
  assert.deepEqual([victim.x, victim.y], [3, 2]);
  assert.ok(flightEffects.hasEffect(victim, 'crippled'), 'forced moves retain terrain contacts');
}
for (const flying of [false, true]) {
  const { ctx, flyer } = flightSetup();
  flyer.effects = flying ? [{ id: 'levitating' }] : [];
  flyer.nextActionTime = 3.75;
  assert.equal(flightDungeon.knockback(ctx, flyer, 1, 0), true);
  assert.deepEqual([flyer.x, flyer.y], [3, 2]);
  assert.equal(!!ctx.pendingFall, !flying, 'effects can push the player into a fall too');
  assert.equal(flyer.nextActionTime, 3.75, 'forced movement does not spend victim time');
}
// Geysers are an actual displacement source for both sides, not a hero skill.
function geyserSetup(type = 'player') {
  const { ctx, flyer } = flightSetup();
  flyer.x = 1;
  flyer.type = type;
  ctx.player = type === 'player' ? flyer : undefined;
  flyer.hearNoise = Entity.prototype.hearNoise;
  flyer.onDestroy = () => {};
  flyer.nextActionTime = 2.75;
  flyer.walkPath = [{ x: 4, y: 2 }];
  flyer.inputBuffer = ['ArrowRight'];
  tiles.setFeature(2, 2, 'trap', { trapKind: 'geyser', trap: 'hidden' });
  return { ctx, victim: flyer };
}
for (const type of ['player', 'enemy']) {
  const { ctx, victim } = geyserSetup(type);
  assert.ok(!tiles.describeTile(tiles.getTileState(2, 2), false).includes('geyser'), 'hidden trap stays secret');
  assert.equal(tiles.describeTileLabel(tiles.getTileState(2, 2), false), undefined,
    'hidden traps add no inspect choice entry');
  flightDungeon.moveEntityTo(ctx, victim, 2, 2);
  assert.equal(tiles.getTrapState(2, 2), 'triggered');
  assert.equal(victim.nextActionTime, 2.75, 'blast charges no extra victim time');
  if (type === 'player') {
    assert.deepEqual(victim.walkPath, [], 'blast interrupts auto-walk');
    assert.deepEqual(victim.inputBuffer, [], 'blast discards stale buffered movement');
  }
  assert.equal(!!ctx.pendingFall, type === 'player');
  assert.equal(ctx.entities.includes(victim), type === 'player');
  if (type === 'player') {
    assert.deepEqual([victim.x, victim.y], [3, 2]);
    assert.equal(victim.healthPoints, 10, 'existing floor transition owns fall damage');
  } else assert.equal(victim.healthPoints, 0, 'monster falls die normally');
  assert.equal(flightDungeon.pathGrid.isWalkableAt(3, 2), false);
  const snapshot = [];
  tiles.forEachFeature((x, y, state) => snapshot.push({ ...state, x, y }));
  tiles.clearAllFeatures();
  snapshot.forEach(f => tiles.setFeature(f.x, f.y, f.feature, f));
  assert.equal(tiles.getTrapState(2, 2), 'triggered', 'spent geyser persists');
}
for (const type of ['player', 'enemy', 'item']) {
  const { ctx, victim } = geyserSetup(type);
  if (type !== 'item') victim.effects = [{ id: 'levitating' }];
  flightDungeon.moveEntityTo(ctx, victim, 2, 2);
  assert.equal(tiles.getTrapState(2, 2), 'hidden', 'flight and items bypass pressure plate');
  assert.deepEqual([victim.x, victim.y], [2, 2]);
  assert.ok(!ctx.pendingFall);
}
for (const obstruction of ['wall', 'door', 'actor', 'rooted']) {
  const { ctx, victim } = geyserSetup();
  tiles.clearFeature(3, 2);
  if (obstruction === 'wall') flightDungeon.currentLevel[2][3] = 1;
  if (obstruction === 'door') tiles.setFeature(3, 2, 'door');
  if (obstruction === 'actor') ctx.entities.push(actor('enemy', 3, 2));
  if (obstruction === 'rooted') victim.effects = [{ id: 'rooted' }];
  flightDungeon.moveEntityTo(ctx, victim, 2, 2);
  assert.deepEqual([victim.x, victim.y], [2, 2], 'blocked blast leaves actor on plate');
  assert.equal(tiles.getTrapState(2, 2), 'triggered', 'blocked geyser is still spent');
  assert.equal(victim.healthPoints, 10, 'no direct geyser damage');
  assert.ok(!ctx.pendingFall);
}
{
  const { ctx, victim } = geyserSetup();
  victim.x = 2;
  flightDungeon.moveEntityTo(ctx, victim, 2, 2);
  assert.equal(tiles.getTrapState(2, 2), 'hidden', 'waiting never activates the geyser');
  assert.ok(flightDungeon.searchAround(1, 2) > 0);
  assert.equal(tiles.getTrapState(2, 2), 'visible', 'search reveals, not disarms');
  assert.match(tiles.describeTile(tiles.getTileState(2, 2), false), /geyser/);
  assert.match(tiles.describeTile(tiles.getTileState(2, 2), false), /Single-use/);
  assert.equal(tiles.describeTileLabel(tiles.getTileState(2, 2), false), 'Geyser trap',
    'a revealed trap is listed beside items on the same tile');
  assert.equal(flightDungeon.inspectTileInfo(2, 2).label, 'Geyser trap');
  assert.match(flightDungeon.inspectTileInfo(2, 2).description, /geyser/);
  victim.x = 1;
  flightDungeon.moveEntityTo(ctx, victim, 2, 2);
  assert.equal(ctx.pendingFall, true, 'revealed geyser remains dangerous');
}
{
  const { ctx, victim } = geyserSetup();
  tiles.setFeature(3, 2, 'trap', { trapKind: 'geyser' });
  tiles.setFeature(4, 2, 'ice');
  flightDungeon.moveEntityTo(ctx, victim, 2, 2);
  assert.deepEqual([victim.x, victim.y], [4, 2], 'chained geysers resolve in entry direction');
  assert.equal(tiles.getTrapState(2, 2), 'triggered');
  assert.equal(tiles.getTrapState(3, 2), 'triggered');
  assert.ok(flightEffects.hasEffect(victim, 'crippled'), 'landing retains terrain contact');
  assert.equal(victim.nextActionTime, 2.75);
  // Spent geysers never push on re-entry.
  victim.x = 1;
  flightDungeon.moveEntityTo(ctx, victim, 2, 2);
  assert.deepEqual([victim.x, victim.y], [2, 2]);
}
for (const [fromX, fromY, trapX, trapY, toX, toY] of [
  [2, 1, 2, 2, 2, 3], [2, 3, 2, 2, 2, 1], [3, 2, 2, 2, 1, 2], [1, 1, 2, 2, 3, 2]
]) {
  const { ctx, victim } = geyserSetup();
  tiles.clearFeature(3, 2);
  flightDungeon.currentLevel = Array.from({ length: 5 }, () => Array(7).fill(0));
  victim.x = fromX; victim.y = fromY;
  flightDungeon.moveEntityTo(ctx, victim, trapX, trapY);
  assert.deepEqual([victim.x, victim.y], [toX, toY], 'predictable cardinal/diagonal entry direction');
}
// Confusion randomizes movement on the existing timeline, not effect ticks.
function withRoll(roll, fn) {
  const original = Math.random;
  Math.random = () => roll;
  try { return fn(); } finally { Math.random = original; }
}
for (const type of ['player', 'enemy']) {
  const { ctx, victim } = geyserSetup(type);
  tiles.setFeature(2, 2, 'trap', { trapKind: 'confusion', trap: 'hidden' });
  assert.equal(tiles.describeTile(tiles.getTileState(2, 2), false), 'Stone floor.');
  flightDungeon.moveEntityTo(ctx, victim, 2, 2);
  assert.ok(flightEffects.hasEffect(victim, 'confused'));
  assert.equal(tiles.getTrapState(2, 2), 'triggered');
  assert.equal(victim.effects.find(e => e.id === 'confused').duration, 4);
  const before = victim.nextActionTime;
  withRoll(0, () => assert.equal(flightDungeon.confusedMove(ctx, victim), true));
  assert.equal(victim.nextActionTime, before + 1, 'exactly one movement action');
  assert.equal(!!ctx.pendingFall, type === 'player', 'confused chasm misstep uses normal falls');
  assert.equal(ctx.entities.includes(victim), type === 'player');
}
{
  const { ctx, victim } = geyserSetup();
  tiles.setFeature(2, 2, 'trap', { trapKind: 'confusion' });
  victim.effects = [{ id: 'levitating' }];
  flightDungeon.moveEntityTo(ctx, victim, 2, 2);
  assert.equal(tiles.getTrapState(2, 2), 'hidden', 'flight bypasses confusion plate');
  flightEffects.applyEffect(victim, flightEffects.createConfusedEffect());
  withRoll(0, () => flightDungeon.confusedMove(ctx, victim));
  assert.deepEqual([victim.x, victim.y], [3, 2]);
  assert.ok(!ctx.pendingFall, 'confused flyers can stumble over chasms safely');
}
for (const [roll, x, y] of [[0, 3, 2], [0.25, 1, 2], [0.5, 2, 3], [0.75, 2, 1]]) {
  const { ctx, flyer } = flightSetup();
  tiles.clearAllFeatures();
  flightDungeon.currentLevel = Array.from({ length: 5 }, () => Array(7).fill(0));
  flightEffects.applyEffect(flyer, flightEffects.createConfusedEffect());
  flyer.effects.push({ id: 'haste' });
  flyer.nextActionTime = 0.5;
  withRoll(roll, () => flightDungeon.confusedMove(ctx, flyer));
  assert.deepEqual([flyer.x, flyer.y], [x, y]);
  assert.equal(flyer.nextActionTime, 1, 'fractional movement costs preserved');
  assert.equal(flyer.effects.find(e => e.id === 'confused').duration, 4, 'actions do not tick confusion');
  ctx.simulationTime = 1.49;
  flightEffects.tickEffects(flyer, ctx);
  assert.equal(flyer.effects.find(e => e.id === 'confused').duration, 4);
  for (const t of [1.5, 2.5, 3.5, 4.5]) { ctx.simulationTime = t; flightEffects.tickEffects(flyer, ctx); }
  assert.ok(!flightEffects.hasEffect(flyer, 'confused'), 'fractional world-time expiry');
}
for (const obstruction of ['wall', 'door', 'actor', 'rooted']) {
  const { ctx, flyer } = flightSetup();
  tiles.clearFeature(3, 2);
  flightEffects.applyEffect(flyer, flightEffects.createConfusedEffect());
  if (obstruction === 'wall') flightDungeon.currentLevel[2][3] = 1;
  if (obstruction === 'door') tiles.setFeature(3, 2, 'door');
  if (obstruction === 'actor') ctx.entities.push(actor('enemy', 3, 2));
  if (obstruction === 'rooted') flyer.effects.push({ id: 'rooted' });
  flyer.nextActionTime = 0;
  withRoll(0, () => assert.equal(flightDungeon.confusedMove(ctx, flyer), obstruction !== 'rooted'));
  assert.deepEqual([flyer.x, flyer.y], [2, 2]);
  assert.equal(flyer.nextActionTime, obstruction === 'rooted' ? 0 : 1, 'blocked attempts cost time, rooted actors cannot try');
}
// Real keyboard path must randomize before pickup, door/trap safety or ordinary
// path validation; otherwise confusion would silently protect against chasms.
{
  const { ctx, flyer } = flightSetup();
  const ConfusedHero = load('classes/basicHero', { Entity, dungeon: flightDungeon,
    ...tiles, ...fov, ...flightEffects, isModalOpen: () => false });
  Object.setPrototypeOf(flyer, ConfusedHero.default.prototype);
  Object.assign(flyer, { backpack: [], walkPath: [], inputBuffer: [], actionReady: true });
  ctx.inspectMode = ctx.throwMode = false;
  flightEffects.applyEffect(flyer, flightEffects.createConfusedEffect());
  withRoll(0, () => flyer.processInput('ArrowLeft'));
  assert.equal(ctx.pendingFall, true, 'left command can stumble right into chasm');
  assert.equal(flyer.nextActionTime, 1, 'keyboard charges only one action');
}
// Auto-walk uses the same stumble path and drops the remaining route.
{
  const { ctx, flyer } = flightSetup();
  const ConfusedHero = load('classes/basicHero', { Entity, dungeon: flightDungeon,
    ...tiles, ...fov, ...flightEffects, isModalOpen: () => false }).default;
  Object.setPrototypeOf(flyer, ConfusedHero.prototype);
  Object.assign(flyer, { backpack: [], walkPath: [{ x: 1, y: 2 }], inputBuffer: [],
    acknowledgedWalkEnemies: new Set(), actionReady: true });
  flightEffects.applyEffect(flyer, flightEffects.createConfusedEffect());
  withRoll(0, () => flyer.stepAutoWalk());
  assert.equal(ctx.pendingFall, true, 'auto-walk cannot bypass confusion');
  assert.equal(flyer.nextActionTime, 1);
  assert.deepEqual(flyer.walkPath, []);
}
for (const adjacent of [false, true]) {
  const { ctx, victim } = geyserSetup('enemy');
  tiles.clearFeature(2, 2);
  victim.x = 2;
  victim.range = () => 0;
  victim.visionRadius = 8;
  const hero = Object.assign(actor('player', adjacent ? 1 : 5, 2), { effects: [] });
  ctx.player = hero;
  ctx.entities.push(hero);
  flightEffects.applyEffect(victim, flightEffects.createConfusedEffect());
  let attacks = 0;
  const aiDungeon = { ...flightDungeon, attackEntity() { attacks++; } };
  const ai = load('ai', { dungeon: aiDungeon, tiles, ...fov, ...flightEffects });
  withRoll(0, () => ai.enemyTurn(victim));
  assert.equal(attacks, adjacent ? 1 : 0, 'deliberate adjacent attacks remain unchanged');
  assert.equal(ctx.entities.includes(victim), adjacent, 'moving enemy can stumble into chasm');
  assert.equal(victim.nextActionTime, 3.75, 'AI spends exactly one action');
}
// Normal enemy navigation avoids revealed traps; confusion may still step on them.
{
  const { ctx, flyer } = flightSetup();
  tiles.clearAllFeatures();
  tiles.setFeature(3, 2, 'trap', { trapKind: 'confusion', trap: 'visible' });
  const hero = flyer;
  hero.x = 4;
  hero.effects = [];
  const monster = Object.assign(new Entity(), { context: ctx, type: 'enemy', name: 'Stumbler',
    healthPoints: 10, x: 2, y: 2, sprite: sprite(), protection: () => 0,
    takeDamage(amount) { this.healthPoints -= amount; }, range: () => 0, visionRadius: 8,
    hearNoise() {}, onDestroy() {}, moving: false });
  ctx.player = hero;
  ctx.entities = [hero, monster];
  const ai = load('ai', { dungeon: flightDungeon, tiles, ...fov, ...flightEffects });
  assert.deepEqual(ai.nextStepToward(monster, 4, 2), null,
    'normal navigation refuses the only route across a revealed trap');
  flightEffects.applyEffect(monster, flightEffects.createConfusedEffect());
  withRoll(0, () => ai.enemyTurn(monster));
  assert.deepEqual([monster.x, monster.y], [3, 2], 'confused navigation can step onto a revealed trap');
  assert.equal(tiles.getTrapState(3, 2), 'triggered', 'the trap still fires for the stumbler');
  assert.ok(flightEffects.hasEffect(monster, 'confused'), 'confusion plate applies its effect');
}
// A revealed trap is a deliberate destination: clicking it or pressing the
// direction key onto it walks the hero onto the plate. Automatic navigation
// still routes around plates on the way to any other tile.
function trapWalkSetup(map, heroX, heroY) {
  tiles.clearAllFeatures();
  flightDungeon.currentLevel = map;
  flightDungeon.pathGrid = new PF.Grid(map);
  tiles.applyToPathGrid(flightDungeon.pathGrid);
  flightDungeon.diagonalFinder = new PF.AStarFinder({ diagonalMovement: PF.DiagonalMovement.OnlyWhenNoObstacles });
  const ctx = renderContext({ entities: [], messages: [], visibleTiles: new Set(), simulationTime: 0 });
  ctx.map.getTileAt = (x, y) => ({ index: map[y]?.[x] === 1 ? 637 : 0 });
  ctx.map.worldToTileX = x => x;
  ctx.map.worldToTileY = y => y;
  const hero = Object.assign(new Entity(), {
    context: ctx, type: 'player', name: 'Hero', healthPoints: 30, maxHealthPoints: 30,
    x: heroX, y: heroY, sprite: sprite(), protection: () => 0, hunger: 100,
    movementSpeed: 1, attackDelay: 1, nextActionTime: 0, actionReady: true,
    effects: [], walkPath: [], inputBuffer: [], acknowledgedWalkEnemies: new Set(), actions: [],
    takeDamage(amount) { this.healthPoints -= amount; },
    canAct() { return this.actionReady && !this.moving; },
    spendTurn(action) {
      this.actions.push(action);
      this.nextActionTime += actionCost(this, action, this.currentWeapon()?.attackDelay ?? 1);
      this.actionReady = false;
    },
    currentWeapon: () => undefined,
  });
  ctx.player = hero;
  ctx.entities = [hero];
  const nav = createHeroNavigation({ dungeon: flightDungeon, isModalOpen: () => false,
    hasEffect: flightEffects.hasEffect, isGrassConcealed: tiles.isGrassConcealed,
    actionCost, starvationDamageDuring });
  Object.assign(hero, {
    nextStepToward: (x, y) => nav.nextStepToward(hero, x, y),
    setWalkTarget: (x, y, target) => nav.setWalkTarget(hero, x, y, target),
    tryStepIntoChasm: (x, y) => nav.tryStepIntoChasm(hero, x, y),
    stepAutoWalk: () => nav.stepAutoWalk(hero),
  });
  const ready = () => {
    hero.actionReady = true;
    ctx.simulationTime = hero.nextActionTime;
  };
  return { ctx, hero, nav, ready };
}
// The corridor map used by flightSetup: row 2 is the only open ground.
const corridorMap = (wallTile, width = 7) => Array.from({ length: 5 }, (_, y) =>
  Array.from({ length: width }, (_, x) => y === 2 && x > 0 && x < width - 1 ? 0 : wallTile));
{
  const { hero, nav, ready } = trapWalkSetup(corridorMap(1), 2, 2);
  tiles.setFeature(3, 2, 'trap', { trapKind: 'dart', trap: 'visible' });
  nav.stepManually(hero, 1, 0);
  assert.deepEqual([hero.x, hero.y], [3, 2], 'a direction key deliberately steps onto a revealed trap');
  assert.deepEqual(hero.actions, ['move'], 'the trap step costs a normal move');
  assert.equal(tiles.getTrapState(3, 2), 'triggered', 'stepping on the plate triggers it');
  assert.ok(flightEffects.hasEffect(hero, 'poisoned'), 'the dart trap still poisons the hero');
  ready();
  nav.stepManually(hero, 1, 0);
  assert.deepEqual([hero.x, hero.y], [4, 2], 'the hero keeps walking after the trap fires');
}
{
  const { ctx, hero, nav, ready } = trapWalkSetup(corridorMap(1), 2, 2);
  tiles.setFeature(4, 2, 'trap', { trapKind: 'fire', trap: 'visible' });
  // Go through the real tap handler, not just the planner.
  const input = createHeroInput({ dungeon: flightDungeon, isModalOpen: () => false,
    isGrassConcealed: tiles.isGrassConcealed, hasLineOfSight: () => true });
  input.processTouchInput(hero, ctx, { worldX: 4, worldY: 2 });
  assert.deepEqual(hero.walkPath, [{ x: 3, y: 2 }, { x: 4, y: 2 }],
    'an explicit tap on a revealed trap is a valid destination');
  nav.stepAutoWalk(hero);
  assert.deepEqual([hero.x, hero.y], [3, 2], 'auto-walk approaches the tapped trap');
  ready();
  nav.stepAutoWalk(hero);
  assert.deepEqual([hero.x, hero.y], [4, 2], 'auto-walk finishes on the tapped trap');
  assert.equal(tiles.getTrapState(4, 2), 'triggered');
  assert.ok(flightEffects.hasEffect(hero, 'burning'), 'the fire trap fires for a tapped destination');
}
{
  const { hero, nav, ready } = trapWalkSetup(corridorMap(1), 2, 2);
  tiles.setFeature(3, 2, 'trap', { trapKind: 'fire', trap: 'visible' });
  nav.setWalkTarget(hero, 5, 2);
  assert.deepEqual(hero.walkPath, [], 'a revealed trap blocks the only corridor to a farther tap');
  nav.stepAutoWalk(hero);
  assert.deepEqual([hero.x, hero.y], [2, 2], 'the hero does not wander into the plate');
  assert.equal(tiles.getTrapState(3, 2), 'visible');
  ready();
  nav.setWalkTarget(hero, 3, 2);
  assert.deepEqual(hero.walkPath, [{ x: 3, y: 2 }], 'tapping the trap itself is still allowed from here');
}
{
  // Open room: auto-walk detours around the plate instead of refusing the trip.
  const map = Array.from({ length: 5 }, () => Array(7).fill(1));
  for (let y = 1; y <= 3; y++) for (let x = 1; x <= 5; x++) map[y][x] = 0;
  const { hero, nav, ready } = trapWalkSetup(map, 1, 2);
  tiles.setFeature(3, 2, 'trap', { trapKind: 'frost', trap: 'visible' });
  nav.setWalkTarget(hero, 5, 2);
  assert.ok(hero.walkPath.length > 0, 'a detour exists around the revealed trap');
  assert.ok(!hero.walkPath.some(step => step.x === 3 && step.y === 2),
    'automatic navigation never includes the revealed trap');
  for (let step = 0; step < 20 && hero.walkPath.length > 0; step++) {
    ready();
    nav.stepAutoWalk(hero);
  }
  assert.deepEqual([hero.x, hero.y], [5, 2], 'the hero reaches the tap without touching the plate');
  assert.equal(tiles.getTrapState(3, 2), 'visible', 'the avoided trap stays armed');
}
// Teleport traps are always reusable; other kinds honor their configured policy.
// Reactivation never depends on a world-time timer.
for (const trapKind of ['dart', 'fire', 'frost', 'teleport', 'arrow', 'summon', 'alarm']) {
  for (const configuredReusable of [undefined, false, true]) {
    const trapReusable = trapKind === 'teleport' || !!configuredReusable;
    const { ctx, flyer } = flightSetup();
    flyer.healthPoints = 100; flyer.x = 1;
    let summons = 0;
    ctx.onSummonTrap = (x, y) => {
      assert.deepEqual([x, y], [2, 2]); summons++; return true;
    };
    const listeners = [[10, 2, 10], [11, 2, 10], [2, 1, 0]].map(([x, y, hp]) =>
      Object.assign(new Entity(), { type: 'enemy', x, y, healthPoints: hp }));
    ctx.entities.push(...listeners);
    tiles.clearFeature(3, 2);
    flightDungeon.pathGrid.setWalkableAt(3, 2, true);
    tiles.setFeature(2, 2, 'trap', { trapKind, trapReusable: configuredReusable, trap: 'hidden' });
    assert.equal(tiles.describeTile(tiles.getTileState(2, 2), false), 'Stone floor.');
    assert.equal(tiles.describeTileLabel(tiles.getTileState(2, 2), false), undefined,
      'plain floor is never offered as an inspect choice');
    assert.equal(flightDungeon.searchAround(1, 2), 1);
    assert.equal(flightDungeon.searchAround(1, 2), 0);
    assert.equal(tiles.getTrapState(2, 2), 'visible', 'search reveals, never disarms');
    assert.equal(tiles.getTileState(2, 2).trapReusable, trapReusable);
    assert.match(tiles.describeTile(tiles.getTileState(2, 2), false),
      trapReusable ? /Reusable/ : /Single-use/);
    tiles.setTrapState(2, 2, 'hidden');
    let activations = 0;
    flightDungeon.onTerrainChanged = () => activations++;
    const randomTile = flightDungeon.randomWalkableTile;
    flightDungeon.randomWalkableTile = () => ({ x: 4, y: 2 });
    flightEffects.applyEffect(flyer, flightEffects.createLevitatingEffect());
    flightDungeon.moveEntityTo(ctx, flyer, 2, 2);
    assert.equal(activations, 0, 'flight never activates reusable traps either');
    assert.equal(summons, 0);
    assert.equal(listeners[0].lastSeenX, undefined);
    flightEffects.removeEffect(flyer, 'levitating');
    flyer.x = 1;
    flightDungeon.moveEntityTo(ctx, flyer, 2, 2);
    assert.equal(activations, 1);
    assert.equal(tiles.getTrapState(2, 2), trapReusable ? 'visible' : 'triggered');
    assert.match(tiles.describeTile(tiles.getTileState(2, 2), false),
      trapReusable ? /Reusable/ : /triggered/);
    if (trapReusable) {
      assert.deepEqual(flightDungeon.findPath(1, 2, 4, 2, true, true, flyer), [],
        'auto-walk still avoids an activated reusable trap');
      assert.equal(flightDungeon.findPath(1, 2, 2, 2, true, true, flyer).length, 2,
        'explicitly selecting the trap permits entry');
    }
    if (trapKind === 'teleport') assert.equal(flyer.x, 4);
    if (trapKind === 'frost') {
      assert.equal(flightEffects.hasEffect(flyer, 'frozen'), true);
      // The skip alone is situational; the slow is the trap's real cost.
      assert.equal(flightEffects.hasEffect(flyer, 'chilled'), true, 'frost trap also chills');
      assert.equal(flyer.effects.find(e => e.id === 'chilled').duration, 10);
    }
    flightDungeon.moveEntityTo(ctx, flyer, flyer.x, flyer.y);
    assert.equal(activations, 1, 'standing on the tile is not another entry');
    const chilled = flyer.effects.find(e => e.id === 'chilled');
    if (chilled) chilled.duration = 3;
    flightDungeon.moveEntityTo(ctx, flyer, 1, 2);
    flightDungeon.moveEntityTo(ctx, flyer, 2, 2);
    assert.equal(activations, trapReusable ? 2 : 1, 'only reusable traps reactivate');
    if (chilled) {
      assert.equal(flyer.effects.filter(e => e.id === 'chilled').length, 1, 'the slow never stacks');
      assert.equal(chilled.duration, trapReusable ? 10 : 3,
        trapReusable ? 're-entry refreshes the slow to full duration' : 'a single-use trap never refreshes it');
    }
    assert.equal(ctx.simulationTime, 0.5, 'no rearming timer or extra action cost');
    assert.equal(summons, trapKind === 'summon' ? (trapReusable ? 2 : 1) : 0);
    if (trapKind === 'alarm') {
      assert.deepEqual([listeners[0].lastSeenX, listeners[0].lastSeenY], [2, 2], 'inclusive noise radius');
      assert.equal(listeners[0].awareOfPlayer, false, 'noise is not player vision');
      assert.equal(listeners[1].lastSeenX, undefined, 'outside radius unaffected');
      assert.equal(listeners[2].lastSeenX, undefined, 'dead actors unaffected');
    }
    // Search and snapshot restoration must preserve the activation policy/state.
    flightDungeon.searchAround(1, 2);
    const saved = { ...tiles.getTileState(2, 2) };
    tiles.clearAllFeatures();
    tiles.setFeature(2, 2, saved.feature, saved);
    assert.equal(tiles.getTileState(2, 2).trapReusable, trapReusable);
    assert.equal(tiles.activateTrap(2, 2), trapReusable);
    flightDungeon.randomWalkableTile = randomTile;
    tiles.setFeature(2, 2, 'grass');
    assert.equal(tiles.getTileState(2, 2).trapReusable, undefined);
    tiles.setFeature(2, 2, 'trap');
    assert.equal(tiles.getTileState(2, 2).trapReusable, false, 'legacy traps remain single-use');
  }
}
{
  const { ctx, flyer } = flightSetup();
  flyer.x = 1;
  let attempts = 0;
  ctx.onSummonTrap = () => { attempts++; return false; };
  tiles.setFeature(2, 2, 'trap', { trapKind: 'summon', trap: 'hidden' });
  flightDungeon.moveEntityTo(ctx, flyer, 2, 2);
  assert.equal(tiles.getTrapState(2, 2), 'triggered', 'blocked summons still consume the trap');
  assert.ok(ctx.messages.some(message => message.includes('fizzles')));
  flightDungeon.moveEntityTo(ctx, flyer, 1, 2);
  flightDungeon.moveEntityTo(ctx, flyer, 2, 2);
  assert.equal(attempts, 1, 'fizzled single-use trap does not retry');
}
// Fire consumes an entire connected patch, not just one tile per movement.
{
  const { ctx, flyer: source } = flightSetup();
  tiles.clearAllFeatures();
  flightDungeon.currentLevel = Array.from({ length: 9 }, () => Array(10).fill(0));
  const patch = [[2, 2], [3, 2], [3, 3], [2, 3], [4, 3], [5, 3]];
  for (const [x, y] of patch) tiles.setFeature(x, y, 'grass');
  for (const [x, y] of [[6, 4], [7, 3], [5, 5], [1, 5]]) tiles.setFeature(x, y, 'grass');
  tiles.setFeature(6, 3, 'water'); // firebreak before (7,3)
  tiles.setFeature(5, 4, 'grass');
  flightDungeon.currentLevel[4][5] = 1; // stale overlay on a wall must not burn through it
  const make = (type, x, y, hp = 20) => Object.assign(new Entity(), {
    type, x, y, healthPoints: hp, context: ctx, name: type
  });
  const grounded = make('enemy', 5, 3);
  const airborne = make('enemy', 4, 3);
  const item = make('item', 3, 3);
  const corpse = make('enemy', 3, 2, 0);
  ctx.entities.push(grounded, airborne, item, corpse);
  flightEffects.applyEffect(airborne, flightEffects.createLevitatingEffect());
  flightEffects.applyEffect(source, flightEffects.createBurningEffect());
  let refreshes = 0;
  const burnEvents = [];
  ctx.onGrassBurn = cells => { assert.equal(refreshes, 0); burnEvents.push(cells); };
  flightDungeon.onTerrainChanged = () => refreshes++;
  assert.equal(fov.blocksSight(flightDungeon.currentLevel, 3, 2), true);
  flightDungeon.igniteGrass(ctx, source, 2, 2);
  for (const [x, y] of patch) assert.equal(tiles.getFeature(x, y), undefined);
  for (const [x, y] of [[6, 4], [7, 3], [5, 5], [1, 5], [5, 4]]) {
    assert.equal(tiles.getFeature(x, y), 'grass', 'diagonal, separated and wall grass survives');
  }
  assert.equal(tiles.getFeature(6, 3), 'water');
  assert.equal(flightEffects.hasEffect(grounded, 'burning'), true, 'offscreen actors burn without sprites');
  assert.equal(flightEffects.hasEffect(airborne, 'burning'), false);
  assert.equal(flightEffects.hasEffect(item, 'burning'), false);
  assert.equal(flightEffects.hasEffect(corpse, 'burning'), false);
  assert.equal(refreshes, 1, 'refresh terrain/FOV once per spread');
  assert.equal(fov.blocksSight(flightDungeon.currentLevel, 3, 2), false);
  assert.equal(ctx.simulationTime, 0.5);
  const hp = grounded.healthPoints;
  ctx.simulationTime = 1.49; flightEffects.tickEffects(grounded, ctx);
  assert.equal(grounded.healthPoints, hp, 'ignition does not invent an extra damage tick');
  ctx.simulationTime = 1.5; flightEffects.tickEffects(grounded, ctx);
  assert.ok(grounded.healthPoints < hp, 'burn damage uses the existing world-time clock');
  flightDungeon.igniteGrass(ctx, source, 2, 2);
  assert.equal(refreshes, 1, 'spent patch cannot ignite again');
  assert.equal(burnEvents.length, 1);
  assert.deepEqual(burnEvents[0].map(({ x, y }) => `${x},${y}`).sort(), patch.map(([x, y]) => `${x},${y}`).sort(),
    'visual event contains exactly the burned patch, once, before terrain refresh');
  const saved = [];
  tiles.forEachFeature((x, y, state) => saved.push({ ...state, x, y }));
  tiles.clearAllFeatures(); saved.forEach(f => tiles.setFeature(f.x, f.y, f.feature, f));
  assert.equal(tiles.getFeature(3, 2), undefined, 'burned grass stays gone on restoration');
}
// Large, cyclic patches terminate iteratively with a single terrain refresh.
{
  const { ctx, flyer } = flightSetup();
  tiles.clearAllFeatures();
  flightDungeon.currentLevel = Array.from({ length: 50 }, () => Array(50).fill(0));
  for (let y = 0; y < 50; y++) for (let x = 0; x < 50; x++) tiles.setFeature(x, y, 'grass');
  let refreshes = 0; flightDungeon.onTerrainChanged = () => refreshes++;
  flightDungeon.igniteGrass(ctx, flyer, 0, 0);
  let remaining = 0; tiles.forEachFeature(() => remaining++);
  assert.equal(remaining, 0); assert.equal(refreshes, 1);
}
// Frost/ice use existing effect phases; terrain itself persists until melted.
{
  const { ctx, flyer } = flightSetup();
  tiles.clearAllFeatures();
  flightDungeon.currentLevel = Array.from({ length: 7 }, () => Array(7).fill(0));
  ctx.onFrostTerrain = (x, y) => flightDungeon.freezeWater(ctx, x, y);
  for (const [x, y] of [[2, 2], [3, 2], [1, 2], [2, 3], [2, 1], [3, 3]]) {
    tiles.setFeature(x, y, 'water');
  }
  flightDungeon.currentLevel[1][2] = 1;
  let refreshes = 0; flightDungeon.onTerrainChanged = () => refreshes++;
  flightEffects.applyEffect(flyer, flightEffects.createFrozenEffect());
  assert.equal(refreshes, 1);
  for (const [x, y] of [[2, 2], [3, 2], [1, 2], [2, 3]]) assert.equal(tiles.getFeature(x, y), 'ice');
  assert.equal(tiles.getFeature(3, 3), 'water', 'no diagonal splash');
  assert.equal(tiles.getFeature(2, 1), 'water', 'no freezing a wall overlay');
  assert.equal(tiles.isBlocking(2, 2), false, 'ice is walkable');
  assert.equal(fov.blocksSight(flightDungeon.currentLevel, 2, 2), false);
  assert.match(tiles.describeTile(tiles.getTileState(2, 2), false), /slows movement/);
  tiles.setFeature(3, 2, 'water');
  flightEffects.applyEffect(flyer, flightEffects.createFrozenEffect());
  assert.equal(tiles.getFeature(3, 2), 'ice', 'repeated frost still freezes terrain');
  flightEffects.removeEffect(flyer, 'frozen');
  flyer.x = 1; flyer.y = 1;
  flightDungeon.moveEntityTo(ctx, flyer, 2, 2);
  assert.equal(flightEffects.hasEffect(flyer, 'crippled'), true);
  const { actionCost } = load('timing');
  assert.equal(actionCost(flyer, 'move'), 2);
  assert.equal(actionCost(flyer, 'attack'), 1, 'ice never slows attack delay');
  ctx.simulationTime = 1.49; flightEffects.tickEffects(flyer, ctx);
  assert.equal(actionCost(flyer, 'move'), 2);
  ctx.simulationTime = 2.5; flightEffects.tickEffects(flyer, ctx);
  flightEffects.tickEffects(flyer, ctx);
  assert.equal(flightEffects.hasEffect(flyer, 'crippled'), false);
  flightDungeon.moveEntityTo(ctx, flyer, 2, 2);
  assert.equal(flightEffects.hasEffect(flyer, 'crippled'), false, 'standing still does not reapply slow');
  assert.equal(tiles.getFeature(2, 2), 'ice', 'status expiry does not thaw terrain');
  // Flight bypasses both slow and melting.
  flyer.x = 1;
  flightEffects.applyEffect(flyer, flightEffects.createLevitatingEffect());
  flightEffects.applyEffect(flyer, flightEffects.createBurningEffect());
  flightDungeon.moveEntityTo(ctx, flyer, 2, 2);
  assert.equal(tiles.getFeature(2, 2), 'ice');
  assert.equal(flightEffects.hasEffect(flyer, 'burning'), true);
  assert.equal(flightEffects.hasEffect(flyer, 'crippled'), false);
  flightEffects.removeEffect(flyer, 'levitating'); flyer.x = 1;
  flightDungeon.moveEntityTo(ctx, flyer, 2, 2);
  assert.equal(tiles.getFeature(2, 2), 'water');
  assert.equal(flightEffects.hasEffect(flyer, 'burning'), false, 'meltwater extinguishes contact fire');
  assert.equal(flightEffects.hasEffect(flyer, 'crippled'), false, 'melt before slowing');
  const saved = [];
  tiles.forEachFeature((x, y, state) => saved.push({ ...state, x, y }));
  tiles.clearAllFeatures(); saved.forEach(f => tiles.setFeature(f.x, f.y, f.feature, f));
  assert.equal(tiles.getFeature(2, 2), 'water');
  assert.equal(tiles.getFeature(3, 2), 'ice');
  // Real thrown-potion landing freezes empty water and consumes the potion.
  const thrower = Object.create(Hero.prototype);
  thrower.context = ctx;
  thrower.placeItemOnGround = () => assert.fail('frost splash must be consumed');
  const potion = { type: 'item', consumable: true, name: 'Potion of Frost' };
  ctx.entities.push(potion);
  ctx.currentLevel = flightDungeon.currentLevel;
  tiles.setFeature(4, 4, 'water');
  thrower.resolveThrowLanding(potion, 4, 4);
  assert.equal(tiles.getFeature(4, 4), 'ice');
  assert.equal(ctx.entities.includes(potion), false);
}
console.log('terrain-pressure: generation, secrets, FOV, paths, persistence, reusable/summon/alarm/geyser/confusion traps, knockback, confused movement/AI, fire spread, frozen water, arrows, stacks, deaths and levitation passed');
