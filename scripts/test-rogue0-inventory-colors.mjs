import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('inventory-colors');
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';
const { InventoryWindow } = loadLogic('src/games/rogue0/inventoryWindow.ts', { attachTooltip() {} });
function render(item, equipped = false, selected = false) {
  const children = [], tweens = [], icons = [];
  const make = () => Object.assign(new EventEmitter(), {
    setOrigin() { return this; }, setStrokeStyle() { return this; },
    setScale(scale) { this.iconScale = scale; return this; },
    setInteractive() { return this; }, setAlpha(alpha) { this.alpha = alpha; return this; },
  });
  const scene = {
    add: {
      rectangle(x, y, w, h, color) { return Object.assign(make(), { color }); },
      sprite(x, y, key, frame) {
        const icon = Object.assign(make(), { key, frame });
        icons.push(icon);
        return icon;
      },
      text: make,
    },
    tweens: { add(config) {
      const tween = { ...config, remove() { this.removed = true; } };
      tweens.push(tween);
      return tween;
    } },
  };
  const ui = new InventoryWindow(scene, { player: { slotOf: () => equipped ? 'weapon' : undefined } });
  ui.winRoot = { add: child => children.push(child) };
  ui.renderCell(0, 0, item, selected);
  return { children, tweens, icons };
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
// Check rendered output, not the spelling of getter calls in the source.
// Identification must not replace visible floor art with a generic unknown icon.
for (const identified of [false, true]) {
  for (const [key, frame] of [['custom-item', 0], ['tiles', 123]]) {
    const item = Object.freeze({ identified, count: 1, tint: 0xabc123,
      spriteTextureKey: key, spriteFrame: frame, unidentifiedTextureKey: 'wrong-placeholder' });
    const { icons } = render(item);
    assert.equal(icons.length, 1);
    assert.deepEqual([icons[0].key, icons[0].frame, icons[0].tint], [key, frame, item.tint]);
  }
}
console.log('Rogue0 inventory curse colors, hidden status, selection, pulse cleanup and item artwork passed');
