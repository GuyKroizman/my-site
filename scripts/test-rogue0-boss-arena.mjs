import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('boss-arena');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
import { generateMap, floorIsBossArena, bossArenaRoom, bossArenaWallTiles, findFarthestWalkable } from '../src/games/rogue0/mapgen.ts';
import { BOSS_ARENA_LAYOUTS, bossArenaLayout } from '../src/games/rogue0/bossArenas.ts';
import {
  BOSS_TEXTURE, BOSS_PIXELS, BOSS_PALETTE, BOSS_TEXTURE_SIZE, generateBossTexture
} from '../src/games/rogue0/monsters/bossTexture.ts';
import { actorOrigin, occludesPlayer } from '../src/games/rogue0/rendering.ts';
import { actorBodyAtTile, bodyAtTile, bodyDistance, bodyOverlapsAt } from '../src/games/rogue0/actorBodies.ts';

// --- One compact arena instead of a room network ----------------------------
for (const floor of [5, 10, 15, 20, 25]) {
  assert.equal(floorIsBossArena(floor), true, `floor ${floor} is a boss arena`);
}
for (const floor of [1, 2, 3, 4, 6, 9, 11, 24]) {
  assert.equal(floorIsBossArena(floor), false, `floor ${floor} keeps the room network`);
}
assert.equal(floorIsBossArena(0), false);
assert.equal(floorIsBossArena(5.5), false);

const seenSpans = new Set();

// Count free-standing 2x2 pillar blocks in a hall plan. A 2x2 corner of a
// chamfer or corner mass is not a pillar: a real pillar has open floor on all
// four of its sides.
function pillarCount(walls) {
  const set = new Set(walls.map(w => `${w.x},${w.y}`));
  const has = (x, y) => set.has(`${x},${y}`);
  let count = 0;
  for (const { x, y } of walls) {
    if (!has(x + 1, y) || !has(x, y + 1) || !has(x + 1, y + 1)) continue;
    const boxedIn =
      has(x - 1, y) || has(x - 1, y + 1) || has(x, y - 1) || has(x + 1, y - 1) ||
      has(x + 2, y) || has(x + 2, y + 1) || has(x, y + 2) || has(x + 1, y + 2);
    if (boxedIn) continue;
    count++;
  }
  return count;
}

// Every boss floor builds its own hall. The five plans must be distinct in
// identity and in the rock they place inside the hall.
const bossFloors = [5, 10, 15, 20, 25];
assert.equal(BOSS_ARENA_LAYOUTS.length, bossFloors.length,
  'one layout per boss floor');
const layoutIds = bossFloors.map(floor => bossArenaLayout(floor).id);
assert.equal(new Set(layoutIds).size, bossFloors.length,
  'each boss floor has a different arena layout');
assert.deepEqual(layoutIds, BOSS_ARENA_LAYOUTS.map(layout => layout.id),
  'layouts are handed out in floor order');
const signatures = bossFloors.map(floor => {
  const room = bossArenaRoom(80, 50, floor);
  const walls = bossArenaWallTiles(room, floor)
    .map(w => `${w.x - room.x},${w.y - room.y}`)
    .sort()
    .join(';');
  return `${room.w}x${room.h}|${walls}`;
});
assert.equal(new Set(signatures).size, bossFloors.length,
  'no two boss floors carve the same hall');

