import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('gas-visuals');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync('src/games/rogue0/gasVisuals.ts', 'utf8');
// Presentation must stay independent of gameplay RNG and of any other module.
assert.doesNotMatch(source, /Math\.random\s*\(/, 'gas visuals never consume gameplay RNG');
assert.doesNotMatch(source, /from '\.\/(gas|dungeon|fov)'/, 'visuals do not reach into gameplay modules');

const exports = {};
new Function('exports', ts.transpile(source.replace(/^import.*;\n/gm, ''),
  { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }))(exports);
const { gasNoise, gasDensity, gasCellLayout, updateGasVisuals, clearGasVisuals } = exports;

function sceneCapture() {
  const layers = [];
  const scene = {
    add: {
      graphics() {
        const g = {
          quads: [], depth: 0, destroyed: false,
          clear() { this.quads = []; return this; },
          setDepth(d) { this.depth = d; return this; },
          fillStyle(color, alpha) { this.color = color; this.alpha = alpha; return this; },
          fillRect(x, y, w, h) {
            this.quads.push({ x, y, w, h, color: this.color, alpha: this.alpha });
            return this;
          },
          destroy() { this.destroyed = true; }
        };
        layers.push(g);
        return g;
      }
    }
  };
  return { scene, layers };
}

function contextWith(clouds, { width = 9, height = 9, visible = 'all', walls = new Set() } = {}) {
  const level = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => walls.has(`${x},${y}`) ? 1 : 0));
  const visibleTiles = new Set();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (visible === 'all' || visible.has(`${x},${y}`)) visibleTiles.add(`${x},${y}`);
    }
  }
  return { visibleTiles, currentLevel: level, poisonClouds: clouds, simulationTime: 2 };
}

const cloud = (x, y, bornAt = 0, expiresAt = 8, radius = 0) =>
  ({ x, y, bornAt, expiresAt, nextTick: 0, nextExpand: Infinity, radius });

// --- deterministic, noise-based layout --------------------------------------
{
  const a = gasCellLayout(3, 5, 1234, 1);
  const b = gasCellLayout(3, 5, 1234, 1);
  assert.deepEqual(a, b, 'layout is a pure function of tile, clock and density');
  assert.notDeepEqual(a, gasCellLayout(3, 5, 1834, 1), 'the cloud animates over time');
  assert.notDeepEqual(a, gasCellLayout(4, 5, 1234, 1), 'each tile has its own shape');

  for (const [x, y, ch] of [[0, 0, 0], [-7, 11, 3], [41, -3, 97], [2, 2, 101]]) {
    const n = gasNoise(x, y, ch);
    assert.ok(n >= 0 && n < 1, `noise(${x},${y},${ch}) stays in [0,1)`);
  }
  const distinct = new Set();
  for (let i = 0; i < 64; i++) distinct.add(gasNoise(i % 8, i >> 3, i));
  assert.ok(distinct.size > 50, 'noise spreads its output instead of repeating');
}

// --- density: swells in, thins out, never negative ---------------------------
{
  assert.equal(gasDensity(cloud(0, 0, 0, 8), 0), 0, 'a just-born cloud has not swollen in yet');
  assert.ok(gasDensity(cloud(0, 0, 0, 8), 0.4) > 0.9, 'it reaches full density quickly');
  const mid = gasDensity(cloud(0, 0, 0, 8), 4);
  assert.ok(mid > 0.4 && mid < 0.6, `halfway through its life it is about half solid (${mid})`);
  assert.ok(gasDensity(cloud(0, 0, 0, 8), 6) < mid, 'density decreases monotonically');
  assert.equal(gasDensity(cloud(0, 0, 0, 8), 8), 0, 'an expired cloud is empty');
  assert.equal(gasDensity(cloud(0, 0, 0, 8), 99), 0, 'never negative after expiry');
  // Legacy saves carry no birth time: they keep the old constant look.
  assert.equal(gasDensity({ x: 0, y: 0, nextTick: 0, expiresAt: 8 }, 4), 1);
}

// --- shapes stay attached to their tile ------------------------------------
{
  const layout = gasCellLayout(4, 4, 555, 1);
  const cx = 4 * 16 + 8;
  const cy = 4 * 16 + 8;
  for (const puff of layout.puffs) {
    assert.ok(Math.hypot(puff.x - cx, puff.y - cy) + puff.r < 16, 'a puff covers its tile without leaving the cloud');
    assert.ok(puff.r >= 1 && puff.alpha > 0, 'puffs have a visible radius and alpha');
  }
  assert.ok(layout.haze.r > 8 && layout.haze.alpha > 0, 'the haze reaches past the tile to bridge neighbours');
  assert.ok(layout.motes.length > 0, 'the cell carries swirl and drift motes');
  for (const mote of layout.motes) {
    assert.ok(Math.hypot(mote.x - cx, mote.y - cy) < 9, 'motes stay inside the cell');
    assert.ok(mote.alpha >= 0 && mote.alpha <= 1, 'mote alpha is a real alpha');
    assert.ok(mote.size === 1 || mote.size === 2, 'motes are pixel-scale');
  }
  // A dissipating cell shrinks toward its centre instead of staying full size.
  const faded = gasCellLayout(4, 4, 555, 0.1);
  const wide = Math.max(...layout.puffs.map(p => p.r));
  const narrow = Math.max(...faded.puffs.map(p => p.r));
  assert.ok(narrow < wide, 'a fading cell shrinks');
  assert.ok(Math.max(...faded.motes.map(m => m.alpha)) < Math.max(...layout.motes.map(m => m.alpha)),
    'a fading cell dims its motes');
}

