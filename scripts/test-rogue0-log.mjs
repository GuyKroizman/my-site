import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('log');
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
window.backdrop.handlers.pointerup();
assert.ok(!context.logModalOpen, 'clicking outside closes the log');
window.open();
assert.equal(window.page, 0, 'reopening resets to latest');
window.close();
context.inventoryOpen = true;
window.open();
assert.ok(!context.logModalOpen, 'does not stack over inventory');

const effects = load('src/games/rogue0/effects.ts', { spawnEntityFloatingText() {} });
const hero = { name: 'Hero', type: 'player', effects: [], context: { messages: [], visibleTiles: new Set() } };
for (let i = 0; i < 25; i++) effects.applyEffect(hero, { id: `buff-${i}`, name: `Buff ${i}`, duration: 1 });
assert.equal(hero.context.messages.length, 20);
assert.equal(hero.context.messages[0], 'You are Buff 24.');
assert.equal(hero.context.messages[19], 'You are Buff 5.');
// Player effects use second-person grammar for every hero class.
for (const name of ['Warrior', 'Dwarf', 'Cleric', 'Elf', 'Wizard']) {
  const player = { name, type: 'player', effects: [], healthPoints: 2, maxHealthPoints: 10,
    context: { messages: [], visibleTiles: new Set(), simulationTime: 0 } };
  effects.applyEffect(player, effects.createRegenerationEffect(1));
  effects.applyEffect(player, effects.createRegenerationEffect(1));
  player.context.simulationTime = 1;
  effects.tickEffects(player, player.context);
  assert.equal(player.healthPoints, 3, 'silent regeneration still heals');
  assert.deepEqual(player.context.messages, ['Your Regeneration wears off.', 'You are Regeneration.']);
  effects.applyEffect(player, effects.createBurningEffect(1));
  assert.equal(player.context.messages[0], 'You are Burning.');
}
// Unseen monsters still heal and expire/refresh buffs without filling the log.
const ctx = { messages: [], visibleTiles: new Set(), simulationTime: 0 };
const ghoul = { name: 'Ghoul', type: 'enemy', x: 3, y: 4, effects: [],
  healthPoints: 2, maxHealthPoints: 10, context: ctx };
effects.applyEffect(ghoul, effects.createRegenerationEffect(1));
effects.applyEffect(ghoul, effects.createRegenerationEffect(1));
ctx.simulationTime = 1;
effects.tickEffects(ghoul, ctx);
assert.equal(ghoul.healthPoints, 3);
assert.equal(ghoul.effects.length, 0);
assert.deepEqual(ctx.messages, []);

// Visibility is checked at each event, not only when a buff starts.
ctx.visibleTiles.add('3,4');
effects.applyEffect(ghoul, effects.createRegenerationEffect(2));
effects.applyEffect(ghoul, effects.createRegenerationEffect(2));
ctx.simulationTime = 2;
effects.tickEffects(ghoul, ctx);
assert.deepEqual(ctx.messages, ['Ghoul is Regeneration.']);
ctx.visibleTiles.clear();
ctx.simulationTime = 3;
effects.tickEffects(ghoul, ctx);
assert.equal(ctx.messages.length, 1, 'expiry outside sight is silent');
effects.applyEffect(ghoul, effects.createRegenerationEffect(1));
ctx.visibleTiles.add('3,4');
ctx.simulationTime = 4;
effects.tickEffects(ghoul, ctx);
assert.equal(ctx.messages[0], "Ghoul's Regeneration wears off.");
assert.equal(ghoul.healthPoints, 6);
// Armor reduction is silent: the caller logs the final attack outcome once.
const { resolveAttack } = load('src/games/rogue0/combat.ts', { hasEffect: () => false });
const originalRandom = Math.random;
try {
  Math.random = () => 0.5; // Hit, no critical; no coordinates means no surprise.
  for (const protection of [0, 1, 3]) {
    const combatContext = { messages: [] };
    const result = resolveAttack(combatContext,
      { type: 'enemy', name: 'Skeleton', accuracy: 100, attack: () => 2 },
      { type: 'player', evasion: 0, protection: () => protection, resistance: {}, vulnerability: {} });
    assert.equal(result.hit, true);
    assert.equal(result.damage, Math.max(0, 2 - protection));
    assert.deepEqual(combatContext.messages, [], 'no redundant absorption message');
  }
} finally {
  Math.random = originalRandom;
}
console.log('Rogue0 log pagination, modal lifecycle, retention, effect visibility and silent armor reduction passed');
