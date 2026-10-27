import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('dungeon-theme');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const exports = {};
new Function('exports', ts.transpile(fs.readFileSync('src/games/rogue0/dungeonTheme.ts', 'utf8'), {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
}))(exports);
// Exercise entering, returning from, and leaving the themed floors.
for (const floor of [1, 4, 5, 6, 7, 8, 9, 10, 11, 10, 5, 4]) {
  const prefix = floor >= 5 && floor <= 10 ? 'crypt' : 'stone';
  assert.deepEqual(exports.dungeonTheme(floor), { tiles: `${prefix}-tiles`, wall: `${prefix}-wall` });
  for (const name of [`${prefix}-tiles`, `${prefix}-wall`]) {
    assert.ok(fs.existsSync(`public/rogue0/${name}.png`));
  }
}
const dungeon = fs.readFileSync('src/games/rogue0/dungeon.ts', 'utf8');
const scene = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
assert.ok(dungeon.includes('dungeonTheme(context.floor).tiles'));
assert.ok(scene.includes('dungeonTheme(this.context.floor).wall'));
assert.ok(scene.includes("this.load.image('crypt-tiles', cryptTilesUrl)"));
assert.ok(scene.includes("this.load.image('crypt-wall', cryptWallUrl)"));
console.log('Dungeon themes: inclusive floors 5–10, return transitions, assets and both render paths passed');
