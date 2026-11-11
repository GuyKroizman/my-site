import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('chasm-visuals');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const theme = await import('../src/games/rogue0/dungeonTheme.ts');
const doorBindings = { doorStyleName: theme.doorStyleName, doorTextureKeys: theme.doorTextureKeys };

function evaluate(source, bindings = {}) {
  const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
  const exports = {};
  new Function('exports', ...Object.keys(bindings), js)(exports, ...Object.values(bindings));
  return exports;
}

const chasm = evaluate(fs.readFileSync('src/games/rogue0/chasmVisuals.ts', 'utf8').replace(/^import.*;\n/gm, ''));
const {
  CHASM_TEXTURE, CHASM_CELL, CHASM_MARGIN, CHASM_SIZE, CHASM_FRAMES,
  CHASM_DEEP_TEXTURE, CHASM_DEEP_SIZE, CHASM_PARALLAX, CHASM_DEEP_DEPTH, CHASM_SURFACE_DEPTH,
  chasmMask, chasmFrame, chasmPixels, chasmDeepPixels, chasmParallaxOffset,
  generateChasmTexture, generateChasmDeepTexture
} = chasm;

const S = CHASM_SIZE;
assert.equal(CHASM_CELL, 16);
assert.equal(CHASM_MARGIN, 4);
assert.equal(S, 24);
assert.equal(CHASM_FRAMES, 16);
assert.equal(CHASM_DEEP_SIZE, 128);
assert.equal(CHASM_PARALLAX, 0.35);
assert.ok(CHASM_DEEP_DEPTH < CHASM_SURFACE_DEPTH, 'the deep layer sits under the rim sprites');

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
      if (inCell(x, y) && mask === 0) {
        assert.equal(pixel[3], 0, 'interior cells are transparent so the deep floor shows through');
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
assert.ok(at(north, 10, 14)[3] > 0, 'the face casts a shadow onto the deep floor');
assert.equal(at(north, 10, 19)[3], 0, 'the north shadow fades before the tile seam');
const south = chasmPixels(4);
assert.deepEqual(at(south, 10, 20), [0x7a, 0x78, 0x62, 62], 'the near lip is a dim warm line');
assert.ok(at(south, 10, 19)[0] < 20, 'the near cut edge is dark');
assert.ok(at(south, 10, 16)[3] > 0, 'the near rim shades the deep floor');
const all = chasmPixels(15);
assert.ok(at(all, 10, 4)[0] > at(all, 10, 12)[0], 'the face is independent of the other edges');
assert.deepEqual(at(all, 10, 20), [0x7a, 0x78, 0x62, 62], 'the near lip survives a fully edged frame');
assert.ok(at(all, 11, 14)[3] > 0 && at(all, 11, 14)[3] < 255, 'the deep floor is shaded inside a one-tile pit');

// --- deep floor ------------------------------------------------------------
const deepPixels = chasmDeepPixels();
assert.equal(deepPixels.length, CHASM_DEEP_SIZE * CHASM_DEEP_SIZE);
assert.deepEqual(deepPixels, chasmDeepPixels(), 'the deep floor is deterministic');
assert.ok(deepPixels.every(pixel => pixel[3] === 255), 'the deep floor is opaque');
assert.ok(deepPixels.every(pixel => pixel[0] < 40 && pixel[1] < 40 && pixel[2] < 40),
  'the deep floor stays dark enough to read as a void');
assert.equal(chasmParallaxOffset(0), CHASM_DEEP_SIZE * 64);
assert.equal(chasmParallaxOffset(0) - chasmParallaxOffset(100), 65,
  'the texture advances 0.65px for every world pixel so the layer moves at 0.35x');
assert.ok(chasmParallaxOffset(5000) > 0, 'the offset stays positive across a large map');

// The atlas and deep floor must not use gameplay RNG.
const previousRandom = Math.random;
try {
  Math.random = () => { throw Error('visuals must not use gameplay randomness'); };
  chasmPixels(15); chasmPixels(0); chasmDeepPixels();
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

let deepBuilds = 0;
const deepScene = {
  textures: {
    exists: () => deepBuilds > 0,
    createCanvas(key, width, height) {
      assert.equal(key, CHASM_DEEP_TEXTURE);
      assert.deepEqual([width, height], [CHASM_DEEP_SIZE, CHASM_DEEP_SIZE]);
      return {
        getContext: () => ({
          createImageData: () => ({ data: new Uint8ClampedArray(CHASM_DEEP_SIZE * CHASM_DEEP_SIZE * 4) }),
          putImageData(image) {
            assert.equal(image.data.length, CHASM_DEEP_SIZE * CHASM_DEEP_SIZE * 4);
            assert.equal(image.data[3], 255);
          }
        }),
        refresh() { deepBuilds++; }
      };
    }
  }
};
generateChasmDeepTexture(deepScene);
generateChasmDeepTexture(deepScene);
assert.equal(deepBuilds, 1, 'the deep floor is built once');

// --- scene wiring ----------------------------------------------------------
let state = { feature: 'chasm' };
const source = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
const methods = source.slice(source.indexOf('  private featureVisual('), source.indexOf('  private makeArrowTexture()'));
const { TestScene } = evaluate(`export class TestScene { ${methods} }`, {
  CHASM_TEXTURE, CHASM_CELL, CHASM_MARGIN, CHASM_SIZE, CHASM_DEEP_TEXTURE, CHASM_DEEP_DEPTH,
  CHASM_SURFACE_DEPTH, chasmParallaxOffset, chasmMask, chasmFrame,
  tiles: { FeatureTiles: { water: 206, chasm: 5 } },
  terrainFor: () => ({
    getFeature: (x, y) => (x === 0 && y === 0 ? state?.feature : undefined),
    forEachFeature(fn) { if (state) fn(0, 0, state); }
  }),
  dungeon: { getCurrentLevel: () => [[0]] }, wallOverhang: () => false,
  worldDepth: () => 0, actorOriginY: () => 0,
  // Door textures are named per region by the theme module.
  ...doorBindings,
  dungeonThemeName: () => 'stone', decalFrameFor: () => undefined,
  flatDecalFrameFor: () => undefined, DECAL_TEXTURE: 'wall-decals', UPRIGHT_LIFT: 5,
});
const s = new TestScene();

const maskGraphics = [];
const makeGraphics = () => {
  const g = {
    calls: [], destroyed: false,
    fillStyle() { return g; },
    fillRect(...args) { g.calls.push(args); return g; },
    createGeometryMask() { return { geometryMask: g }; },
    destroy() { g.destroyed = true; }
  };
  maskGraphics.push(g);
  return g;
};
const sprites = [];
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
sprites.push(sprite);
// Deep-layer windows: one TileSprite per chasm cell, created by syncDeepLayer.
const deep = [];
Object.assign(s, {
  context: {
    map: {
      tileToWorldX: (x) => x * 16, tileToWorldY: (y) => y * 16,
      widthInPixels: 16, heightInPixels: 16
    }
  },
  cameras: { main: { scrollX: 0, scrollY: 0 } },
  time: { now: 0 },
  add: {
    sprite: (_x, _y, texture, frame) => sprite.setTexture(texture, frame),
    tileSprite: (x, y, width, height, texture) => {
      const cell = {
        x, y, width, height, visible: true, depth: -1, texture,
        tilePositionX: 999, tilePositionY: 999, origins: [], destroyed: false,
        setOrigin(...args) { this.origins.push(args); return this; },
        setDepth(depth) { this.depth = depth; return this; },
        setPosition(px, py) { this.x = px; this.y = py; return this; },
        setSize(w, h) { this.width = w; this.height = h; return this; },
        setVisible(visible) { this.visible = visible; return this; },
        destroy() { this.destroyed = true; }
      };
      deep.push(cell);
      return cell;
    }
  },
  make: { graphics: makeGraphics },
  featureSprites: new Map(), wallSprites: new Map(), seen: [], lastWaterStep: -1
});

s.syncFeatures();
assert.equal(sprite.texture, CHASM_TEXTURE, 'the chasm uses the depth atlas, not the tinted placeholder tile');
assert.equal(sprite.frame, 15, 'an isolated chasm cell selects the fully edged frame');
assert.equal(sprite.tint, 0xffffff, 'no tint is applied over the generated art');
assert.equal(sprite.depth, CHASM_SURFACE_DEPTH, 'the rim draws above the deep layer');
assert.equal(sprite.alpha, 1);
assert.equal(sprite.visible, true);
assert.deepEqual(sprite.origins.at(-1), [CHASM_MARGIN / CHASM_SIZE, CHASM_MARGIN / CHASM_SIZE],
  'the margin is centred on the cell so the rim shadow lands on the neighbours');
assert.equal(s.waterSprites.size, 0, 'the pit is not animated as water');

assert.equal(deep.length, 1, 'one deep window per chasm cell');
const cell = deep[0];
assert.equal(cell.texture, CHASM_DEEP_TEXTURE);
assert.equal(cell.depth, CHASM_DEEP_DEPTH, 'the pit floor sits under the rim sprites');
assert.equal(cell.visible, true);
assert.deepEqual([cell.x, cell.y, cell.width, cell.height], [0, 0, 16, 16], 'the window covers exactly one cell');
assert.deepEqual(cell.origins[0], [0], 'windows are top-left anchored');
assert.equal(cell.tilePositionX, chasmParallaxOffset(0) + cell.x, 'the initial texture offset is deterministic');
assert.equal(maskGraphics.length, 0, 'no geometry mask is created: Phaser 4 only masks in Canvas mode');
s.cameras.main.scrollX = 100;
s.cameras.main.scrollY = 40;
s.updateDeepParallax();
assert.equal(cell.tilePositionX, chasmParallaxOffset(100) + cell.x);
assert.equal(cell.tilePositionY, chasmParallaxOffset(40) + cell.y);
assert.equal(chasmParallaxOffset(0) - (cell.tilePositionX - cell.x), 65, 'the deep layer lags the world');

// Leaving the floor destroys the windows (the rim sprites are gone with it).
state = null;
s.syncFeatures();
assert.equal(deep.length, 1, 'no new windows are created when the chasms are gone');
assert.equal(cell.destroyed, true, 'a floor without chasms destroys the deep windows');
assert.equal(s.deepCells.size, 0);

console.log('Rogue0 chasm visuals: edge masks, rim shadow, cliff face, near lip, deep parallax layer, generated atlases and scene wiring passed');
