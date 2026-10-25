import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('inventory-colors');
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync('src/games/rogue0/inventoryWindow.ts', 'utf8').replace(/^import.*;$/gm, '');
const exports = {};
new Function('exports', 'attachTooltip', ts.transpile(source, {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
}))(exports, () => {});
function render(item, equipped = false, selected = false) {
  const children = [], tweens = [];
  const make = () => Object.assign(new EventEmitter(), {
    setOrigin() { return this; }, setStrokeStyle() { return this; },
    setInteractive() { return this; }, setAlpha(alpha) { this.alpha = alpha; return this; },
  });
  const scene = {
    add: {
      rectangle(x, y, w, h, color) { return Object.assign(make(), { color }); },
      sprite: make, text: make,
    },
    tweens: { add(config) {
      const tween = { ...config, remove() { this.removed = true; } };
      tweens.push(tween);
      return tween;
    } },
  };
  const ui = new exports.InventoryWindow(scene, { player: { slotOf: () => equipped ? 'weapon' : undefined } });
  ui.winRoot = { add: child => children.push(child) };
  ui.renderCell(0, 0, item, selected);
  return { children, tweens };
}
const item = { identified: false, cursed: false, count: 1 };
const unknown = render(item);
assert.equal(unknown.children[0].color, 0x352c22);
assert.equal(render({ ...item, cursed: true }).children[0].color, unknown.children[0].color);
assert.equal(render({ ...item, cursed: true }).tweens.length, 0);
assert.equal(render({ ...item, identified: true }).children[0].color, 0x102846);
assert.equal(render(item, true).children[0].color, 0x102846);
for (const selected of [false, true]) {
  const cursed = render({ ...item, identified: true, cursed: true }, false, selected);
  assert.equal(cursed.children[0].color, 0x49151c);
  assert.equal(cursed.tweens.length, 1);
  assert.equal(cursed.tweens[0].yoyo, true);
  assert.equal(cursed.tweens[0].repeat, -1);
  assert.equal(cursed.tweens[0].targets, cursed.children[1]);
  cursed.children[1].emit('destroy');
  assert.equal(cursed.tweens[0].removed, true);
}
assert.equal(render({ ...item, cursed: true }, true).tweens.length, 1);
assert.equal(render(undefined).children[0].color, 0x16121c);
console.log('Rogue0 inventory curse colors, hidden status, selection and pulse cleanup passed');
