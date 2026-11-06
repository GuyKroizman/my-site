import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('gas-visuals');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync('src/games/rogue0/gasVisuals.ts', 'utf8');
// Presentation must stay independent of gameplay RNG and of other modules.
assert.doesNotMatch(source, /Math\.random\s*\(/, 'gas visuals never consume gameplay RNG');
assert.doesNotMatch(source, /from '\.\/(gas|dungeon|fov)'/, 'visuals do not reach into gameplay modules');

const exports = {};
new Function('exports', ts.transpile(source.replace(/^import.*;\n/gm, ''),
  { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }))(exports);
const { gasNoise, gasDensity, gasClusters, gasField, gasCloudLayout, updateGasVisuals, clearGasVisuals } = exports;

const TILE = 16;
const centre = (x, y) => [x * TILE + TILE / 2, y * TILE + TILE / 2];

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

function contextWith(clouds, { width = 11, height = 11, visible = 'all', walls = new Set() } = {}) {
  const level = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => walls.has(`${x},${y}`) ? 1 : 0));
  const visibleTiles = new Set();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (visible === 'all' || visible.has(`${x},${y}`)) visibleTiles.add(`${x},${y}`);
    }
  }
  return { visibleTiles, currentLevel: level, poisonClouds: clouds, simulationTime: 3 };
}

const cloud = (x, y, bornAt = 0, expiresAt = 8, radius = 0) =>
  ({ x, y, bornAt, expiresAt, nextTick: 0, nextExpand: Infinity, radius });
// Legacy clouds (no bornAt) always report density 1: used where a test needs a
// cloud at full strength regardless of the clock.
const solid = (cx, cy, reach) => {
  const out = [];
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dy = -reach; dy <= reach; dy++) {
      if (Math.abs(dx) + Math.abs(dy) <= reach) out.push({ x: cx + dx, y: cy + dy, nextTick: 0, expiresAt: 8 });
    }
  }
  return out;
};
const diamond = (cx, cy, reach) => {
  const out = [];
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dy = -reach; dy <= reach; dy++) {
      const r = Math.abs(dx) + Math.abs(dy);
      if (r <= reach) out.push(cloud(cx + dx, cy + dy, 0, 8 - r * 2, r));
    }
  }
  return out;
};