// --- rendering: only explored, open tiles are ever painted ------------------
{
  const { scene, layers } = sceneCapture();
  const context = contextWith([cloud(4, 4), cloud(5, 4), cloud(4, 5)]);
  updateGasVisuals(scene, context, 1000, false);
  assert.equal(layers.length, 2, 'one layer for the body, one for swirls and motes');
  const [body, wisps] = layers;
  assert.ok(body.depth < 100, 'the gas body stays below the fog of war');
  assert.ok(wisps.depth > body.depth && wisps.depth < 100, 'swirls sit over the body, still under the fog');
  assert.equal(body.quads.length > 200, true, 'each cell is made of many small quads');
  assert.ok(wisps.quads.length > 0, 'swirl motes are drawn');
  for (const quad of [...body.quads, ...wisps.quads]) {
    assert.ok(quad.w > 0 && quad.h > 0 && quad.alpha > 0 && quad.alpha <= 1, 'quads are visible pixels');
    const x0 = Math.floor(quad.x / 16), x1 = Math.floor((quad.x + quad.w - 1) / 16);
    const y = Math.floor(quad.y / 16);
    for (let x = x0; x <= x1; x++) {
      assert.ok(context.visibleTiles.has(`${x},${y}`), `never paints an unseen tile (${x},${y})`);
      assert.equal(context.currentLevel[y][x], 0, `never paints a wall (${x},${y})`);
    }
  }
}

// --- a cloud the hero cannot see is not drawn, and nothing leaks -------------
{
  const { scene, layers } = sceneCapture();
  const context = contextWith([cloud(4, 4)], { visible: new Set(['3,4', '4,3']) });
  updateGasVisuals(scene, context, 1000, false);
  const total = layers.reduce((n, layer) => n + layer.quads.length, 0);
  assert.equal(total, 0, 'an unseen cloud draws nothing at all');

  // Visible cell next to a wall: the soft puffs overflow, the wall must stay bare.
  const { scene: scene2, layers: layers2 } = sceneCapture();
  const context2 = contextWith([cloud(4, 4)], { walls: new Set(['5,4', '4,5', '5,5']) });
  updateGasVisuals(scene2, context2, 1000, false);
  const quads = layers2.flatMap(layer => layer.quads);
  assert.ok(quads.length > 0, 'the visible cell is still drawn');
  for (const quad of quads) {
    const x1 = Math.floor((quad.x + quad.w - 1) / 16);
    const y = Math.floor(quad.y / 16);
    assert.equal(context2.currentLevel[y][x1], 0, 'gas never bleeds onto stone');
  }
}

// --- the animation clock freezes with the rest of the presentation ----------
{
  const { scene, layers } = sceneCapture();
  const context = contextWith([cloud(4, 4, 0, 8)]);
  updateGasVisuals(scene, context, 1000, false);
  const first = layers.map(layer => layer.quads.map(q => ({ ...q })));
  updateGasVisuals(scene, context, 2200, true);
  assert.deepEqual(layers.map(layer => layer.quads), first, 'a paused menu freezes the swirls');
  updateGasVisuals(scene, context, 3400, false);
  assert.notDeepEqual(layers.map(layer => layer.quads), first, 'unpausing resumes the swirls');
}

// --- lifecycle: graphics appear on demand and are torn down -----------------
{
  const { scene, layers } = sceneCapture();
  const context = contextWith([cloud(4, 4)]);
  updateGasVisuals(scene, context, 1000, false);
  assert.equal(layers.length, 2, 'the layers are created lazily');
  updateGasVisuals(scene, context, 1400, false);
  assert.equal(layers.length, 2, 'and reused while gas remains');
  context.simulationTime = 8;
  updateGasVisuals(scene, context, 1800, false);
  assert.ok(layers.every(layer => layer.destroyed), 'expired gas destroys its layers');
  updateGasVisuals(scene, context, 2200, false);
  assert.equal(layers.length, 2, 'nothing is recreated for an empty cloud list');
  context.poisonClouds = [cloud(4, 4, 8, 16)];
  updateGasVisuals(scene, context, 2600, false);
  assert.equal(layers.length, 4, 'a fresh cloud gets new layers');
  clearGasVisuals(scene);
  assert.ok(layers.every(layer => layer.destroyed), 'scene shutdown clears every layer');
}

// --- presentation never mutates gameplay state -----------------------------
{
  const clouds = [cloud(4, 4, 0, 8), cloud(5, 4, 0, 8, 1)];
  const snapshot = JSON.stringify(clouds);
  const { scene } = sceneCapture();
  const context = contextWith(clouds);
  updateGasVisuals(scene, context, 1000, false);
  updateGasVisuals(scene, context, 2000, false);
  assert.equal(JSON.stringify(clouds), snapshot, 'clouds are read, never written');
  assert.equal(context.simulationTime, 2, 'the visual clock never advances simulation time');
}

console.log('gas visuals: all assertions passed');
