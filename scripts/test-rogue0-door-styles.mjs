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
// Requested bands: 1-4, 6-9, 11-14, 16-19, 21-24 must each be internally
// uniform and different from every other band.
const bands = [
  [1, 4], [6, 9], [11, 14], [16, 19], [21, 24]
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
            textures.set(key, { width, height, cells: pixels.size, signature });
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

// --- render wiring ---------------------------------------------------------
const scene0 = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
assert.ok(scene0.includes('doorTextureKeys(doorStyleName(this.context.floor))'),
  'the front-face door path picks the style from the current floor');
assert.ok(scene0.includes('doorKeys.thresholdSide : doorKeys.side'),
  'the east-west door path uses the same styled set');
assert.ok(scene0.includes('doorKeys.threshold'), 'an opened door uses the styled doorstep');
assert.ok(!scene0.includes(`'door-front'`) && !scene0.includes('"door-threshold"'),
  'no door path still hardcodes the oak textures');

console.log('Door styles: 5 region bands, boundary floors, all 25 floors wired to generated art, distinct panels and thresholds passed');