for (const floor of bossFloors) {
  for (let repeat = 0; repeat < 3; repeat++) {
    const generated = generateMap(floor);
    const { map, rooms, features, secretRoom, spawn, bossArena, stairs } = generated;
    const layout = bossArenaLayout(floor);

    assert.equal(rooms.length, 1, `floor ${floor} is a single room`);
    const arena = rooms[0];
    assert.deepEqual(arena, bossArenaRoom(80, 50, floor),
      `floor ${floor} carves its own plan`);
    assert.equal(arena.w, layout.width, `floor ${floor} hall width follows its layout`);
    assert.equal(arena.h, layout.height, `floor ${floor} hall height follows its layout`);
    seenSpans.add(`${arena.w}x${arena.h}`);
    const at = (lx, ly) => map[arena.y + ly][arena.x + lx];

    // The hall is exactly the plan: rock where the layout says rock, open floor
    // everywhere else, and no corridors, chasms or doors.
    const walls = bossArenaWallTiles(arena, floor);
    const wallTiles = new Set(walls.map(w => `${w.x},${w.y}`));
    for (let y = arena.y; y < arena.y + arena.h; y++) {
      for (let x = arena.x; x < arena.x + arena.w; x++) {
        assert.equal(map[y][x], wallTiles.has(`${x},${y}`) ? 1 : 0,
          `floor ${floor} tile ${x},${y} matches its layout`);
      }
    }
    assert.ok(walls.length > 0, `floor ${floor} builds interior rock`);
    assert.ok(!features.some(f => f.feature === 'chasm'), 'no chasm splits the arena');
    assert.ok(!features.some(f => f.feature === 'door'), 'a single room needs no doors');
    assert.ok(!features.some(f => f.feature === 'trap' && f.trapKind === 'summon'),
      'nothing may summon another monster into the arena');

    // Each hall's signature shape, as it reads on the standard map.
    if (layout.id === 'colonnade') {
      // Floor 5 keeps its four 2x2 pillars exactly 10 tiles apart.
      assert.equal(pillarCount(walls), 4, 'the rotunda stands four pillars');
      for (const [px, py] of [[1, 1], [13, 1], [1, 13], [13, 13]]) {
        assert.equal(at(px, py), 1, `rotunda pillar at ${px},${py}`);
        assert.equal(at(px + 1, py + 1), 1, 'pillars are 2x2');
      }
      assert.equal(at(3, 1), 0, 'the pillars are 2 tiles wide, not wider');
      let gap = 0;
      for (let x = 3; x < 13; x++) if (at(x, 1) === 0) gap++;
      assert.equal(gap, 10, 'the north pillars stand 10 tiles apart');
      gap = 0;
      for (let y = 3; y < 13; y++) if (at(1, y) === 0) gap++;
      assert.equal(gap, 10, 'the west pillars stand 10 tiles apart');
    }
    if (layout.id === 'longHall') {
      assert.equal(pillarCount(walls), 6, 'the long hall is lined with six pillars');
      for (const [px, py] of [[3, 2], [10, 2], [17, 2], [3, 9], [10, 9], [17, 9]]) {
        assert.equal(at(px, py), 1, `long hall pillar at ${px},${py}`);
        assert.equal(at(px + 1, py + 1), 1, 'pillars are 2x2');
        assert.equal(at(px + 2, py), 0, 'pillars are 2 tiles wide');
      }
      for (let y = 0; y < arena.h; y++) {
        assert.equal(at(12, y), 0, 'the centre aisle stays clear from gate to gate');
      }
    }
    if (layout.id === 'octagon') {
      assert.equal(at(0, 0), 1, 'the sanctum corners are chamfered');
      assert.equal(at(2, 0), 1);
      assert.equal(at(3, 0), 0, 'the chamfer stops after three tiles');
      assert.equal(at(0, 2), 1);
      assert.equal(at(0, 3), 0);
      assert.equal(at(arena.w - 1, 0), 1);
      assert.equal(at(0, arena.h - 1), 1);
      assert.equal(at(arena.w - 1, arena.h - 1), 1);
      assert.equal(pillarCount(walls), 4, 'four obelisks mark the inner corners');
    }
    if (layout.id === 'cross') {
      for (const [cx, cy] of [[0, 0], [arena.w - 1, 0], [0, arena.h - 1], [arena.w - 1, arena.h - 1]]) {
        assert.equal(at(cx, cy), 1, 'the vault has solid corners');
      }
      assert.equal(at(5, 5), 1, 'the corner mass is six tiles deep');
      assert.equal(at(6, 5), 0);
      assert.equal(at(5, 6), 0);
      assert.equal(at(10, 0), 0, 'the north arm reaches the wall');
      assert.equal(at(0, 10), 0, 'the west arm reaches the wall');
      assert.equal(at(19, 10), 0, 'the east arm reaches the wall');
      assert.equal(pillarCount(walls), 4, 'the crossing is framed by four pillars');
    }
    if (layout.id === 'throne') {
      assert.equal(pillarCount(walls), 8, 'eight piers ring the throne');
      assert.equal(at(2, 2), 1);
      assert.equal(at(3, 3), 1);
      assert.equal(at(8, 2), 1, 'a pier sits mid-way along the north wall');
      assert.equal(at(16, 8), 1, 'a pier sits mid-way along the east wall');
      assert.equal(at(10, 0), 0, 'the north gate stays open');
      assert.equal(at(9, 0), 0);
    }

    // The guardian waits dead centre, where every plan leaves its middle clear.
    assert.deepEqual(bossArena, { x: arena.cx, y: arena.cy }, 'the guardian spawns dead centre');
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        assert.equal(map[bossArena.y + dy][bossArena.x + dx], 0,
          'the guardian\'s 3x3 body stands on open floor');
      }
    }

    // The hero arrives at the south edge, opposite the guardian.
    assert.ok(spawn, 'the arena tells the scene where the hero enters');
    assert.equal(spawn.x, arena.cx, 'the hero enters on the arena axis');
    assert.equal(map[spawn.y][spawn.x], 0, 'the entrance is open floor');
    assert.ok(spawn.y >= bossArena.y + 4, 'the hero still enters across the hall');
    assert.ok(spawn.y >= arena.y && spawn.y < arena.y + arena.h, 'the entrance is inside the hall');

    // Everything the hall leaves open is reachable from the entrance.
    const seen = new Set([`${spawn.x},${spawn.y}`]);
    const queue = [spawn];
    while (queue.length) {
      const { x, y } = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < arena.x || ny < arena.y || nx >= arena.x + arena.w || ny >= arena.y + arena.h) continue;
        const key = `${nx},${ny}`;
        if (map[ny][nx] !== 0 || seen.has(key)) continue;
        seen.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
    for (let y = arena.y; y < arena.y + arena.h; y++) {
      for (let x = arena.x; x < arena.x + arena.w; x++) {
        if (wallTiles.has(`${x},${y}`)) continue;
        assert.ok(seen.has(`${x},${y}`), `arena tile ${x},${y} is reachable from the entrance`);
      }
    }

    // The exit is the farthest open tile from the entrance in the eastern half:
    // across the hall, inside it, and clear of the hidden branch.
    assert.ok(Math.hypot(stairs.x - spawn.x, stairs.y - spawn.y) >= 12,
      'the sealed stairs sit across the hall');
    assert.notDeepEqual(stairs, bossArena, 'the stairs never share the guardian tile');
    assert.equal(map[stairs.y][stairs.x], 0, 'the exit is a floor tile');
    assert.ok(stairs.x >= arena.x && stairs.x < arena.x + arena.w &&
      stairs.y >= arena.y && stairs.y < arena.y + arena.h, 'the exit is inside the arena');
    assert.ok(seen.has(`${stairs.x},${stairs.y}`), 'the exit is reachable from the entrance');
    assert.ok(stairs.x >= arena.cx, 'the exit stays in the eastern half');
    assert.ok(secretRoom.x > stairs.x + 2 || stairs.y > secretRoom.y + 2,
      'the exit never lands beside the hidden branch');
    // The generic search still only finds the concealed stub above the wall.
    const branchX = map[arena.y].indexOf(0);
    const naive = findFarthestWalkable(map, spawn.x, spawn.y, 80);
    assert.deepEqual({ x: naive.x, y: naive.y }, { x: branchX, y: arena.y - 2 },
      'the arena overrides the generic exit search');
    assert.notDeepEqual({ x: naive.x, y: naive.y }, stairs,
      'the stated exit is never the concealed stub');

    // The hidden gem branch still hangs above each hall's north wall.
    assert.ok(secretRoom, 'a boss floor keeps its hidden gem room');
    for (let y = secretRoom.y; y < secretRoom.y + secretRoom.h; y++) {
      for (let x = secretRoom.x; x < secretRoom.x + secretRoom.w; x++) {
        assert.equal(map[y][x], 0, 'the hidden room is fully carved');
      }
    }
    assert.ok(secretRoom.cy < arena.y, 'the hidden room sits above the arena');
  }
}

