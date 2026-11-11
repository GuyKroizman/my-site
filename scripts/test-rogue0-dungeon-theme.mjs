import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('dungeon-theme');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dungeonTheme, WALL_TILE } from '../src/games/rogue0/dungeonTheme.ts';
const expected = [
  ...Array(4).fill('stone'), ...Array(5).fill('crypt'),
  ...Array(5).fill('sandstone'), ...Array(5).fill('crystal'),
  ...Array(6).fill('volcanic'),
];
// Each floor and both out-of-range fallbacks. This pure lookup has no revisit
// state; repeating the same assertions in reverse adds no coverage.
const floors = Array.from({ length: 25 }, (_, i) => i + 1);
for (const floor of [...floors, 0, 26]) {
  const prefix = expected[floor - 1] ?? 'stone';
  assert.deepEqual(dungeonTheme(floor), { tiles: `${prefix}-tiles`, wallFrame: WALL_TILE });
  assert.ok(fs.existsSync(`src/games/rogue0/assets/${prefix}-tiles.png`));
  // Floor and wall live in one sheet per theme; a second wall PNG is the
  // duplicate this layout was collapsed from.
  assert.ok(!fs.existsSync(`src/games/rogue0/assets/${prefix}-wall.png`));
}
const dungeon = fs.readFileSync('src/games/rogue0/dungeon.ts', 'utf8');
const scene = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
assert.ok(dungeon.includes('const theme = dungeonTheme(context.floor)'));
assert.ok(dungeon.includes('theme.tiles,') && dungeon.includes('theme.wallFrame'),
  'the tilemap and the wall tiles read the same theme sheet');
// scene0 derives one theme per sync and uses it for raised wall faces + decals.
assert.ok(scene.includes('const theme = dungeonThemeName(this.context.floor)'));
assert.ok(scene.includes('this.add.sprite(x * 16, y * 16, `${theme}-tiles`, WALL_TILE)'),
  'raised walls reuse the theme sheet instead of a second wall PNG');
assert.ok(scene.includes('this.syncWallDecal(key, x, y, theme, raised)'));
for (const theme of ['stone', 'crypt', 'sandstone', 'crystal', 'volcanic']) {
  assert.ok(scene.includes(`this.load.spritesheet('${theme}-tiles', ${theme}TilesUrl, THEME_SHEET)`));
  // All five sheets share one layout, so the shared wall frame index is valid.
  const image = fs.readFileSync(`src/games/rogue0/assets/${theme}-tiles.png`);
  assert.deepEqual(image.subarray(16, 24), fs.readFileSync('src/games/rogue0/assets/stone-tiles.png').subarray(16, 24));
}
// Every sheet is a 16px grid with 1px spacing, which is what makes the
// spritesheet frame index equal the tilemap tile index.
assert.ok(scene.includes('frameWidth: 16, frameHeight: 16, spacing: 1'));
const sheetWidth = fs.readFileSync('src/games/rogue0/assets/stone-tiles.png').readUInt32BE(16);
const sheetHeight = fs.readFileSync('src/games/rogue0/assets/stone-tiles.png').readUInt32BE(20);
const columns = Math.floor((sheetWidth + 1) / 17);
const rows = Math.floor((sheetHeight + 1) / 17);
assert.ok(WALL_TILE < columns * rows, `wall frame ${WALL_TILE} must exist in a ${columns}x${rows} sheet`);
assert.notEqual(WALL_TILE, 0, 'the wall face cannot share the floor tile');
console.log('Dungeon themes: all 25 floors, region boundaries, fallbacks, atlas sizes and render wiring smoke checks passed');
