import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('wall-decals');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function evaluate(source, bindings = {}) {
  const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
  const exports = {};
  new Function('exports', ...Object.keys(bindings), js)(exports, ...Object.values(bindings));
  return exports;
}
const decals = evaluate(fs.readFileSync('src/games/rogue0/wallDecals.ts', 'utf8').replace(/^import.*;\n/gm, ''));
const {
  DECAL_TEXTURE, DECAL_VARIANTS, DECAL_CHANCE, FLAT_DECAL_CHANCE, DECAL_FRAMES,
  decalPixels, decalFrameFor, flatDecalFrameFor, generateWallDecalTextures
} = decals;
const { dungeonThemeName, dungeonTheme } = evaluate(fs.readFileSync('src/games/rogue0/dungeonTheme.ts', 'utf8'));

const THEMES = ['stone', 'crypt', 'sandstone', 'crystal', 'volcanic'];
const KINDS = ['crack', 'vine', 'ore', 'bones', 'moss', 'stain'];
const SIZE = 16;

// --- pixel buffers ---------------------------------------------------------
assert.equal(DECAL_FRAMES.length, THEMES.reduce((n, t) => n + DECAL_FRAMES.filter((f) => f.theme === t).length, 0));
const drawn = [];
for (const entry of DECAL_FRAMES) {
  const pixels = decalPixels(entry.theme, entry.kind, entry.variant);
  assert.equal(pixels.length, SIZE * SIZE);
  assert.ok(pixels.every(Number.isInteger));
  const opaque = pixels.filter((c) => c >= 0);
  assert.ok(opaque.length > 11, `${entry.theme}/${entry.kind}/${entry.variant} draws something`);
  drawn.push(opaque.length);
  assert.ok(opaque.length < 256, `${entry.theme}/${entry.kind}/${entry.variant} keeps the wall visible`);
  assert.ok(pixels.includes(-1), 'decals are transparent overlays');
  assert.ok(opaque.every((c) => c >= 0 && c <= 0xffffff));
  assert.deepEqual(decalPixels(entry.theme, entry.kind, entry.variant), pixels, 'pixels are deterministic');
}

// Enough ink to read at a glance, but never a busy mural.
const averageInk = drawn.reduce((a, b) => a + b, 0) / drawn.length;
assert.ok(averageInk > 16 && averageInk < 34, `decals stay sparse (${averageInk.toFixed(1)}/256 px)`);

// Variants of the same motif must not be clones, and themes must recolor them.
for (const theme of THEMES) {
  for (const kind of new Set(DECAL_FRAMES.filter((f) => f.theme === theme).map((f) => f.kind))) {
    const variants = Array.from({ length: DECAL_VARIANTS }, (_, v) => decalPixels(theme, kind, v).join(','));
    assert.equal(new Set(variants).size, DECAL_VARIANTS, `${theme}/${kind} has distinct variants`);
    assert.ok(KINDS.includes(kind), `unknown decal kind ${kind}`);
  }
}
for (const kind of ['crack', 'bones']) {
  const pixels = THEMES.map((theme) => decalPixels(theme, kind, 0).join(','));
  assert.equal(new Set(pixels).size, THEMES.length, `${kind} uses each theme's palette`);
}

const previousRandom = Math.random;
try {
  Math.random = () => { throw Error('decals must not use gameplay randomness'); };
  for (const entry of DECAL_FRAMES) decalPixels(entry.theme, entry.kind, entry.variant);
  for (let x = 0; x < 40; x++) for (let y = 0; y < 40; y++) {
    decalFrameFor(THEMES[x % THEMES.length], x, y);
    flatDecalFrameFor(THEMES[x % THEMES.length], x, y);
  }
} finally { Math.random = previousRandom; }

// --- placement -------------------------------------------------------------
const seenKinds = new Map(THEMES.map((t) => [t, new Set()]));
const seenVariants = new Set();
let decorated = 0;
let cells = 0;
for (const theme of THEMES) {
  for (let x = 0; x < 60; x++) {
    for (let y = 0; y < 60; y++) {
      cells++;
      const frame = decalFrameFor(theme, x, y);
      assert.equal(frame, decalFrameFor(theme, x, y), 'placement is deterministic');
      if (frame === undefined) continue;
      decorated++;
      const entry = DECAL_FRAMES.find((f) => f.frame === frame);
      assert.ok(entry, 'frame index belongs to the atlas');
      assert.equal(entry.theme, theme, 'decal matches the floor theme');
      seenKinds.get(theme).add(entry.kind);
      if (entry.theme === 'stone') seenVariants.add(entry.variant);
    }
  }
}
const density = decorated / cells * 100;
assert.ok(density >= DECAL_CHANCE - 6 && density <= DECAL_CHANCE + 6, `decorates a sparse minority (${density.toFixed(1)}%)`);
for (const theme of THEMES) {
  assert.ok(seenKinds.get(theme).size >= 3, `${theme} uses its full motif set`);
  const kinds = new Set(DECAL_FRAMES.filter((f) => f.theme === theme).map((f) => f.kind));
  if (theme !== 'crystal' && theme !== 'volcanic') assert.ok(kinds.has('crack'));
}
assert.equal(seenVariants.size, DECAL_VARIANTS, 'all variants appear');
// Unknown theme falls back to stone rather than throwing.
for (let x = 0; x < 20; x++) for (let y = 0; y < 20; y++) {
  assert.equal(decalFrameFor('nonsense', x, y), decalFrameFor('stone', x, y));
  assert.equal(flatDecalFrameFor('nonsense', x, y), flatDecalFrameFor('stone', x, y));
}

