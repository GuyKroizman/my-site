import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function load(path, bindings = {}) {
  const source = fs.readFileSync(path, 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
  const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
  const exports = {};
  new Function('exports', ...Object.keys(bindings), js)(exports, ...Object.values(bindings));
  return exports;
}
const { isModalOpen } = load('src/games/rogue0/context.ts');
const { LogWindow, paginateLogLines } = load('src/games/rogue0/logWindow.ts', { isModalOpen });
assert.deepEqual(paginateLogLines([], 3), ['No messages yet.']);
const lines = Array.from({ length: 83 }, (_, i) => `line ${i}`);
assert.deepEqual(paginateLogLines(lines, 7).join('\n').split('\n'), lines);
assert.equal(paginateLogLines(lines, 0).length, lines.length);

// Minimal rendering double for modal lifecycle, geometry and navigation.
class Node {
  height = 20;
  handlers = {};
  setText(text) { this.text = text; this.height = text.split('\n').length * 22; return this; }
  setPosition(x, y) { this.x = x; this.y = y; return this; }
  setSize(w, h) { this.width = w; this.height = h; return this; }
  setVisible(value) { this.visible = value; return this; }
  getWrappedText(text) { return text.split('\n'); }
  createGeometryMask() { return {}; }
  on(event, fn) { this.handlers[event] = fn; return this; }
}
for (const method of ['setDepth','setOrigin','setInteractive','setStrokeStyle','setLineSpacing',
  'add','setMask','setWordWrapWidth','clear','fillStyle','fillRect','setAlpha','clearMask','destroy']) {
  Node.prototype[method] = function() { return this; };
}
const scene = {
  add: Object.fromEntries(['container','rectangle','text'].map(key => [key, () => new Node()])),
  make: { graphics: () => new Node() },
  scale: { width: 320, height: 480 }, events: { once() {} }
};
const context = { messages: Array.from({length: 20}, (_, i) => `message ${20-i}`), player: { inputBuffer: ['move'], walkPath: [1] } };
const window = new LogWindow(scene, context);
window.open();
assert.ok(isModalOpen(context), 'history pauses gameplay');
assert.deepEqual(context.player.inputBuffer, []);
assert.deepEqual(context.player.walkPath, []);
assert.ok(window.body.text.startsWith('message 20'), 'opens on newest messages');
while (window.page < window.pages.length - 1) window.older.handlers.pointerup();
assert.ok(window.body.text.includes('message 1'), 'oldest retained message is reachable');
window.newer.handlers.pointerup();
assert.equal(window.page, window.pages.length - 2);
scene.scale = { width: 280, height: 240 };
window.layout();
assert.ok(window.panel.width <= 280 && window.panel.height <= 240);
assert.ok(window.page < window.pages.length);
window.close();
assert.ok(!isModalOpen(context));
window.open();
assert.equal(window.page, 0, 'reopening resets to latest');
window.close();
context.inventoryOpen = true;
window.open();
assert.ok(!context.logModalOpen, 'does not stack over inventory');

const effects = load('src/games/rogue0/effects.ts');
const hero = { name: 'Hero', effects: [], context: { messages: [] } };
for (let i = 0; i < 25; i++) effects.applyEffect(hero, { id: `buff-${i}`, name: `Buff ${i}`, duration: 1 });
assert.equal(hero.context.messages.length, 20);
assert.equal(hero.context.messages[0], 'Hero is Buff 24.');
assert.equal(hero.context.messages[19], 'Hero is Buff 5.');
console.log('Rogue0 log pagination, modal lifecycle and 20-message retention passed');