assert.deepEqual([...seenSpans].sort(), ['16x16', '18x18', '20x20', '24x14'],
  'four footprint sizes; the two 20x20 halls share a size but not a plan');
assert.deepEqual(
  bossFloors.map(floor => {
    const room = bossArenaRoom(80, 50, floor);
    return `${room.w}x${room.h}`;
  }),
  ['16x16', '24x14', '18x18', '20x20', '20x20'],
  'each hall fits inside the rock border on the standard map'
);
assert.deepEqual(bossArenaRoom(80, 50, 5), { x: 32, y: 22, w: 16, h: 16, cx: 40, cy: 30 },
  'the first hall stays the halved 16x16 rotunda, centred on the map');
assert.deepEqual(bossArenaRoom(80, 50, 15), { x: 31, y: 21, w: 18, h: 18, cx: 40, cy: 30 },
  'every hall stays centred, keeping the guardian on the map centre');
assert.equal(bossArenaRoom(24, 24, 10).h, 10,
  'a map with no room clamps the hall instead of overflowing');
assert.equal(bossArenaRoom(24, 24, 10).w, 16);

// A normal floor is still a network of rooms: the arena rule is opt-in.
{
  const normal = generateMap(6);
  assert.ok(normal.rooms.length > 1, 'ordinary floors still have many rooms');
  assert.equal(normal.bossArena, undefined);
  assert.equal(normal.spawn, undefined);
  assert.equal(normal.stairs, undefined);
}