// --- deterministic, noise-based layout --------------------------------------
{
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

// --- cells of one cloud become one cluster ---------------------------------
{
  const clusters = gasClusters(diamond(5, 5, 2), 3);
  assert.equal(clusters.length, 1, 'an adjacent diamond is a single cloud');
  assert.equal(clusters[0].cells.length, 13, 'every living cell belongs to it');
  assert.deepEqual([clusters[0].minX, clusters[0].minY, clusters[0].maxX, clusters[0].maxY], [3, 3, 7, 7],
    'the cluster reports its tile bounds');
  const [cx, cy] = centre(5, 5);
  assert.equal(clusters[0].cx, cx, 'the swirl centre is the cloud centre, not a tile centre');
  assert.equal(clusters[0].cy, cy);
  assert.ok(clusters[0].radius > 2 * TILE, 'the swirl radius reaches the cloud rim');

  // A gap of one tile keeps two clouds apart: no shared field, no merging.
  const split = gasClusters([cloud(1, 1), cloud(2, 1), cloud(6, 1), cloud(7, 1)], 1);
  assert.equal(split.length, 2, 'non-touching cells stay separate clouds');
  assert.equal(split[0].cells.length, 2);
  assert.equal(split[1].cells.length, 2);
  assert.equal(gasField(split[0], ...centre(4, 1)), 0, 'the field never bridges a gap');

  // Expired cells contribute nothing, and an all-expired cloud is dropped.
  const expiring = gasClusters([cloud(4, 4, 0, 5), cloud(5, 4, 0, 5)], 5);
  assert.equal(expiring.length, 0, 'expired clouds are not rendered');
  const partly = gasClusters(diamond(5, 5, 2), 5);
  assert.ok(partly[0].cells.length < 13, 'the outer rings vanish first');
}

// --- the field is one plateau, not a hump per tile -------------------------
{
  const [cluster] = gasClusters(solid(5, 5, 2), 3);
  // Dense across every cell centre and, crucially, across the boundary between
  // neighbouring cells: that is what stops the render from looking like a gas
  // tile per tile.
  for (const cell of cluster.cells) {
    assert.ok(gasField(cluster, ...centre(cell.x, cell.y)) > 0.94,
      `cell (${cell.x},${cell.y}) is fully dense`);
  }
  for (let x = 3; x < 7; x++) {
    for (let step = 1; step <= 15; step++) {
      const between = gasField(cluster, (x * TILE) + step, centre(0, 5)[1]);
      assert.ok(between > 0.9, `no seam between cells x=${x} and x=${x + 1} (${between.toFixed(3)})`);
    }
  }
  // A single cell's own tile is uniformly dense, then it fades outward.
  const lone = gasClusters(solid(5, 5, 0), 1)[0];
  const [cx, cy] = centre(5, 5);
  assert.ok(gasField(lone, cx + 6, cy + 6) > 0.4, 'the corner of a lone cell still has gas');
  let previous = 2;
  for (let d = 0; d <= 24; d++) {
    const f = gasField(lone, cx + d, cy);
    assert.ok(f <= previous + 1e-9, 'the field only falls off away from the cell');
    assert.ok(f >= 0 && f <= 1, 'the field stays a normalised density');
    previous = f;
  }
  assert.equal(gasField(lone, cx + 30, cy), 0, 'beyond the influence radius there is no gas');
}

// --- layout: deterministic, animated, and covering the whole cloud ---------
{
  const [cluster] = gasClusters(solid(5, 5, 2), 3);
  const a = gasCloudLayout(cluster, 1234);
  assert.deepEqual(a, gasCloudLayout(cluster, 1234), 'layout is a pure function of cluster and clock');
  assert.notDeepEqual(a, gasCloudLayout(cluster, 1834), 'the cloud animates over time');

  assert.ok(a.blobs.length > 20, 'the body is built from many blobs');
  for (const blob of a.blobs) {
    assert.ok(blob.alpha > 0 && blob.alpha <= 1, 'blob alpha is a real alpha');
    assert.ok(blob.r >= 4 && blob.r <= 16, 'blob radius stays in the visible range');
    const field = gasField(cluster, blob.x, blob.y);
    assert.ok(field >= 0.08, 'blobs only exist where the cloud has body');
    assert.ok(Number.isFinite(blob.color), 'blobs carry a colour');
  }
  // Every dense point of the cloud is covered by at least one blob, so the body
  // is continuous instead of a set of patches.
  for (let y = cluster.minY * TILE; y < (cluster.maxY + 1) * TILE; y += 4) {
    for (let x = cluster.minX * TILE; x < (cluster.maxX + 1) * TILE; x += 4) {
      if (gasField(cluster, x, y) < 0.6) continue;
      const covered = a.blobs.some(blob => Math.hypot(blob.x - x, blob.y - y) <= blob.r);
      assert.ok(covered, `cloud interior point ${x},${y} is covered by the body`);
    }
  }
  assert.ok(a.motes.length > 10, 'the cloud carries swirl and rising motes');
  for (const mote of a.motes) {
    assert.ok(mote.alpha >= 0 && mote.alpha <= 1, 'mote alpha is a real alpha');
    assert.ok(mote.size === 1 || mote.size === 2, 'motes are pixel-scale');
  }
  // A fading cloud shrinks and thins; it never grows.
  const fading = gasClusters(diamond(5, 5, 2), 5.5)[0];
  const faded = gasCloudLayout(fading, 1234);
  const average = (blobs) => blobs.reduce((sum, blob) => sum + blob.r * blob.alpha, 0) / blobs.length;
  assert.ok(average(faded.blobs) < average(a.blobs), 'a dissipating cloud loses its body');
}

// --- rendering: one continuous mass, clipped to seen and open floor ---------
{
  const { scene, layers } = sceneCapture();
  const context = contextWith(solid(5, 5, 2));
  updateGasVisuals(scene, context, 1000, false);
  assert.equal(layers.length, 2, 'one layer for the body, one for swirls and motes');
  const [body, wisps] = layers;
  assert.ok(body.depth < 100, 'the gas body stays below the fog of war');
  assert.ok(wisps.depth > body.depth && wisps.depth < 100, 'swirls sit over the body, still under the fog');
  assert.ok(body.quads.length > 500, 'each cloud is made of many small quads');
  assert.ok(wisps.quads.length > 0, 'swirl motes are drawn');
  for (const quad of [...body.quads, ...wisps.quads]) {
    assert.ok(quad.w > 0 && quad.h > 0 && quad.alpha > 0 && quad.alpha <= 1, 'quads are visible pixels');
    const x0 = Math.floor(quad.x / TILE), x1 = Math.floor((quad.x + quad.w - 1) / TILE);
    const y = Math.floor(quad.y / TILE);
    for (let x = x0; x <= x1; x++) {
      assert.ok(context.visibleTiles.has(`${x},${y}`), `never paints an unseen tile (${x},${y})`);
      assert.equal(context.currentLevel[y][x], 0, `never paints a wall (${x},${y})`);
    }
  }
  // The body spans several tiles: this is one mass, not one blob per cell.
  const spans = new Set(body.quads.map(q => `${Math.floor(q.x / TILE)},${Math.floor(q.y / TILE)}`));
  assert.ok(spans.size >= 9, 'the body crosses tile borders freely');

  // Two separated clouds stay visually apart.
  const { scene: scene2, layers: layers2 } = sceneCapture();
  const apart = contextWith([{ x: 2, y: 5, nextTick: 0, expiresAt: 8 }, { x: 8, y: 5, nextTick: 0, expiresAt: 8 }]);
  updateGasVisuals(scene2, apart, 1000, false);
  const drawn = layers2.flatMap(layer => layer.quads);
  assert.ok(drawn.length > 0, 'both clouds are drawn');
  const middle = 5 * TILE;
  assert.ok(!drawn.some(q => q.x <= middle && q.x + q.w > middle), 'the gap between clouds stays clear');
}

// --- clipping fills right up to walls and the fog instead of leaving holes --
{
  const { scene, layers } = sceneCapture();
  const context = contextWith(solid(3, 3, 1), { walls: new Set(['5,3', '3,5']) });
  updateGasVisuals(scene, context, 1000, false);
  const quads = layers.flatMap(layer => layer.quads);
  assert.ok(quads.length > 0, 'the visible part of the cloud is drawn');
  const right = Math.max(...quads.map(q => q.x + q.w - 1));
  const bottom = Math.max(...quads.map(q => q.y + q.h - 1));
  assert.ok(right >= 5 * TILE - 1, 'the body reaches the gas tile edge next to the wall');
  assert.ok(bottom >= 5 * TILE - 1, 'and the same on the other axis');

  const { scene: scene3, layers: layers3 } = sceneCapture();
  const fogged = contextWith(solid(5, 5, 1), { visible: new Set(['4,5', '5,4', '5,5', '6,5', '5,6']) });
  updateGasVisuals(scene3, fogged, 1000, false);
  assert.ok(layers3.flatMap(layer => layer.quads).length > 0, 'a partly seen cloud still draws');
  const { scene: scene4, layers: layers4 } = sceneCapture();
  const hidden = contextWith([cloud(5, 5)], { visible: new Set(['1,1', '1,2']) });
  updateGasVisuals(scene4, hidden, 1000, false);
  assert.equal(layers4.reduce((n, layer) => n + layer.quads.length, 0), 0,
    'a cloud the hero cannot see draws nothing at all');
}

// --- the animation clock freezes with the rest of the presentation ----------
{
  const { scene, layers } = sceneCapture();
  const context = contextWith(solid(5, 5, 1));
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
  const context = contextWith(solid(5, 5, 1));
  updateGasVisuals(scene, context, 1000, false);
  assert.equal(layers.length, 2, 'the layers are created lazily');
  updateGasVisuals(scene, context, 1400, false);
  assert.equal(layers.length, 2, 'and reused while gas remains');
  context.simulationTime = 20;
  updateGasVisuals(scene, context, 1800, false);
  assert.ok(layers.every(layer => layer.destroyed), 'expired gas destroys its layers');
  updateGasVisuals(scene, context, 2200, false);
  assert.equal(layers.length, 2, 'nothing is recreated for an empty cloud list');
  context.poisonClouds = [{ x: 5, y: 5, bornAt: 18, expiresAt: 26, nextTick: 0 }];
  updateGasVisuals(scene, context, 2600, false);
  assert.equal(layers.length, 4, 'a fresh cloud gets new layers');
  clearGasVisuals(scene);
  assert.ok(layers.every(layer => layer.destroyed), 'scene shutdown clears every layer');
}

// --- presentation never mutates gameplay state -----------------------------
{
  const clouds = solid(5, 5, 1);
  const snapshot = JSON.stringify(clouds);
  const { scene } = sceneCapture();
  const context = contextWith(clouds);
  updateGasVisuals(scene, context, 1000, false);
  updateGasVisuals(scene, context, 2000, false);
  assert.equal(JSON.stringify(clouds), snapshot, 'clouds are read, never written');
  assert.equal(context.simulationTime, 3, 'the visual clock never advances simulation time');
}

console.log('gas visuals: one continuous cloud per cloud, all assertions passed');
