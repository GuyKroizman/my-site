import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('wand-projectiles');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync('src/games/rogue0/wandZapVisuals.ts', 'utf8').replace(/^import.*;\n/gm, '');
const exports = {};
new Function('exports', ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }))(exports);
const { showWandZap, updateWandZaps, clearWandZaps } = exports;
const graphics = [];
const scene = { time: { now: 0 }, add: { graphics() {
  const g = { rects: [], setDepth(depth) { this.depth = depth; return this; },
    clear() { this.rects = []; return this; },
    fillStyle(color, alpha) { this.color = color; this.alpha = alpha; return this; },
    fillRect(x, y, w, h) { this.rects.push({ x, y, w, h, color: this.color, alpha: this.alpha }); return this; },
    destroy() { this.destroyed = true; } };
  graphics.push(g); return g;
} } };
const context = { visibleTiles: new Set(Array.from({ length: 20 }, (_, x) => `${x},1`)), simulationTime: 3.5 };
const random = Math.random;
try {
  Math.random = () => { throw Error('projectiles cannot consume gameplay randomness'); };
  const palettes = [];
  for (const damageType of ['fire', 'ice', 'shock']) {
    showWandZap(scene, context, { fromX: 1, fromY: 1, toX: 10, toY: 1, damageType });
    const g = graphics.at(-1);
    assert.equal(g.depth, 98, 'projectiles are below fog');
    const start = Math.max(...g.rects.map(r => r.x));
    updateWandZaps(scene, context, 160, false);
    assert.ok(Math.max(...g.rects.map(r => r.x)) > start, 'bolt travels toward its destination');
    palettes.push(g.rects.map(r => r.color));
    const held = structuredClone(g.rects);
    updateWandZaps(scene, context, 5000, true);
    assert.deepEqual(g.rects, held, 'modal pauses presentation without losing projectile');
    context.visibleTiles.clear();
    updateWandZaps(scene, context, 5000, true);
    assert.equal(g.rects.length, 0, 'no trails or impacts reveal hidden areas');
    context.visibleTiles.add('10,1');
    updateWandZaps(scene, context, 5200, false);
    assert.ok(g.rects.length > 0, 'impact flash at destination');
    for (const r of g.rects) {
      assert.ok(r.x >= 160 && r.y >= 16 && r.x + r.w <= 176 && r.y + r.h <= 32, 'impact clipped to visible tiles');
    }
    updateWandZaps(scene, context, 6000, false);
    assert.equal(g.destroyed, true);
    context.visibleTiles = new Set(Array.from({ length: 20 }, (_, x) => `${x},1`));
  }
  assert.notDeepEqual(palettes[0], palettes[1]);
  assert.notDeepEqual(palettes[1], palettes[2]);
  assert.equal(context.simulationTime, 3.5);
  showWandZap(scene, context, { fromX: 1, fromY: 1, toX: 1, toY: 1, damageType: 'ice' });
  assert.ok(graphics.at(-1).rects.every(r => Number.isFinite(r.x) && Number.isFinite(r.y)), 'self-target has no NaN positions');
  clearWandZaps(scene); clearWandZaps(scene);
  assert.equal(graphics.at(-1).destroyed, true, 'floor/shutdown cleanup is idempotent');
} finally { Math.random = random; }
console.log('Rogue0 wand projectiles: elemental trails, travel, impact, FOV clipping, modal pause and lifecycle passed');