// Large, scaled art stays centred on its cell and its feet on the cell bottom;
// otherwise the boss is drawn south-east of the tile the pointer resolves to.
assert.deepEqual(actorOrigin(16, 16, 1), { x: 0, y: 0 }, 'ordinary actors keep their exact cell');
assert.deepEqual(actorOrigin(16, 16, 0.7), { x: 0, y: 0 }, 'small actors keep the legacy anchor');
{
  const origin = actorOrigin(24, 24, 1.5);
  assert.equal(origin.x * 36, 10, 'the 36px boss is shifted left so its centre is the tile centre');
  assert.equal((1 - origin.y) * 36, 16, 'the boss feet land on the cell bottom');
}
// The wide body, not just the artwork, keeps the hero out of the boss.
assert.equal(bodyDistance({ x: 10, y: 10, bodyRadius: 1 }, { x: 12, y: 10 }), 1,
  'a 3x3 body reaches the cell between it and the hero');
assert.equal(bodyDistance({ x: 10, y: 10, bodyRadius: 1 }, { x: 13, y: 10 }), 2,
  'beyond the body the distance is measured normally');
assert.equal(bodyOverlapsAt({ x: 10, y: 10, bodyRadius: 1 }, 11, 11, { x: 12, y: 12 }),
  true, 'two bodies may not be squeezed together');
assert.equal(bodyAtTile({ x: 10, y: 10, type: 'enemy', healthPoints: 5, bodyRadius: 1 }, 9, 9),
  true, 'the body fills the 3x3 footprint');
assert.equal(bodyAtTile({ x: 10, y: 10, type: 'enemy', healthPoints: 5, bodyRadius: 1 }, 8, 10),
  false, 'outside the footprint is free');
const bodyEntities = [
  { x: 10, y: 10, type: 'enemy', healthPoints: 5, bodyRadius: 1 },
  { x: 20, y: 20, type: 'item', healthPoints: 1, bodyRadius: 1 },
];
assert.equal(actorBodyAtTile(bodyEntities, 11, 11), bodyEntities[0]);
assert.equal(actorBodyAtTile(bodyEntities, 19, 19), undefined, 'items never own extra cells');

const bossRect = { x: -10, y: -20, width: 36, height: 36 };
const heroRect = { x: 0, y: -16, width: 16, height: 16 };
assert.equal(occludesPlayer(bossRect, 5, heroRect, 4), true,
  'a front boss covering the hero triggers transparency');
assert.equal(occludesPlayer(bossRect, 3, heroRect, 4), false,
  'a boss behind the hero never fades');
assert.equal(occludesPlayer({ ...bossRect, x: 100 }, 5, heroRect, 4), false,
  'a distant boss does not fade');

// --- Boss artwork: a big, toothy, one-eyed blob -----------------------------
assert.equal(BOSS_TEXTURE_SIZE, 24);
assert.equal(BOSS_PIXELS.length, 24, 'the boss art is 24 rows tall');
assert.ok(BOSS_PIXELS.every(row => row.length === 24), 'the boss art is 24 columns wide');
const drawn = BOSS_PIXELS.join('').replace(/\./g, '');
assert.ok(drawn.length >= 380, `the blob fills most of its frame (${drawn.length}/576 pixels)`);
for (const pixel of new Set(drawn)) {
  assert.equal(typeof BOSS_PALETTE[pixel], 'number', `palette covers '${pixel}'`);
}
// One eye, one pupil, a row of teeth: the three features the art is named for.
assert.ok(drawn.includes('w') && drawn.includes('p'), 'the blob has a visible eye');
const eyeRows = BOSS_PIXELS.filter(row => row.includes('w'));
assert.ok(eyeRows.length >= 8, 'the single eye is huge');
assert.equal(BOSS_PIXELS.join('').split('p').length - 1 >= 10, true, 'one large pupil, not two eyes');
const toothRows = BOSS_PIXELS.filter(row => row.includes('t'));
assert.ok(toothRows.length >= 5, 'the maw is lined with teeth above and below');
assert.ok(BOSS_PALETTE.t !== BOSS_PALETTE.m && BOSS_PALETTE.w !== BOSS_PALETTE.p,
  'teeth read against the maw and the pupil against the sclera');

