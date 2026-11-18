import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('floor-item-stack');
import assert from 'node:assert/strict';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
const { floorItemFanOffset, floorItemInset, foregroundEntities, presentFloorItem } = load('src/games/rogue0/rendering.ts');

// A lone item keeps its original artwork position; a pile spreads its sprites
// so the parts the others do not cover remain visible.
assert.deepEqual(floorItemFanOffset(0), { dx: 0, dy: 0 });
const fan = [1, 2, 3].map(i => floorItemFanOffset(i));
assert.equal(new Set(fan.map(p => `${p.dx},${p.dy}`)).size, 3,
  'each stacked item gets a distinct position');
assert.ok(fan.every(p => p.dx >= 0 && p.dx <= 8 && p.dy >= 0 && p.dy <= 8),
  'the fan stays near its own 16px cell');
assert.deepEqual(floorItemFanOffset(4), floorItemFanOffset(0), 'the fan pattern repeats for very large piles');

// The fan is applied on top of the existing half-size artwork inset.
assert.equal(floorItemInset(undefined), 0);
assert.equal(floorItemInset('ration'), 0);
assert.equal(floorItemInset('potion-3'), 4);
assert.equal(floorItemInset('glyph-stone-blink'), 4);
const tiny = { x: 100, y: 200, scale: 1, setScale(value) { this.scale = value; },
  setPosition(x, y) { this.x = x; this.y = y; } };
presentFloorItem(tiny, 'potion-3');
assert.equal(tiny.scale, 0.5, 'half-size artwork is unchanged by the fan helper');
assert.deepEqual([tiny.x, tiny.y], [104, 204], 'centred artwork keeps its inset');

// Every item in an actor-free cell is drawn, while actors still claim a cell.
const a = { type: 'item', x: 2, y: 3 };
const b = { type: 'item', x: 2, y: 3 };
const c = { type: 'item', x: 2, y: 3 };
const monster = { type: 'enemy', x: 5, y: 6 };
assert.deepEqual([...foregroundEntities([a, b, c])], [a, b, c]);
assert.deepEqual([...foregroundEntities([a, b, monster])], [monster, a, b]);
assert.equal(foregroundEntities([monster, { type: 'enemy', x: 5, y: 6 }]).size, 1,
  'two bodies still share only one foreground cell');
assert.equal(foregroundEntities([a, { type: 'item' }]).size, 1,
  'carried items without a tile are not drawn');

console.log('Rogue0 floor item stack: every loot sprite in a pile is visible and fanned inside its cell');
