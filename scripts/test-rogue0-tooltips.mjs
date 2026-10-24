import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('tooltips');
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync('src/games/rogue0/tooltip.ts', 'utf8').replace(/^import.*;$/gm, '');
const exports = {};
new Function('exports', 'isModalOpen', 'Phaser', ts.transpile(source, {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
}))(exports, context => context.inventoryOpen, {
  Math: { Clamp: (n, min, max) => Math.max(min, Math.min(max, n)) },
});
const text = {
  width: 80, height: 28, visible: false,
  setDepth() { return this; }, setVisible(v) { this.visible = v; return this; },
  setWordWrapWidth() {}, setText(v) { this.label = v; },
  setPosition() { return this; }, destroy() { this.destroyed = true; },
};
let timer;
const scene = {
  add: { text: () => text }, events: new EventEmitter(),
  scale: Object.assign(new EventEmitter(), { width: 320, height: 640 }),
  time: { delayedCall(delay, callback) {
    timer = { delay, callback, remove() { this.cancelled = true; } }; return timer;
  } },
};
const target = Object.assign(new EventEmitter(), {
  getBounds: () => ({ centerX: 100, top: 100, bottom: 138 }),
});
let open = true;
exports.attachTooltip(scene, { inventoryOpen: true }, target, () => 'Wand', () => open);
target.emit('pointerover');
assert.equal(timer.delay, 2000);
assert.equal(text.visible, false);
timer.callback();
assert.equal(text.visible, true);
assert.equal(text.label, 'Wand');
target.emit('pointerout');
assert.equal(text.visible, false);
target.emit('pointerover');
target.emit('pointerdown');
assert.equal(timer.cancelled, true);
target.emit('pointerover');
open = false;
scene.events.emit('update');
assert.equal(timer.cancelled, true);
assert.equal(text.visible, false);
target.emit('destroy');
assert.equal(text.destroyed, true);
assert.equal(scene.events.listenerCount('update'), 0);
assert.equal(scene.events.listenerCount('shutdown'), 0);
assert.equal(scene.scale.listenerCount('resize'), 0);
console.log('Rogue0 inventory tooltip delay, names, cancellation and cleanup passed');
