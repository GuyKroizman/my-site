import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('chasm-visuals');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function evaluate(source, bindings = {}) {
  const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
  const exports = {};
  new Function('exports', ...Object.keys(bindings), js)(exports, ...Object.values(bindings));
  return exports;
}

const chasm = evaluate(fs.readFileSync('src/games/rogue0/chasmVisuals.ts', 'utf8').replace(/^import.*;\n/gm, ''));
const {
  CHASM_TEXTURE, CHASM_CELL, CHASM_MARGIN, CHASM_SIZE, CHASM_FRAMES,
  chasmMask, chasmFrame, chasmPixels, generateChasmTexture
} = chasm;

const S = CHASM_SIZE;
assert.equal(CHASM_CELL, 16);
assert.equal(CHASM_MARGIN, 4);
assert.equal(S, 24);
assert.equal(CHASM_FRAMES, 16);

// --- edge masks ------------------------------------------------------------
const never = () => false;
const always = () => true;
assert.equal(chasmMask(0, 0, never), 15, 'an isolated chasm is edged on all four sides');
assert.equal(chasmMask(0, 0, always), 0, 'an interior cell has no rim');
assert.equal(chasmMask(0, 0, (x, y) => !(x === 0 && y === -1)), 1, 'floor to the north sets only the north bit');
assert.equal(chasmMask(0, 0, (x, y) => !(x === 1 && y === 0)), 2, 'floor to the east sets only the east bit');
assert.equal(chasmMask(0, 0, (x, y) => !(x === 0 && y === 1)), 4, 'floor to the south sets only the south bit');
assert.equal(chasmMask(0, 0, (x, y) => !(x === -1 && y === 0)), 8, 'floor to the west sets only the west bit');
assert.equal(chasmMask(0, 0, (x, y) => !(y === -1 || x === 1)), 3, 'adjacent edges combine');
for (let mask = 0; mask < CHASM_FRAMES; mask++) {
  assert.equal(chasmFrame(mask), mask, 'each mask owns one frame');
}
assert.equal(chasmFrame(15 | 16), 15, 'the frame index is masked to the atlas');

// --- pixel atlas -----------------------------------------------------------
const inCell = (x, y) => x >= CHASM_MARGIN && x < CHASM_MARGIN + CHASM_CELL &&
  y >= CHASM_MARGIN && y < CHASM_MARGIN + CHASM_CELL;
const at = (px, x, y) => px[y * S + x];
for (let mask = 0; mask < CHASM_FRAMES; mask++) {
  const px = chasmPixels(mask);
  assert.equal(px.length, S * S, 'every frame is a full 24x24 tile');
  assert.deepEqual(px, chasmPixels(mask), 'frames are deterministic');
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const pixel = at(px, x, y);
      assert.equal(pixel.length, 4, 'pixels are RGBA');
      assert.ok(pixel.every(Number.isInteger));
      assert.ok(pixel[3] >= 0 && pixel[3] <= 255);
      if (inCell(x, y)) {
        assert.equal(pixel[3], 255, 'the pit cell is opaque');
        // Rim bands are rock; the void between them stays near black. Mask 0
        // is all void, so it must be uniformly dark.
        if (mask === 0 ||
          (x >= 8 && x <= 15 && y >= 12 && y <= 17)) {
          assert.ok(pixel[0] < 20 && pixel[1] < 20 && pixel[2] < 20, 'the pit void stays near black');
        }
      }
    }
  }
  // Rim shadow bands exist exactly on floor-facing sides.
  const bandAlpha = (x0, x1, y0, y1) => {
    let max = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) max = Math.max(max, at(px, x, y)[3]);
    return max;
  };
  assert.equal(bandAlpha(4, 19, 0, 3) > 0, (mask & 1) !== 0, 'north shadow follows the north edge');
  assert.equal(bandAlpha(20, 23, 4, 19) > 0, (mask & 2) !== 0, 'east shadow follows the east edge');
  assert.equal(bandAlpha(4, 19, 20, 23) > 0, (mask & 4) !== 0, 'south shadow follows the south edge');
  assert.equal(bandAlpha(0, 3, 4, 19) > 0, (mask & 8) !== 0, 'west shadow follows the west edge');
}

// The far rim shows a lit face descending to black; the near rim only shows a
// lit lip on the floor side of the cut.
const north = chasmPixels(1);
assert.ok(at(north, 10, 4)[0] > at(north, 10, 12)[0], 'the north face darkens with depth');
assert.equal(at(north, 10, 20)[3], 0, 'a north-only rim casts no near lip');
const south = chasmPixels(4);
assert.deepEqual(at(south, 10, 20), [0x7a, 0x78, 0x62, 62], 'the near lip is a dim warm line');
assert.ok(at(south, 10, 19)[0] < 20, 'the near cut edge is dark');
const all = chasmPixels(15);
assert.ok(at(all, 10, 4)[0] > at(all, 10, 12)[0], 'the face is independent of the other edges');
assert.deepEqual(at(all, 10, 20), [0x7a, 0x78, 0x62, 62], 'the near lip survives a fully edged frame');

