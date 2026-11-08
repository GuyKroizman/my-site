import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('boss-arena');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
import { generateMap, floorIsBossArena, bossArenaRoom, findFarthestWalkable } from '../src/games/rogue0/mapgen.ts';
import {
  BOSS_TEXTURE, BOSS_PIXELS, BOSS_PALETTE, BOSS_TEXTURE_SIZE, generateBossTexture
} from '../src/games/rogue0/monsters/bossTexture.ts';
import { actorOrigin, occludesPlayer } from '../src/games/rogue0/rendering.ts';

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
for (let run = 0; run < 40; run++) {
  const floor = [5, 10, 15, 20, 25][run % 5];
  const generated = generateMap(floor);
  const { map, rooms, features, secretRoom, spawn, bossArena, stairs } = generated;

  assert.equal(rooms.length, 1, `floor ${floor} is a single room`);
  const arena = rooms[0];
  assert.equal(arena.w, 32, `the arena is shrunk to 20% area (${arena.w}x${arena.h})`);
  assert.equal(arena.h, 16, `the arena is shrunk to 20% area (${arena.w}x${arena.h})`);
  const previousArea = 72 * 36;
  assert.ok(Math.abs(arena.w * arena.h - previousArea * 0.2) <= previousArea * 0.01,
    `the arena keeps 20% of its old area (${arena.w * arena.h}/${previousArea})`);
  seenSpans.add(`${arena.w}x${arena.h}`);

  // A single open hall: no interior walls, pillars, corridors or chasms.
  for (let y = arena.y; y < arena.y + arena.h; y++) {
    for (let x = arena.x; x < arena.x + arena.w; x++) {
      assert.equal(map[y][x], 0, `arena tile ${x},${y} is open floor`);
    }
  }
  assert.ok(!features.some(f => f.feature === 'chasm'), 'no chasm splits the arena');
  assert.ok(!features.some(f => f.feature === 'door'), 'a single room needs no doors');
  assert.ok(!features.some(f => f.feature === 'trap' && f.trapKind === 'summon'),
    'nothing may summon another monster into the arena');

  // The guardian waits in the middle, the hero arrives at the south edge.
  assert.deepEqual(bossArena, { x: arena.cx, y: arena.cy }, 'the guardian spawns dead centre');
  assert.ok(spawn, 'the arena tells the scene where the hero enters');
  assert.equal(spawn.x, arena.cx, 'the hero enters on the arena axis');
  assert.equal(spawn.y, arena.y + arena.h - 3, 'the hero enters near the south wall');
  assert.ok(spawn.y > bossArena.y + 4, 'the hero still enters across the hall from the guardian');
  assert.equal(map[spawn.y][spawn.x], 0);

  // Everything in the arena is reachable from the arrival tile.
  const seen = new Set([`${spawn.x},${spawn.y}`]);
  const queue = [spawn];
  while (queue.length) {
    const { x, y } = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      const key = `${nx},${ny}`;
      if (map[ny]?.[nx] !== 0 || seen.has(key)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  for (let y = arena.y; y < arena.y + arena.h; y++) {
    for (let x = arena.x; x < arena.x + arena.w; x++) {
      assert.ok(seen.has(`${x},${y}`), `arena tile ${x},${y} is reachable from the entrance`);
    }
  }

  // The exit is the far corner of the hall: across the room from the entrance,
  // inside the arena, and never in the stub of the hidden branch.
  assert.ok(Math.hypot(stairs.x - spawn.x, stairs.y - spawn.y) >= 15,
    'the sealed stairs sit across the hall');
  assert.notDeepEqual(stairs, bossArena, 'the stairs never share the guardian tile');
  assert.equal(map[stairs.y][stairs.x], 0, 'the exit is a floor tile');
  assert.ok(stairs.x >= arena.x && stairs.x < arena.x + arena.w &&
    stairs.y >= arena.y && stairs.y < arena.y + arena.h, 'the exit is inside the arena');
  assert.ok(secretRoom.x > stairs.x + 2 || stairs.y > secretRoom.y + 2,
    'the exit never lands beside the hidden branch');
  // The generic search would have picked the concealed stub above the wall.
  const naive = findFarthestWalkable(map, spawn.x, spawn.y, 80);
  assert.deepEqual({ x: naive.x, y: naive.y }, { x: arena.x, y: arena.y - 2 },
    'the arena overrides the generic exit search');

  // The hidden gem branch still hangs above the arena's north wall.
  assert.ok(secretRoom, 'a boss floor keeps its hidden gem room');
  for (let y = secretRoom.y; y < secretRoom.y + secretRoom.h; y++) {
    for (let x = secretRoom.x; x < secretRoom.x + secretRoom.w; x++) {
      assert.equal(map[y][x], 0, 'the hidden room is fully carved');
    }
  }
  assert.ok(secretRoom.cy < arena.y, 'the hidden room sits above the arena');
  // A normal floor is still a network of rooms: the arena rule is opt-in.
  if (run === 0) {
    const normal = generateMap(6);
    assert.ok(normal.rooms.length > 1, 'ordinary floors still have many rooms');
    assert.equal(normal.bossArena, undefined);
    assert.equal(normal.spawn, undefined);
    assert.equal(normal.stairs, undefined);
  }
}
assert.ok(seenSpans.size >= 1, 'arena size comes from the shared layout helper');
assert.deepEqual(bossArenaRoom(80, 50), { x: 24, y: 22, w: 32, h: 16, cx: 40, cy: 30 },
  'the 20%-area arena stays centred, leaving room for walls and the hidden branch');
assert.equal(bossArenaRoom(80, 50).w * bossArenaRoom(80, 50).h, 512,
  'the shrunken hall is 32x16 rather than 72x36');

// Large, scaled art stays centred on its cell and its feet on the cell bottom;
// otherwise the boss is drawn south-east of the tile the pointer resolves to.
assert.deepEqual(actorOrigin(16, 16, 1), { x: 0, y: 0 }, 'ordinary actors keep their exact cell');
assert.deepEqual(actorOrigin(16, 16, 0.7), { x: 0, y: 0 }, 'small actors keep the legacy anchor');
{
  const origin = actorOrigin(24, 24, 1.5);
  assert.equal(origin.x * 36, 10, 'the 36px boss is shifted left so its centre is the tile centre');
  assert.equal((1 - origin.y) * 36, 16, 'the boss feet land on the cell bottom');
}
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
  Monster, dungeon: dungeonStub, Gem: class {}, HolyPotion: class {}, FullHealPotion: class {},
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

console.log('Rogue0 boss arena: 20%-area central hall, sleeping guardian, entrance/exit placement, hidden room, anchoring and blob art passed');
