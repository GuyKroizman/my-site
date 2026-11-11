import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('monster-art');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';

const { Entity } = load('src/games/rogue0/entity.ts');
// Capture the constructor boundary without a renderer or randomized sleep.
class Monster extends Entity {
  constructor(context, config, x, y) {
    super();
    Object.assign(this, config, { context, x, y });
  }
}
const BerserkPotion = class {};
const Shoe = class {};
const scene = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
const cases = [
  ['ghoul', { healthPoints: 12, movementSpeed: 2, attackDamage: 2, evasion: 0, xp: 5 },
    [false, false, false, false]],
  ['brute', { healthPoints: 36, movementSpeed: 1, attackDamage: 6, evasion: 0, xp: 10 },
    [false, false, false, BerserkPotion]],
  ['quloptsh', { healthPoints: 12, movementSpeed: 1, attackDamage: 2, evasion: 40, xp: 4 },
    [false, Shoe]],
];
const images = [];
for (const [name, stats, loot] of cases) {
  const Class = load(`src/games/rogue0/monsters/${name}.ts`, { Monster, BerserkPotion, Shoe }).default;
  const context = {};
  const monster = new Class(context, 4, 6);
  assert.equal(monster.spriteTextureKey, name, `${name} uses its dedicated PNG`);
  assert.equal(monster.spriteFrame, 0);
  assert.equal(monster.tile, 0);
  assert.equal(monster.context, context);
  assert.equal(monster.x, 4);
  assert.equal(monster.y, 6);
  for (const [stat, value] of Object.entries(stats)) assert.equal(monster[stat], value, `${name}: unchanged ${stat}`);
  assert.deepEqual(monster.loot, loot);
  assert.ok(scene.includes(`import ${name}ArtUrl from './assets/monsters/${name}.png'`));
  assert.ok(scene.includes(`this.load.image('${name}', ${name}ArtUrl)`));
  const png = fs.readFileSync(`src/games/rogue0/assets/monsters/${name}.png`);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 16);
  assert.equal(png.readUInt32BE(20), 22);
  assert.equal(png[24], 8, '8-bit pixels');
  assert.equal(png[25], 6, 'RGBA supports a transparent silhouette');
  for (const other of images) assert.notDeepEqual(png, other, 'each monster has distinct artwork');
  images.push(png);
}
console.log('Monster art: three dedicated RGBA sprites, scene loading, frame selection, unchanged constructor stats and loot passed');
