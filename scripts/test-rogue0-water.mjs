import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('water');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function evaluate(source, bindings = {}) {
  const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
  const exports = {};
  new Function('exports', ...Object.keys(bindings), js)(exports, ...Object.values(bindings));
  return exports;
}
const water = evaluate(fs.readFileSync('src/games/rogue0/waterVisuals.ts', 'utf8').replace(/^import.*;\n/gm, ''));
const { WATER_TEXTURE, WATER_FRAMES, waterPixels, waterFrame, waterShoreMask, generateWaterTexture } = water;
assert.equal(waterShoreMask(0, 0, () => false), 15);
assert.equal(waterPixels(15, 0)[0], -1, 'isolated puddles have transparent rounded corners');
assert.notEqual(waterPixels(0, 0)[0], -1, 'connected interiors have no gaps');
assert.equal(waterShoreMask(0, 0, () => true), 0);
assert.equal(waterShoreMask(0, 0, (x, y) => x === 1 || y === 1), 9);
for (let mask = 0; mask < 16; mask++) {
  const frames = new Set();
  for (let frame = 0; frame < WATER_FRAMES; frame++) {
    const pixels = waterPixels(mask, frame);
    assert.equal(pixels.length, 256);
    assert.ok(pixels.every(Number.isInteger));
    frames.add(JSON.stringify(pixels));
    const index = waterFrame(mask, 3, 5, frame * 180);
    assert.ok(index >= mask * 8 && index < mask * 8 + 8);
  }
  assert.equal(frames.size, 8, 'all animation frames have distinct ripples');
}
assert.equal(waterFrame(3, 2, 3, 0), waterFrame(3, 2, 3, 1440), 'seamless clock loop');
assert.notEqual(waterFrame(0, 0, 0, 0), waterFrame(0, 1, 0, 0), 'neighboring tiles have different phases');
const previousRandom = Math.random;
try {
  Math.random = () => { throw Error('visuals must not use gameplay randomness'); };
  waterPixels(15, 3); waterFrame(5, 4, 2, 700);
} finally { Math.random = previousRandom; }
let exists = false, writes = 0, refreshes = 0;
const atlas = new Map();
const scene = { textures: { exists: () => exists, createCanvas(key, width, height) {
  assert.equal(key, WATER_TEXTURE); assert.deepEqual([width, height], [128, 256]); exists = true;
  return { getContext: () => ({ createImageData: () => ({ data: new Uint8ClampedArray(1024) }),
    putImageData(image) { writes++; assert.ok([0, 255].includes(image.data[3])); assert.equal(image.data[(8 * 16 + 8) * 4 + 3], 255); } }),
  add(id, source, x, y, w, h) { assert.equal(source, 0); atlas.set(id, [x, y, w, h]); },
  refresh() { refreshes++; } };
} } };
generateWaterTexture(scene); generateWaterTexture(scene);
assert.equal(atlas.size, 128); assert.equal(writes, 128); assert.equal(refreshes, 1);

// Exercise real terrain reconciliation and visual updates, including freezing.
let state = { feature: 'water' };
const source = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
const methods = source.slice(source.indexOf('  private featureVisual('), source.indexOf('  private makeArrowTexture()'));
const { TestScene } = evaluate(`export class TestScene { ${methods} }`, {
  ...water, tiles: { FeatureTiles: { water: 206 }, getFeature: () => state?.feature,
    forEachFeature(fn) { if (state) fn(0, 0, state); } },
  dungeon: { getCurrentLevel: () => [[0]] }, wallOverhang: () => false,
  worldDepth: () => 0, actorOriginY: () => 0,
});
const s = new TestScene();
const sprite = { visible: true, frame: 0, texture: '',
  setOrigin() { return this; }, setDepth() { return this; },
  setTexture(texture, frame) { this.texture = texture; this.frame = frame; return this; },
  setFrame(frame) { this.frame = frame; return this; },
  setVisible(visible) { this.visible = visible; return this; },
  setTint() {}, clearTint() {}, destroy() { this.destroyed = true; },
};
Object.assign(s, { context: { map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 } },
  time: { now: 0 }, add: { sprite: (_x, _y, texture, frame) => sprite.setTexture(texture, frame) },
  featureSprites: new Map(), wallSprites: new Map(), seen: [], lastWaterStep: -1,
});
s.syncFeatures();
assert.equal(sprite.texture, WATER_TEXTURE);
assert.equal(s.waterSprites.size, 1);
s.updateWater(180); assert.equal(sprite.frame, 1);
sprite.visible = false; s.updateWater(360);
assert.equal(sprite.visible, false); assert.equal(sprite.frame, 1, 'animation cannot reveal hidden tiles');
state = { feature: 'ice' }; s.syncFeatures();
assert.equal(s.waterSprites.size, 0); assert.equal(sprite.texture, 'tiles');
s.updateWater(540); assert.equal(sprite.frame, 206, 'frozen water stops animating');
state = null; s.syncFeatures();
assert.equal(sprite.destroyed, true); assert.equal(s.featureSprites.size, 0);
console.log('Rogue0 water: shoreline masks, pixel atlas, deterministic animation, visibility, freezing and terrain cleanup passed');