// --- One-time texture generation --------------------------------------------
{
  const generated = [];
  const writes = [];
  const textures = new Set();
  const graphics = {
    fillStyle() {},
    fillRect(...args) { writes.push(args); },
    destroy() {},
    generateTexture(key, width, height) {
      generated.push({ key, width, height });
      textures.add(key);
    }
  };
  const scene = { textures: { exists: key => textures.has(key) }, make: { graphics: () => graphics } };
  generateBossTexture(scene);
  generateBossTexture(scene);
  assert.deepEqual(generated, [{ key: BOSS_TEXTURE, width: 24, height: 24 }],
    'the boss texture is generated once at full size');
  assert.ok(writes.every(([x, y, w, h]) => x >= 0 && x < 24 && y >= 0 && y < 24 && w === 1 && h === 1));
}

// --- The guardian itself ----------------------------------------------------
const { actionCost } = load('src/games/rogue0/timing.ts');
const { Entity } = load('src/games/rogue0/entity.ts', {
  actionCost,
  sfx: { death() {} },
  actorOriginY: () => 0.5,
  worldDepth: () => 0,
  forgetInspectedEntity: () => {},
  tickStatusEffects: () => {},
  CURSE_NAMES: {},
  CURSE_FLAVOR: {}
});
Entity.prototype.init = function(context, x, y) {
  Object.assign(this, { context, x, y, sprite: undefined });
};
const dungeonStub = { getCurrentLevel: () => Array.from({ length: 9 }, () => Array(9).fill(0)), log() {} };
const Monster = load('src/games/rogue0/monsters/monster.ts', {
  Entity,
  enemyTurn() {},
  enemyCanSeePlayer() {},
  dungeon: dungeonStub,
  Gold: class { constructor() {} },
  stashChasmFallen: () => false,
  Phaser: { Math: { Between: () => 8 } }
}).default;
const Boss = load('src/games/rogue0/monsters/boss.ts', {
  Monster, dungeon: dungeonStub, Gem: class {}, HolyPotion: class {}, PotionOfHealing: class {},
  createCrippledEffect: () => ({ id: 'crippled' }),
  createWeakenedEffect: () => ({ id: 'weakened' }),
  BOSS_TEXTURE, generateBossTexture
});
const { BOSS_ARENA_DORMANCY } = Boss;
{
  const context = { entities: [], messages: [], visibleTiles: new Set(), player: { x: 40, y: 46 } };
  const boss = new Boss.default(context, 40, 30);
  assert.equal(boss.name, 'Bone Lord');
  assert.equal(boss.textureKey, BOSS_TEXTURE, 'the guardian uses the generated blob texture, not the atlas');
  assert.equal(boss.tile, 0);
  assert.equal(boss.sleeping, true, 'the guardian starts asleep');
  assert.equal(boss.sleepTurnsRemaining, BOSS_ARENA_DORMANCY,
    'dormancy outlasts a walk across the arena');
  assert.ok(BOSS_ARENA_DORMANCY >= 100, 'the hero can cross the hall before the blob stirs');
  assert.ok(boss.spriteScale > 1, 'the blob is scaled up beyond the 16px monsters');
  assert.deepEqual(boss.footprint, { width: 3, height: 3, originX: 1, originY: 1 },
    'the scaled guardian owns a centre-anchored 3x3 footprint');
  assert.equal(boss.healthPoints, 60, 'the arena rework keeps the guardian stats');
  boss.takeDamage(1);
  assert.equal(boss.sleeping, false, 'any wound wakes it');
}

// --- Scene wiring -----------------------------------------------------------
{
  const sceneSource = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
  assert.match(sceneSource, /generateBossTexture\(this\)/,
    'resumed boss floors rebuild the generated blob texture');
  assert.match(sceneSource, /this\.bossArena = generated\.bossArena/,
    'the scene keeps the arena centre the map reported');
  assert.match(sceneSource, /const spawn = generated\.spawn \?\?/,
    'the arena decides where the hero enters');
  assert.match(sceneSource, /new Boss\(context, cell\.x, cell\.y\)/,
    'the guardian is placed by the floor spawner');
  assert.match(sceneSource, /occludesPlayer\(sprite\.getBounds\(\), sprite\.depth/,
    'the scene fades a front actor that covers the hero');
  assert.match(sceneSource, /sprite\.setAlpha\(occluding \? Math\.min\(baseAlpha, 0\.45\)/,
    'the hero stays visible underneath a large monster');
}

console.log('Rogue0 boss arena: five distinct per-floor halls (pillared rotunda, long colonnade, octagonal sanctum, cruciform vault, throne hall), sleeping guardian, entrance/exit placement, hidden room, anchoring and blob art passed');
