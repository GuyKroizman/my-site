import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('wand-factory-floor');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isBossFloor, bossSealsFloor, upgradeScrollsForFloor
} from '../src/games/rogue0/progression.ts';
import {
  bossEncounter, isMawFloor, isWandFactoryFloor, hasLivingHostiles
} from '../src/games/rogue0/bossEncounters.ts';
import {
  generateMap, bossArenaRoom, bossArenaWallTiles, floorIsBossArena
} from '../src/games/rogue0/mapgen.ts';
import { bossArenaLayout } from '../src/games/rogue0/bossArenas.ts';
import { floorMonsterRoster } from '../src/games/rogue0/monsterBalance.ts';

// --- Boss identity ----------------------------------------------------------
assert.equal(isBossFloor(10), true, 'floor 10 is still a boss floor');
assert.equal(floorIsBossArena(10), true, 'single hall generation is unchanged');
for (const floor of [5, 10, 15, 20, 25]) assert.equal(isBossFloor(floor), true);
assert.equal(isWandFactoryFloor(10), true);
assert.equal(isMawFloor(10), false, 'no Writhing Maw guards the factory');
assert.equal(bossEncounter(10).kind, 'wandFactory');
assert.equal(bossEncounter(10).win, 'all-hostiles-cleared');
for (const floor of [5, 15, 20, 25]) {
  assert.equal(bossEncounter(floor).kind, 'maw');
  assert.equal(bossEncounter(floor).win, 'boss-slain');
}
assert.equal(bossEncounter(11), undefined);
assert.equal(upgradeScrollsForFloor(10), 0, 'the supply budget is unchanged');

// --- Layout -----------------------------------------------------------------
assert.equal(bossArenaLayout(10).id, 'factory');
assert.deepEqual(bossArenaRoom(80, 50, 10),
  { x: 32, y: 22, w: 16, h: 16, cx: 40, cy: 30 },
  'the factory reuses floor 5’s 16x16 centred footprint');
const room = bossArenaRoom(80, 50, 10);
const walls = bossArenaWallTiles(room, 10);
const wallTiles = new Set(walls.map(w => `${w.x},${w.y}`));
for (const [lx, ly] of [[1, 2], [2, 3], [13, 2], [14, 3], [1, 12], [2, 13], [13, 12], [14, 13]]) {
  assert.equal(wallTiles.has(`${room.x + lx},${room.y + ly}`), true,
    `factory pillar occupies local ${lx},${ly}`);
}
let span = 0;
for (let x = 3; x < 13; x++) {
  if (!wallTiles.has(`${room.x + x},${room.y + 2}`)) span++;
}
assert.equal(span, 10, 'the hall keeps the rotunda’s ten-tile central span');

const generated = generateMap(10);
assert.equal(generated.rooms.length, 1, 'the factory is one hall, not a room network');
assert.deepEqual(generated.rooms[0], room);
assert.ok(generated.spawn.y > room.y + room.h / 2, 'the hero enters at the south edge');
assert.ok(generated.stairs.x >= room.cx, 'the sealed exit sits to the east');
assert.ok(generated.secretRoom, 'the hidden gem room is still carved');
assert.ok(!generated.features.some(f => f.feature === 'chasm'), 'no chasm splits the factory');
assert.ok(!generated.features.some(f => f.feature === 'trap' && f.trapKind === 'summon'),
  'nothing summons extra enemies into the encounter');

// --- Population -------------------------------------------------------------
const roster = floorMonsterRoster(10);
assert.equal(roster.boss, 0, 'no Writhing Maw');
assert.equal(roster.firePotionThrower, 2);
assert.equal(roster.skeleton, 2);
assert.equal(roster.goblin, 1);
assert.equal(roster.elemental, 2, 'captured fire elements guard the factory');
assert.equal(roster.mimic, 0);
for (const kind of ['frog', 'swarm', 'quloptsh', 'ghoul', 'brute', 'cultist', 'wraith']) {
  assert.equal(roster[kind], 0, `no ${kind} share the factory arena`);
}

// --- Win condition ----------------------------------------------------------
{
  const context = { floor: 10, bossesSlain: new Set(), entities: [] };
  assert.equal(bossSealsFloor(context), true, 'an untouched factory is sealed');
  context.bossesSlain.add(10);
  assert.equal(bossSealsFloor(context), false, 'an empty factory is open');
  context.entities.push({ type: 'enemy', healthPoints: 4 });
  assert.equal(hasLivingHostiles(context), true);
  assert.equal(bossSealsFloor(context), true, 'live hostiles re-seal even a saved-cleared floor');
  context.entities = [{ type: 'item', healthPoints: 4 }, { type: 'enemy', healthPoints: 0 },
    { type: 'enemy', healthPoints: 4, isDecoy: true }];
  assert.equal(hasLivingHostiles(context), false, 'items, corpses and decoys are not hostiles');
}

// --- Scene/save wiring -------------------------------------------------------
const scene = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
assert.match(scene, /spawnGroup\(FirePotionThrower, firePotionThrowerCount\)/);
assert.match(scene, /if \(mawFloor\) \{[\s\S]*new Boss\(/,
  'only Maw floors generate a Writhing Maw');
assert.match(scene, /isMawFloor\(floor\) && !this\.context\.entities\.some\(entity => entity instanceof Boss\)/,
  'the legacy auto-clear guard is Maw-only');
assert.match(scene, /!hasLivingHostiles\(this\.context\)[\s\S]*markFactoryCleared\(\)/,
  'the last factory kill runs its win condition');
assert.match(scene, /factory's security grid/, 'factory-specific seal messages exist');
assert.match(scene, /createWandFactoryVisuals\(/, 'machines are built on setup');
assert.match(scene, /updateTargetTelegraphs\(/, 'red borders are drawn each frame');
const persistence = fs.readFileSync('src/games/rogue0/runPersistence.ts', 'utf8');
assert.match(persistence, /run\.floors\.get\(10\)/, 'legacy floor-10 saves are migrated');

console.log('Wand Factory: boss identity, 16x16 hall, sparse roster, sealed win condition and scene wiring passed');
