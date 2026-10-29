import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('grass-fire');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync('src/games/rogue0/grassBurnVisuals.ts', 'utf8').replace(/^import.*;\n/gm, '');
const exports = {};
new Function('exports', 'actorOriginY', 'worldDepth', ts.transpile(source, {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
}))(exports, () => 0.8, () => 1);
const { showGrassBurn, updateGrassBurns, clearGrassBurns } = exports;
const sprites = [], graphics = [];
const scene = { time: { now: 0 }, add: {
  sprite() {
    const sprite = { visible: true, destroyed: false, setOrigin() { return this; }, setDepth() { return this; },
      setVisible(v) { this.visible = v; return this; }, setTint(t) { this.tint = t; return this; },
      setAlpha(a) { this.alpha = a; return this; }, setScale() { return this; }, destroy() { this.destroyed = true; } };
    sprites.push(sprite); return sprite;
  },
  graphics() {
    const g = { rects: [], setDepth(d) { this.depth = d; return this; },
      clear() { this.rects = []; return this; }, fillStyle() { return this; },
      fillRect(...args) { this.rects.push(args); return this; }, destroy() { this.destroyed = true; } };
    graphics.push(g); return g;
  },
} };
const ctx = { visibleTiles: new Set(['2,2']), simulationTime: 7 };
showGrassBurn(scene, ctx, [{ x: 8, y: 8 }]);
assert.equal(graphics.length, 0, 'unseen ignition creates no telltale effects');
const random = Math.random;
try {
  Math.random = () => { throw Error('visuals cannot consume gameplay randomness'); };
  showGrassBurn(scene, ctx, [{ x: 2, y: 2 }, { x: 8, y: 8 }]);
  assert.equal(sprites.length, 1);
  assert.equal(graphics[0].depth, 98, 'fire stays beneath fog');
  const initial = JSON.stringify(graphics[0].rects);
  updateGrassBurns(scene, ctx, 140, false);
  assert.notEqual(JSON.stringify(graphics[0].rects), initial, 'fire flickers');
  for (const [x, y, w, h] of graphics[0].rects) {
    assert.ok(x >= 32 && y >= 32 && x + w <= 48 && y + h <= 48, 'smoke cannot drift into unseen cells');
  }
  const alpha = sprites[0].alpha;
  updateGrassBurns(scene, ctx, 10000, true);
  assert.equal(sprites[0].alpha, alpha, 'reading a modal pauses the burn sequence');
  assert.equal(sprites[0].destroyed, false);
  ctx.visibleTiles.clear();
  updateGrassBurns(scene, ctx, 10100, false);
  assert.equal(sprites[0].visible, false);
  assert.equal(graphics[0].rects.length, 0);
  ctx.visibleTiles.add('2,2');
  updateGrassBurns(scene, ctx, 10200, false);
  assert.equal(sprites[0].visible, true);
  assert.equal(ctx.simulationTime, 7, 'visual animation never advances world time');
  updateGrassBurns(scene, ctx, 13000, false);
  assert.ok(sprites[0].destroyed && graphics[0].destroyed, 'effects clean themselves up');
  showGrassBurn(scene, ctx, [{ x: 2, y: 2 }]);
  clearGrassBurns(scene); clearGrassBurns(scene);
  assert.ok(sprites[1].destroyed && graphics[1].destroyed, 'floor travel/shutdown cleanup is idempotent');
} finally { Math.random = random; }
console.log('Rogue0 grass fire: flames, fog-safe smoke, modal pause, deterministic visuals and cleanup passed');
