import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('trap-visuals');
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
const visuals = evaluate(fs.readFileSync('src/games/rogue0/trapVisuals.ts', 'utf8').replace(/^import.*;\n/gm, ''));
const {
  TRAP_ALPHA, TRAP_TEXTURE, TRAP_KINDS, TRAP_GLYPHS, TRAP_ACCENTS, TRAP_FRAME_COUNT,
  trapPixels, trapFrame, generateTrapTextures
} = visuals;
const SIZE = 16;
const GLYPH_ORIGIN = 3;
const GLYPH_SIZE = 10;

// --- every gameplay trap kind is covered, and nothing extra -----------------
const tilesSource = fs.readFileSync('src/games/rogue0/tiles.ts', 'utf8');
const kindUnion = tilesSource.slice(tilesSource.indexOf('export type TrapKind ='), tilesSource.indexOf(';', tilesSource.indexOf('export type TrapKind =')));
const declaredKinds = [...kindUnion.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
assert.ok(declaredKinds.length >= 9, 'tiles.ts still declares the trap kinds');
assert.deepEqual([...TRAP_KINDS].sort(), [...declaredKinds].sort(), 'every TrapKind has a plate');
assert.equal(TRAP_FRAME_COUNT, TRAP_KINDS.length * 2, 'one armed and one spent frame per kind');

// --- glyph shape -----------------------------------------------------------
const GLYPH_CHARS = new Set(['.', '#', '+', '-']);
for (const kind of TRAP_KINDS) {
  const glyph = TRAP_GLYPHS[kind];
  assert.ok(Array.isArray(glyph), `${kind} has a glyph`);
  assert.equal(glyph.length, GLYPH_SIZE, `${kind} glyph is square`);
  for (const [row, line] of glyph.entries()) {
    assert.equal(line.length, GLYPH_SIZE, `${kind} row ${row} is 10 columns wide`);
    for (const char of line) assert.ok(GLYPH_CHARS.has(char), `${kind} row ${row} uses known glyph ink`);
  }
  // A glyph must be readable at 1x: enough ink to see, never a filled square.
  const ink = glyph.join('').replace(/\./g, '').length;
  assert.ok(ink >= 20, `${kind} glyph draws a legible shape (${ink} px)`);
  assert.ok(ink <= 70, `${kind} glyph leaves the plate face visible (${ink} px)`);
}

// --- the shared plate: identical for every kind and both states ------------
const glyphArea = (index) => {
  const x = index % SIZE;
  const y = Math.floor(index / SIZE);
  return x >= GLYPH_ORIGIN && x < GLYPH_ORIGIN + GLYPH_SIZE && y >= GLYPH_ORIGIN && y < GLYPH_ORIGIN + GLYPH_SIZE;
};
const plateMask = (pixels) => pixels.filter((_, i) => !glyphArea(i));
let referencePlate;
for (const kind of TRAP_KINDS) {
  const armed = trapPixels(kind, false);
  assert.equal(armed.length, SIZE * SIZE, 'one 16x16 tile worth of pixels');
  assert.ok(armed.every(Number.isInteger));
  const outside = plateMask(armed);
  const corners = new Set([0, SIZE - 1, SIZE * (SIZE - 1), SIZE * SIZE - 1]);
  const outsideIndex = armed.map((_, i) => i).filter((i) => !glyphArea(i));
  assert.ok(outside.every((color, n) => corners.has(outsideIndex[n]) ? color === -1 : color >= 0 && color <= 0xffffff),
    'plate body is opaque, corners transparent');
  referencePlate ??= outside;
  assert.deepEqual(outside, referencePlate, `${kind} reuses the exact same plate art`);
  // Rounded corners show the floor through, so neighbouring plates never merge.
  for (const [x, y] of [[0, 0], [SIZE - 1, 0], [0, SIZE - 1], [SIZE - 1, SIZE - 1]]) {
    assert.equal(armed[y * SIZE + x], -1, 'plate corners are transparent');
  }
  assert.deepEqual(trapPixels(kind, false), armed, 'pixels are deterministic');
}
// Spent plates share one artwork too: the fixed crack is part of the plate, so
// only the (drained) glyph may differ between kinds.
let referenceSpent;
for (const kind of TRAP_KINDS) {
  const outside = plateMask(trapPixels(kind, true));
  referenceSpent ??= outside;
  assert.deepEqual(outside, referenceSpent, `${kind} reuses the same spent plate art`);
}

// --- kinds are visually distinguishable -----------------------------------
const signatures = new Map();
for (const kind of TRAP_KINDS) {
  const signature = JSON.stringify(trapPixels(kind, false).filter((_, i) => glyphArea(i)));
  assert.ok(!signatures.has(signature), `${kind} glyph silhouette is unique (clashes with ${signatures.get(signature)})`);
  signatures.set(signature, kind);
}
const accents = new Map();
for (const kind of TRAP_KINDS) {
  const accent = TRAP_ACCENTS[kind];
  assert.ok(accent, `${kind} has an accent palette`);
  for (const role of ['ink', 'light', 'dark']) {
    assert.ok(Number.isInteger(accent[role]) && accent[role] >= 0 && accent[role] <= 0xffffff, `${kind}.${role} is a colour`);
  }
  assert.ok(!accents.has(accent.ink), `${kind} accent is distinct from ${accents.get(accent.ink)}`);
  accents.set(accent.ink, kind);
  const armed = trapPixels(kind, false);
  assert.ok(armed.includes(accent.ink), `${kind} glyph is drawn in its accent colour`);
}

// --- spent frames: same silhouette, drained colour, cracked face -----------
for (const kind of TRAP_KINDS) {
  const armed = trapPixels(kind, false);
  const spent = trapPixels(kind, true);
  assert.notDeepEqual(spent, armed, `${kind} spent plate differs from the armed one`);
  assert.equal(spent.length, SIZE * SIZE);
  assert.equal(trapFrame(kind, true), trapFrame(kind, false) + 1, 'spent frame sits beside its armed frame');
  assert.ok(trapFrame(kind, false) >= 0 && trapFrame(kind, true) < TRAP_FRAME_COUNT, 'frames fit the atlas');
  const silhouette = (pixels) => pixels.map((color) => (color === -1 ? 0 : 1)).join('');
  assert.equal(silhouette(spent), silhouette(armed),
    'spent plate keeps the armed silhouette so the kind stays recognisable');
  // Colour is gone: the accent never survives on a spent plate.
  for (const kindInk of [TRAP_ACCENTS[kind].ink, TRAP_ACCENTS[kind].light]) {
    assert.ok(!spent.includes(kindInk), 'spent plates drop the accent colour');
  }
  // The crack bites through the face without erasing it.
  const glyphClear = spent.filter((color, i) => glyphArea(i) && color === -1).length;
  const armedClear = armed.filter((color, i) => glyphArea(i) && color === -1).length;
  assert.ok(glyphClear <= armedClear, 'a crack never punches new holes into the glyph');
}
assert.equal(trapFrame('teleport', false), 8);
assert.equal(trapFrame('teleport', true), 9);
assert.equal(trapFrame('unknown-kind', false), 0, 'unknown kinds fall back to the first plate');

// --- no gameplay randomness, no gameplay state ----------------------------
const previousRandom = Math.random;
try {
  Math.random = () => { throw Error('trap visuals must not use gameplay randomness'); };
  for (const kind of TRAP_KINDS) { trapPixels(kind, false); trapPixels(kind, true); }
} finally { Math.random = previousRandom; }

// --- atlas generation -----------------------------------------------------
let exists = false, writes = 0, refreshes = 0;
const atlas = new Map();
const scene = {
  textures: {
    exists: (key) => key === TRAP_TEXTURE && exists,
    createCanvas(key, width, height) {
      assert.equal(key, TRAP_TEXTURE);
      assert.deepEqual([width, height], [SIZE, SIZE * TRAP_FRAME_COUNT]);
      exists = true;
      return {
        getContext: () => ({
          createImageData: () => ({ data: new Uint8ClampedArray(SIZE * SIZE * 4) }),
          putImageData(image, x, y) {
            writes++;
            assert.equal(x, 0);
            assert.ok([0, 255].includes(image.data[3]), 'corner pixel is transparent or solid');
          }
        }),
        add(id, source, x, y, w, h) { assert.equal(source, 0); atlas.set(id, [x, y, w, h]); },
        refresh() { refreshes++; }
      };
    }
  }
};
generateTrapTextures(scene);
generateTrapTextures(scene);
assert.equal(atlas.size, TRAP_FRAME_COUNT, 'every frame is registered once');
assert.equal(writes, TRAP_FRAME_COUNT);
assert.equal(refreshes, 1, 'the canvas is built once per texture cache');
for (const [id, [x, y, w, h]] of atlas) {
  assert.equal(x, 0);
  assert.equal(y, id * SIZE);
  assert.deepEqual([w, h], [SIZE, SIZE]);
}

// --- scene wiring ---------------------------------------------------------
let state = { feature: 'trap', trap: 'visible', trapKind: 'fire' };
const source = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
const methods = source.slice(source.indexOf('  private featureVisual('), source.indexOf('  private makeArrowTexture()'));
const { TestScene } = evaluate(`export class TestScene { ${methods} }`, {
  tiles: { FeatureTiles: { water: 206, chasm: 5 } },
  CHASM_TEXTURE: 'chasm-depth', CHASM_MARGIN: 4, CHASM_SIZE: 24,
  chasmMask: () => 0, chasmFrame: (mask) => mask,
  TRAP_TEXTURE, TRAP_ALPHA, trapFrame,
  terrainFor: () => ({ getFeature: () => state?.feature,
    forEachFeature(fn) { if (state) fn(0, 0, state); } }),
  dungeon: { getCurrentLevel: () => [[0]] }, wallOverhang: () => false,
  worldDepth: () => 0, actorOriginY: () => 0,
  // Door textures are named per region by the theme module.
  ...doorBindings,
  dungeonThemeName: () => 'stone', decalFrameFor: () => undefined,
  flatDecalFrameFor: () => undefined, DECAL_TEXTURE: 'wall-decals', UPRIGHT_LIFT: 5,
});
const s = new TestScene();
const sprite = { visible: true, texture: '', frame: -1, tint: 0xffffff,
  setOrigin() { return this; }, setDepth() { return this; },
  setTexture(texture, frame) { this.texture = texture; this.frame = frame; return this; },
  setFrame(frame) { this.frame = frame; return this; },
  setVisible(visible) { this.visible = visible; return this; },
  setAlpha(alpha) { this.alpha = alpha; return this; },
  setTint(tint) { this.tint = tint; return this; }, clearTint() { this.tint = 0xffffff; },
  destroy() { this.destroyed = true; } };
Object.assign(s, { context: { map: { tileToWorldX: (x) => x * 16, tileToWorldY: (y) => y * 16 } },
  time: { now: 0 }, add: { sprite: (_x, _y, texture, frame) => sprite.setTexture(texture, frame) },
  featureSprites: new Map(), wallSprites: new Map(), seen: [], lastWaterStep: -1 });

s.syncFeatures();
assert.equal(sprite.texture, TRAP_TEXTURE, 'traps draw from the plate atlas');
assert.equal(sprite.frame, trapFrame('fire', false), 'an armed fire trap shows its own glyph');
assert.equal(sprite.tint, 0xffffff, 'kind identity no longer rides on a tint');
assert.equal(sprite.visible, true);
assert.equal(sprite.alpha, 0.2, 'traps are drawn at 80% transparency so the floor reads through');
assert.equal(TRAP_ALPHA, 0.2);

state = { feature: 'trap', trap: 'visible', trapKind: 'summon' };
s.syncFeatures();
assert.equal(sprite.frame, trapFrame('summon', false), 'switching kind swaps the frame, not the plate');

state = { feature: 'trap', trap: 'triggered', trapKind: 'summon' };
s.syncFeatures();
assert.equal(sprite.frame, trapFrame('summon', true), 'a spent trap shows the spent frame');
assert.equal(sprite.visible, true, 'spent traps stay visible on the floor');

state = { feature: 'trap', trap: 'hidden', trapKind: 'summon' };
s.syncFeatures();
assert.equal(sprite.visible, false, 'hidden traps are not drawn until revealed');

state = { feature: 'trap', trap: 'visible' };
s.syncFeatures();
assert.equal(sprite.frame, trapFrame('dart', false), 'a trap without a kind falls back to the dart plate');

console.log('Rogue0 trap visuals: shared pressure plate, nine distinct glyphs, drained cracked spent frames, atlas and scene wiring passed');