// Flat wall tops/sides are larger areas, so they are decorated more sparingly
// and with an independent roll (no wall shows the same motif twice).
let flatDecorated = 0;
let mirrored = 0;
for (const theme of THEMES) {
  for (let x = 0; x < 60; x++) {
    for (let y = 0; y < 60; y++) {
      const flat = flatDecalFrameFor(theme, x, y);
      assert.equal(flat, flatDecalFrameFor(theme, x, y), 'flat placement is deterministic');
      if (flat === undefined) continue;
      flatDecorated++;
      assert.ok(DECAL_FRAMES.some((f) => f.frame === flat && f.theme === theme));
      if (decalFrameFor(theme, x, y) === flat) mirrored++;
    }
  }
}
const flatDensity = flatDecorated / cells * 100;
assert.ok(flatDensity >= FLAT_DECAL_CHANCE - 5 && flatDensity <= FLAT_DECAL_CHANCE + 5,
  `flat walls stay sparse (${flatDensity.toFixed(1)}%)`);
assert.ok(flatDensity < density, 'corridor faces are decorated more than flat wall tops');
assert.ok(mirrored < flatDecorated * 0.2, 'flat and raised rolls are independent');
// Themes are chosen per floor exactly as the dungeon does, all 25 floors.
const byName = new Map(THEMES.map((t) => [t, 0]));
for (let floor = 1; floor <= 25; floor++) {
  const name = dungeonThemeName(floor);
  assert.ok(THEMES.includes(name));
  assert.deepEqual(dungeonTheme(floor), { tiles: `${name}-tiles`, wall: `${name}-wall` });
  for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) if (decalFrameFor(name, x, y) !== undefined) byName.set(name, byName.get(name) + 1);
}
for (const [theme, count] of byName) assert.ok(count > 0, `${theme} walls get decorated floors`);

// --- texture generation ----------------------------------------------------
let createCalls = 0;
let exists = false;
let refreshes = 0;
let writes = 0;
const added = [];
const scene = {
  textures: {
    exists: () => exists,
    createCanvas(key, width, height) {
      createCalls++;
      assert.equal(key, DECAL_TEXTURE);
      const columns = 8;
      assert.equal(width, columns * SIZE);
      assert.equal(height, Math.ceil(DECAL_FRAMES.length / columns) * SIZE);
      exists = true;
      return {
        getContext: () => ({
          createImageData: () => ({ data: new Uint8ClampedArray(SIZE * SIZE * 4) }),
          putImageData(image) {
            writes++;
            assert.ok(image.data.every((v, i) => i % 4 === 3 ? v === 0 || v === 255 : true));
            assert.ok(image.data.some((v, i) => i % 4 === 3 && v === 255));
          }
        }),
        add(id, source, x, y, w, h) { added.push([id, source, x, y, w, h]); },
        refresh() { refreshes++; }
      };
    }
  }
};
generateWallDecalTextures(scene);
generateWallDecalTextures(scene);
assert.equal(createCalls, 1, 'atlas is generated once');
assert.equal(writes, DECAL_FRAMES.length);
assert.equal(refreshes, 1);
assert.equal(added.length, DECAL_FRAMES.length);
assert.deepEqual(added.map((a) => a[0]), DECAL_FRAMES.map((f) => f.frame));
assert.ok(added.every(([, source, , , w, h]) => source === 0 && w === SIZE && h === SIZE));
assert.equal(new Set(added.map(([, , x, y]) => `${x},${y}`)).size, DECAL_FRAMES.length, 'frames do not overlap in the atlas');

// --- scene wiring ----------------------------------------------------------
const scene0 = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
assert.ok(scene0.includes('generateWallDecalTextures(this)'), 'atlas is created at startup');
assert.ok(scene0.includes('private wallDecals'));
assert.ok(scene0.includes('this.syncWallDecal(key, x, y, theme, raised)'), 'decals follow every wall cell');
assert.ok(/setDepth\(raised \? worldDepth\(y \* 16, 'terrain'\) \+ 0\.02 : 0\.3\)/.test(scene0),
  'raised decals sit above their wall face, flat ones just above the tilemap');
assert.ok(/setOrigin\(0, raised \? UPRIGHT_LIFT \/ 16 : 0\)/.test(scene0), 'decals share their wall anchoring');
assert.ok(scene0.includes('for (const decal of this.wallDecals.values()) decal.sprite.destroy()'), 'floor changes clear decals');
// Fog of war: decals hide exactly like their wall.
assert.ok(/Decals follow their wall[\s\S]{0,220}setVisible\(this\.seen\[y\]\?\.\[x\] === true\)/.test(scene0));
assert.ok(scene0.includes("dungeonThemeName(this.context.floor)"), 'theme comes from the current floor');

console.log('Wall decals: pixels, palettes, sparse deterministic placement and atlas generation passed');
