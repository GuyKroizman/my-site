import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('cursed-items');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Load real TS logic with imports replaced by injected bindings (see the other
// rogue0 suites). `load` strips every `import ...;` line, so any module-level
// symbol the file needs at runtime must be passed here.
function load(path, bindings = {}) {
  const source = fs.readFileSync(path, 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
  const exports = {};
  new Function('exports', ...Object.keys(bindings), ts.transpile(source, {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }))(exports, ...Object.values(bindings));
  return exports;
}

const curseData = load('src/games/rogue0/curseData.ts');
const { curseEligible, maybeCurse, rollCurseId } = load('src/games/rogue0/curses.ts', {
  CURSE_GENERATION_CHANCE: curseData.CURSE_GENERATION_CHANCE,
  CURSE_TABLES: curseData.CURSE_TABLES,
});
const entityExports = load('src/games/rogue0/entity.ts', {
  ...curseData,
  actionCost: () => 1,
  sfx: { death() {} },
});
const { Entity, removeEntity } = entityExports;
Entity.prototype.init = function (context, x, y) { this.context = context; this.x = x; this.y = y; };

const item = (slot, extra = {}) => Object.assign(new Entity(), {
  type: 'item', equipSlot: slot, cursed: false, curseId: '', identified: true, ...extra,
});

// --- Generation: only weapon/armor/ring are eligible; other slots stay clean.
assert.equal(curseEligible(item('weapon')), true);
assert.equal(curseEligible(item('armor')), true);
assert.equal(curseEligible(item('ring')), true);
assert.equal(curseEligible(item('artifact')), false);
assert.equal(curseEligible(item('consumable')), false);
assert.equal(curseEligible(item('junk')), false);

// Above the generation chance → clean; the random stream is injectable.
assert.equal(maybeCurse(item('armor'), 0.25, () => 0.9), false);
const clean = item('armor');
assert.equal(maybeCurse(clean, 0.25, () => 0.9), false);
assert.equal(clean.cursed, false);
assert.equal(clean.curseId, '');

// Below the chance → cursed with a valid armor curse.
let calls = 0;
const cursed = item('armor');
const stream = () => (calls++ === 0 ? 0.1 : 0); // cursed?, then first table entry
assert.equal(maybeCurse(cursed, 0.25, stream), true);
assert.equal(cursed.cursed, true);
assert.ok(curseData.CURSE_TABLES.armor.includes(cursed.curseId));

// Deterministic roll: () => 0 always yields the first armor curse.
const displacement = item('armor');
assert.equal(maybeCurse(displacement, 0.25, () => 0), true);
assert.equal(displacement.curseId, 'displacement');

// Weapons/rings currently have empty tables, so they are never generated
// cursed (a locked slot must always carry an observable penalty).
assert.equal(rollCurseId(item('weapon'), () => 0), null);
assert.equal(rollCurseId(item('ring'), () => 0), null);
assert.equal(maybeCurse(item('weapon'), 1, () => 0), false);
assert.equal(maybeCurse(item('ring'), 1, () => 0), false);

// Already-cursed items never reroll.
const pre = item('armor', { cursed: true, curseId: 'multiplicity' });
assert.equal(maybeCurse(pre, 0.25, () => 0), false);
assert.equal(pre.curseId, 'multiplicity');

// --- Descriptions: a named curse is revealed only once identified.
assert.match(displacement.displayDescription, /Displacement: When you are attacked/);
assert.match(displacement.displayDescription, /cannot be removed while equipped/);
const secret = item('armor', { cursed: true, curseId: 'multiplicity', identified: false });
assert.equal(secret.curseDescription, '');
assert.doesNotMatch(secret.displayDescription, /Multiplicity/);
secret.identified = true;
assert.match(secret.displayDescription, /Multiplicity: When you are attacked/);

// --- Mirror image decoy: friendly, inert, ephemeral, no rewards.
const MirrorImage = load('src/games/rogue0/monsters/mirrorImage.ts', { Entity, removeEntity }).default;
const heroLike = Object.assign(new Entity(), { tile: 26, textureKey: 'hero-color', tint: 0xffeecc });
const ctx = { entities: [], messages: [], visibleTiles: new Set() };
const image = new MirrorImage(ctx, 2, 3, heroLike);
assert.equal(image.type, 'enemy');
assert.equal(image.isDecoy, true);
assert.equal(image.name, 'Mirror Image');
assert.equal(image.healthPoints, 1);
assert.equal(image.tile, 26);
assert.equal(image.textureKey, 'hero-color');
assert.equal(image.tint, 0xffeecc);
assert.equal(image.attack(), 0);
assert.equal(image.protection(), 0);
image.turn(); // waits, never moves
assert.equal(image.nextActionTime, 1);
const before = image.nextActionTime;
for (let i = 0; i < 9 && ctx.entities.includes(image); i++) image.refresh();
assert.ok(!ctx.entities.includes(image), 'mirror images fade on their own');
assert.equal(image.nextActionTime, before, 'fading spends no action');

// --- Armor curse proc: Displacement teleports; Multiplicity spawns a decoy.
const tiles = { isBlocking: () => false };
const dungeon = load('src/games/rogue0/dungeon.ts', {
  PF: { Grid: class {}, DiagonalMovement: { Always: 0 }, AStarFinder: class {} },
  bresenhamLine: () => [],
  hasEffect: () => false,
  tiles,
  MirrorImage,
  CURSE_PROC_CHANCE: curseData.CURSE_PROC_CHANCE,
  removeEntity,
}).default;

function procContext(player) {
  dungeon.currentLevel = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  return {
    entities: [],
    messages: [],
    player,
    map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 },
    visibleTiles: new Set(),
  };
}
const victim = Object.assign(new Entity(), {
  type: 'player', x: 1, y: 1, walkPath: [1], inputBuffer: ['x'],
  sprite: { setPosition() {} },
});
const armor = item('armor', { cursed: true, curseId: 'displacement' });
victim.armor = armor;

// No proc when the random roll misses the chance.
const originalRandom = Math.random;
Math.random = () => 0.9;
dungeon.procArmorCurse(procContext(victim), victim);
assert.equal(victim.x, 1, 'missed roll leaves the hero in place');
assert.equal(victim.y, 1);

// Displacement moves the hero to a walkable tile and clears buffered input.
Math.random = () => 0;
dungeon.procArmorCurse(procContext(victim), victim);
assert.notDeepEqual([victim.x, victim.y], [1, 1], 'displacement teleports the hero');
assert.deepEqual(victim.walkPath, [], 'teleport cancels auto-walk');
assert.deepEqual(victim.inputBuffer, [], 'teleport clears buffered commands');

// Multiplicity spawns a mirror image on an adjacent empty tile.
armor.curseId = 'multiplicity';
const multiContext = procContext(victim);
victim.x = 1; victim.y = 1;
Math.random = () => 0;
dungeon.procArmorCurse(multiContext, victim);
const decoy = multiContext.entities.find(e => e.isDecoy);
assert.ok(decoy, 'multiplicity summons a mirror image');
assert.ok(Math.max(Math.abs(decoy.x - 1), Math.abs(decoy.y - 1)) === 1, 'decoy spawns adjacent');
assert.equal(decoy.type, 'enemy');

// Un-cursed armor (or no armor) never procs.
Math.random = () => 0;
armor.cursed = false;
const noProc = procContext(victim);
victim.x = 1; victim.y = 1;
dungeon.procArmorCurse(noProc, victim);
assert.equal(noProc.entities.length, 0);
assert.deepEqual([victim.x, victim.y], [1, 1]);

Math.random = originalRandom;

// --- Save/load preserves curseId and isDecoy through the object graph codec.
const { encodeGraph, decodeGraph } = load('src/games/rogue0/saveCodec.ts');
const roundTrip = decodeGraph(
  JSON.parse(JSON.stringify(encodeGraph({ armor: displacement, img: image }, { Entity, MirrorImage }))),
  { Entity, MirrorImage }
);
assert.equal(roundTrip.armor.curseId, 'displacement');
assert.equal(roundTrip.armor.cursed, true);
assert.equal(roundTrip.img.isDecoy, true);
assert.equal(roundTrip.img.name, 'Mirror Image');

console.log('Rogue0 cursed items: eligibility, deterministic generation, named descriptions, secrecy, mirror-image decoy, Displacement/Multiplicity procs, and save round-trip passed');
