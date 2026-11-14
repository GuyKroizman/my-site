import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('door-styles');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Doors are generated at runtime (potionTextures.ts draws them into cached
// textures), so the visual check records the fillRect calls per style and
// compares the resulting pixels rather than loading a PNG.
function evaluate(path, bindings = {}) {
  const source = fs.readFileSync(path, 'utf8').replace(/^import .*;\n/gm, '');
  const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
  const exports = {};
  new Function('exports', ...Object.keys(bindings), js)(exports, ...Object.values(bindings));
  return exports;
}

const theme = evaluate('src/games/rogue0/dungeonTheme.ts');
const { doorStyleName, doorTextureKeys } = theme;

// --- region assignment -----------------------------------------------------
// Whole regions, including boundary floors, must be internally uniform and
// different from every other region.
const bands = [
  [1, 4], [5, 9], [10, 14], [15, 19], [20, 25]
];
const styleForBand = bands.map(([from, to]) => {
  const floor = from;
  const style = doorStyleName(floor);
  for (let f = from; f <= to; f++) {
    assert.equal(doorStyleName(f), style, `floor ${f} shares the style of floors ${from}-${to}`);
  }
  return style;
});
assert.equal(new Set(styleForBand).size, bands.length, 'every requested band has its own door style');

// Boundary floors (5, 10, 15, 20, 25) take the incoming region's style, the
// same rule the wall and floor art uses.
for (const [floor, style] of [[5, 'iron'], [10, 'stone-slab'], [15, 'crystal'], [20, 'basalt'], [25, 'basalt']]) {
  assert.equal(doorStyleName(floor), style, `floor ${floor} uses the ${style} door`);
}
// Out-of-range floors fall back to the first region rather than throwing.
assert.equal(doorStyleName(0), 'wood', 'floor 0 falls back to oak');
assert.equal(doorStyleName(26), 'wood', 'floors past the last region fall back like the wall theme does');

// Legacy keys: the oak set keeps the unqualified names used before theming.
const woodKeys = doorTextureKeys('wood');
assert.deepEqual(woodKeys, {
  front: 'door-front', side: 'door-side',
  threshold: 'door-threshold', thresholdSide: 'door-threshold-side'
}, 'oak keeps the original texture keys');
const allKeys = styleForBand.map(style => doorTextureKeys(style));
for (const key of allKeys.flatMap(keys => Object.values(keys)).filter(key => !key.startsWith('door-'))) {
  assert.fail(`unexpected door texture key ${key}`);
}
assert.equal(new Set(allKeys.flatMap(keys => Object.values(keys))).size, styleForBand.length * 4,
  'each style has four unique texture keys');

// --- generated art ---------------------------------------------------------
function fakeScene() {
  const textures = new Map();
  const scene = {
    textures: { exists: key => textures.has(key) },
    make: {
      graphics: () => {
        const pixels = new Map();
        const g = {
          color: 0,
          fillStyle(color) { g.color = color; return g; },
          fillRect(x, y, w, h) {
            for (let dy = 0; dy < h; dy++) {
              for (let dx = 0; dx < w; dx++) pixels.set(`${x + dx},${y + dy}`, g.color);
            }
          },
          generateTexture(key, width, height) {
            const signature = [...pixels].map(([cell, color]) => `${cell}:${color}`).sort().join('|');
            textures.set(key, { width, height, cells: pixels.size, signature, pixels: new Map(pixels) });
          },
          destroy() {}
        };
        return g;
      }
    }
  };
  return { scene, textures };
}

const { scene, textures } = fakeScene();
evaluate('src/games/rogue0/potionTextures.ts', { doorTextureKeys }).generateDoorThresholdTexture(scene);

// Every floor resolves to textures that production actually generated.
for (let floor = 1; floor <= 25; floor++) {
  const keys = doorTextureKeys(doorStyleName(floor));
  for (const [kind, key] of Object.entries(keys)) {
    const texture = textures.get(key);
    assert.ok(texture, `floor ${floor} ${kind} texture ${key} is generated`);
    assert.deepEqual([texture.width, texture.height], kind.startsWith('threshold') ? [16, 16] : [16, 21],
      `${key} keeps the panel/threshold size that anchors it to the floor`);
    assert.ok(texture.cells > 0, `${key} is not blank`);
  }
}

// Panels must actually look different, not merely be renamed.
for (const kind of ['front', 'side', 'threshold', 'thresholdSide']) {
  const signatures = allKeys.map(keys => textures.get(keys[kind]).signature ?? textures.get(keys[kind]));
  assert.equal(new Set(signatures).size, allKeys.length, `every style draws a distinct ${kind}`);
}
// And the two orientations of one style must not be the same art.
assert.notEqual(textures.get('door-front').signature, textures.get('door-side').signature,
  'a side-on door is not the front panel');

// --- wall contrast ---------------------------------------------------------
// Representative masonry face colors sampled from the five *-tiles.png wall
// frames (not their dark mortar or bright highlights). Compare the actual
// drawn pixels, not palette declarations: a bright handle alone isn't enough.
const wallColors = [0x64706a, 0x4b6077, 0x98764b, 0x74608e, 0x514449];
function rgb(color) {
  return [color >> 16 & 255, color >> 8 & 255, color & 255];
}
function distance(a, b) {
  return Math.hypot(...a.map((value, i) => value - b[i]));
}
function chroma(color) {
  const channels = rgb(color);
  const min = Math.min(...channels);
  const max = Math.max(...channels);
  return channels.map(value => (value - min) / (max - min || 1));
}
for (const [i, keys] of allKeys.entries()) {
  for (const [kind, key] of Object.entries(keys)) {
    const pixels = [...textures.get(key).pixels];
    // Keep the intentional dark outline out of the face comparison.
    const face = pixels.filter(([cell]) => {
      if (kind.startsWith('threshold')) return true;
      const [x, y] = cell.split(',').map(Number);
      return y > 0 && y < 20 && (kind === 'front' ? x >= 2 && x <= 13 : x >= 6 && x <= 9);
    });
    const contrasting = face.filter(([, color]) =>
      distance(rgb(color), rgb(wallColors[i])) >= 85 &&
      distance(chroma(color), chroma(wallColors[i])) >= 0.65);
    assert.ok(contrasting.length / face.length >= 0.6,
      `${key}: most of the door must contrast with its region's walls in color and brightness`);
  }
  // The narrow side view must not drift back to a wall-colored palette.
  const frontColors = new Set(textures.get(keys.front).pixels.values());
  for (const color of textures.get(keys.side).pixels.values()) {
    assert.ok(frontColors.has(color), `${keys.side} shares the front panel palette`);
  }
}

// --- render wiring ---------------------------------------------------------
const scene0 = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
assert.ok(scene0.includes('doorTextureKeys(doorStyleName(this.context.floor))'),
  'the front-face door path picks the style from the current floor');
assert.ok(scene0.includes('doorKeys.thresholdSide : doorKeys.side'),
  'the east-west door path uses the same styled set');
assert.ok(scene0.includes('doorKeys.threshold'), 'an opened door uses the styled doorstep');
assert.ok(!scene0.includes(`'door-front'`) && !scene0.includes('"door-threshold"'),
  'no door path still hardcodes the oak textures');

console.log('Door styles: 5 region bands, boundary floors, all 25 floors wired to generated art, distinct panels and thresholds, wall contrast in both orientations/states passed');
