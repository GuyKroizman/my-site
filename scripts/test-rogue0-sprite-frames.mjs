import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('sprite-frames');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Sheet, SHEET_COLUMNS, SHEET_ROWS, sheetFrame } from '../src/games/rogue0/spriteFrames.ts';

// The numbering must match the sheet the game actually loads. Frames are
// row-major over a 16px grid with 1px spacing, so the image is
// columns * 17 - 1 across and rows * 17 - 1 down.
const png = fs.readFileSync('public/colored.png');
assert.equal(png.readUInt32BE(16), SHEET_COLUMNS * 17 - 1, 'sheet width matches SHEET_COLUMNS');
assert.equal(png.readUInt32BE(20), SHEET_ROWS * 17 - 1, 'sheet height matches SHEET_ROWS');

assert.equal(sheetFrame(0, 0), 0);
assert.equal(sheetFrame(1, 0), 1, 'columns advance the index by one');
assert.equal(sheetFrame(0, 1), SHEET_COLUMNS, 'rows advance the index by one sheet row');
assert.equal(sheetFrame(SHEET_COLUMNS - 1, SHEET_ROWS - 1), SHEET_COLUMNS * SHEET_ROWS - 1, 'last cell');

// Pinned indices. These are the numbers the old `row * 49 + col` call sites
// produced; entity frames are saved and drawn by index, so a rename must never
// renumber one. Update this table deliberately, never to make a test pass.
const LEGACY_FRAMES = {
  doorClosed: 150,
  doorOpen: 301,
  grass: 7,
  water: 206,
  elf: 77,
  wizard: 73,
  cleric: 122,
  dwarf: 470,
  heroFallback: 26,
  ghoul: 320,
  brute: 322,
  skeleton: 323,
  quloptsh: 324,
  dagger: 328,
  longSword: 329,
  hammer: 380,
  axe: 382,
  shield: 776,
  shoe: 963,
  chest: 302,
  gem: 219,
  cursedGem: 218,
  ration: 720,
  ringOfAccuracy: 220,
  ringOfEvasion: 221,
  ringOfElements: 222,
  ringOfHaste: 223,
  ringOfMight: 224,
  berserkPotion: 670,
  potionOfHealing: 675,
  potionOfStrength: 676,
  potionOfInvisibility: 677,
  potionOfToxicGas: 678,
  potionOfLiquidFlame: 679,
  potionOfFrost: 680,
  potionOfLevitation: 681,
  potionOfExperience: 682,
  scrollOfFireball: 768,
  scrollOfLightning: 769,
  scrollOfIdentify: 770,
  scrollOfUpgrade: 771,
  scrollOfRemoveCurse: 772,
  scrollOfTeleport: 773,
  scrollOfRage: 774,
  scrollOfTerror: 775,
  scrollOfRecharging: 776,
  wandOfFirebolt: 777,
  wandOfFrost: 778,
  wandOfLightning: 779,
  flameProjectile: 505,
  frostProjectile: 508,
  lightningProjectile: 509,
  lightningBolt: 413,
  goblinRangedAttack: 505,
  defaultAttack: 550
};
assert.deepEqual(Sheet, LEGACY_FRAMES, 'named frames keep their original indices');
for (const [name, frame] of Object.entries(Sheet)) {
  assert.ok(Number.isInteger(frame) && frame >= 0 && frame < SHEET_COLUMNS * SHEET_ROWS,
    `${name} (${frame}) lands inside the sheet`);
}

// The row/column arithmetic lives here and nowhere else, so the sheet layout
// can change in one place.
const root = 'src/games/rogue0';
const offenders = [];
for (const entry of fs.readdirSync(root, { recursive: true })) {
  if (typeof entry !== 'string' || !entry.endsWith('.ts') || entry.endsWith('spriteFrames.ts')) continue;
  const source = fs.readFileSync(`${root}/${entry}`, 'utf8');
  if (/\*\s*49\b/.test(source) || /\b49\s*\+/.test(source)) offenders.push(entry);
}
assert.deepEqual(offenders, [], 'no module hand-rolls the sheet arithmetic');

console.log(`Sprite frames: ${Object.keys(Sheet).length} named frames, ${SHEET_COLUMNS}x${SHEET_ROWS} sheet, legacy indices pinned, no stray arithmetic passed`);
