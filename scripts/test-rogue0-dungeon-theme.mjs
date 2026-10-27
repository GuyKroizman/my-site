import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('dungeon-theme');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const exports = {};
new Function('exports', ts.transpile(fs.readFileSync('src/games/rogue0/dungeonTheme.ts', 'utf8'), {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
}))(exports);
const expected = [
  ...Array(4).fill('stone'), ...Array(5).fill('crypt'),
  ...Array(5).fill('sandstone'), ...Array(5).fill('crystal'),
  ...Array(6).fill('volcanic'),
];
// Every floor in both directions, including each region boundary and revisits.
const floors = Array.from({ length: 25 }, (_, i) => i + 1);
for (const floor of [...floors, ...floors.toReversed(), 0, 26]) {
  const prefix = expected[floor - 1] ?? 'stone';
  assert.deepEqual(exports.dungeonTheme(floor), { tiles: `${prefix}-tiles`, wall: `${prefix}-wall` });
  for (const name of [`${prefix}-tiles`, `${prefix}-wall`]) {
    assert.ok(fs.existsSync(`public/rogue0/${name}.png`));
  }
}
const dungeon = fs.readFileSync('src/games/rogue0/dungeon.ts', 'utf8');
const scene = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
assert.ok(dungeon.includes('dungeonTheme(context.floor).tiles'));
assert.ok(scene.includes('dungeonTheme(this.context.floor).wall'));
for (const theme of ['crypt', 'sandstone', 'crystal', 'volcanic']) {
  assert.ok(scene.includes(`this.load.image('${theme}-tiles', ${theme}TilesUrl)`));
  assert.ok(scene.includes(`this.load.image('${theme}-wall', ${theme}WallUrl)`));
  // PNG dimensions must preserve the atlas layout and 16px raised wall size.
  for (const part of ['tiles', 'wall']) {
    const image = fs.readFileSync(`public/rogue0/${theme}-${part}.png`);
    const original = fs.readFileSync(`public/rogue0/stone-${part}.png`);
    assert.deepEqual(image.subarray(16, 24), original.subarray(16, 24));
    assert.notDeepEqual(image, original);
  }
}
console.log('Dungeon themes: all 25 floors, region boundaries, revisits, atlas sizes and both render paths passed');