// The open interior must not use gameplay RNG.
const previousRandom = Math.random;
try {
  Math.random = () => { throw Error('visuals must not use gameplay randomness'); };
  chasmPixels(15); chasmPixels(0);
} finally {
  Math.random = previousRandom;
}

// --- texture generation ----------------------------------------------------
let exists = false, writes = 0, refreshes = 0;
const atlas = new Map();
const scene = {
  textures: {
    exists: () => exists,
    createCanvas(key, width, height) {
      assert.equal(key, CHASM_TEXTURE);
      assert.deepEqual([width, height], [S * 4, S * 4]);
      exists = true;
      return {
        getContext: () => ({
          createImageData: () => ({ data: new Uint8ClampedArray(S * S * 4) }),
          putImageData(image, x, y) {
            writes++;
            assert.ok([0, 255].includes(image.data[3]) || image.data[3] >= 20, 'margin alpha is a real shadow');
            assert.ok(x >= 0 && y >= 0);
          }
        }),
        add(id, source, x, y, w, h) {
          assert.equal(source, 0);
          atlas.set(id, [x, y, w, h]);
        },
        refresh() { refreshes++; }
      };
    }
  }
};
generateChasmTexture(scene);
generateChasmTexture(scene);
assert.equal(atlas.size, CHASM_FRAMES, 'every edge mask is registered once');
assert.equal(writes, CHASM_FRAMES);
assert.equal(refreshes, 1, 'the canvas is built once per texture cache');
for (const [id, [x, y, w, h]] of atlas) {
  assert.deepEqual([w, h], [S, S]);
  assert.equal(x, (id % 4) * S);
  assert.equal(y, Math.floor(id / 4) * S);
}

// --- scene wiring ----------------------------------------------------------
let state = { feature: 'chasm' };
const source = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
const methods = source.slice(source.indexOf('  private featureVisual('), source.indexOf('  private makeArrowTexture()'));
const { TestScene } = evaluate(`export class TestScene { ${methods} }`, {
  CHASM_TEXTURE, CHASM_MARGIN, CHASM_SIZE, chasmMask, chasmFrame,
  tiles: { FeatureTiles: { water: 206, chasm: 5 } },
  terrainFor: () => ({
    getFeature: (x, y) => (x === 0 && y === 0 ? state?.feature : undefined),
    forEachFeature(fn) { if (state) fn(0, 0, state); }
  }),
  dungeon: { getCurrentLevel: () => [[0]] }, wallOverhang: () => false,
  worldDepth: () => 0, actorOriginY: () => 0,
  dungeonThemeName: () => 'stone', decalFrameFor: () => undefined,
  flatDecalFrameFor: () => undefined, DECAL_TEXTURE: 'wall-decals', UPRIGHT_LIFT: 5,
});
const s = new TestScene();
const sprite = {
  visible: false, texture: '', frame: -1, tint: 0xffffff, alpha: 0, depth: -1, origins: [],
  setOrigin(...args) { this.origins.push(args); return this; },
  setDepth(depth) { this.depth = depth; return this; },
  setTexture(texture, frame) { this.texture = texture; this.frame = frame; return this; },
  setFrame(frame) { this.frame = frame; return this; },
  setVisible(visible) { this.visible = visible; return this; },
  setAlpha(alpha) { this.alpha = alpha; return this; },
  setTint(tint) { this.tint = tint; return this; },
  clearTint() { this.tint = 0xffffff; },
  destroy() { this.destroyed = true; }
};
Object.assign(s, {
  context: { map: { tileToWorldX: (x) => x * 16, tileToWorldY: (y) => y * 16 } },
  time: { now: 0 },
  add: { sprite: (_x, _y, texture, frame) => sprite.setTexture(texture, frame) },
  featureSprites: new Map(), wallSprites: new Map(), seen: [], lastWaterStep: -1
});

s.syncFeatures();
assert.equal(sprite.texture, CHASM_TEXTURE, 'the chasm uses the depth atlas, not the tinted placeholder tile');
assert.equal(sprite.frame, 15, 'an isolated chasm cell selects the fully edged frame');
assert.equal(sprite.tint, 0xffffff, 'no tint is applied over the generated art');
assert.equal(sprite.depth, 0, 'the pit stays flat on the floor');
assert.equal(sprite.alpha, 1);
assert.equal(sprite.visible, true);
assert.deepEqual(sprite.origins.at(-1), [CHASM_MARGIN / CHASM_SIZE, CHASM_MARGIN / CHASM_SIZE],
  'the margin is centred on the cell so the rim shadow lands on the neighbours');
assert.equal(s.waterSprites.size, 0, 'the pit is not animated as water');

console.log('Rogue0 chasm visuals: edge masks, rim shadow, cliff face, near lip, generated atlas and scene wiring passed');
