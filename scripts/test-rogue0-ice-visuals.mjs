import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('ice-visuals');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync('src/games/rogue0/iceVisuals.ts', 'utf8').replace(/^import.*;\n/gm, '');
const ice = {};
new Function('exports', ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }))(ice);
const { ICE_TEXTURE, ICE_VARIANTS, iceShoreMask, iceFrame, icePixels, generateIceTexture } = ice;
assert.equal(iceShoreMask(0, 0, () => false), 15);
assert.equal(iceShoreMask(0, 0, () => true), 0);
for (const [x, y, bit] of [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]]) {
  assert.equal(iceShoreMask(0, 0, (nx, ny) => nx !== x || ny !== y), bit);
}
for (let mask = 0; mask < 16; mask++) {
  const variants = new Set();
  for (let variant = 0; variant < ICE_VARIANTS; variant++) {
    const pixels = icePixels(mask, variant);
    assert.equal(pixels.length, 256);
    assert.ok(pixels.every(color => Number.isInteger(color) && color >= -1 && color <= 0xffffff));
    assert.deepEqual(pixels, icePixels(mask, variant));
    variants.add(JSON.stringify(pixels));
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const corner = ((mask & 9) === 9 && x + y < 3) ||
        ((mask & 3) === 3 && 15 - x + y < 3) ||
        ((mask & 6) === 6 && 30 - x - y < 3) ||
        ((mask & 12) === 12 && x + 15 - y < 3);
      assert.equal(pixels[y * 16 + x] === -1, corner, 'only exposed corners reveal floor');
    }
    // No rim across a shared edge; facets retain their unbordered color.
    const interior = icePixels(0, variant);
    for (const [x, y, bit] of [[8, 0, 1], [15, 8, 2], [8, 15, 4], [0, 8, 8]]) {
      assert.equal(pixels[y * 16 + x] !== interior[y * 16 + x], !!(mask & bit));
    }
  }
  assert.equal(variants.size, ICE_VARIANTS, 'all variants are visually distinct');
  for (let x = -8; x <= 8; x++) for (let y = -8; y <= 8; y++) {
    const frame = iceFrame(mask, x, y);
    assert.ok(frame >= mask * ICE_VARIANTS && frame < (mask + 1) * ICE_VARIANTS);
  }
}
assert.notEqual(iceFrame(0, 0, 0), iceFrame(0, 1, 0));
const random = Math.random;
try {
  Math.random = () => { throw Error('ice must not consume gameplay randomness'); };
  icePixels(15, 7); iceFrame(15, 4, 2);
} finally { Math.random = random; }
let exists = false, writes = 0, refreshes = 0;
const frames = new Map();
const scene = { textures: { exists: () => exists, createCanvas(key, width, height) {
  assert.equal(key, ICE_TEXTURE);
  assert.deepEqual([width, height], [16 * ICE_VARIANTS, 256]);
  exists = true;
  return { getContext: () => ({
    createImageData: () => ({ data: new Uint8ClampedArray(1024) }),
    putImageData(image, x, y) {
      writes++;
      icePixels(y / 16, x / 16).forEach((color, i) => {
        assert.deepEqual([...image.data.slice(i * 4, i * 4 + 4)], color < 0 ? [0, 255, 255, 0]
          : [color >> 16, (color >> 8) & 255, color & 255, 255]);
      });
    },
  }), add(id, source, x, y, w, h) {
    assert.equal(source, 0);
    frames.set(id, [x, y, w, h]);
  }, refresh() { refreshes++; } };
} } };
generateIceTexture(scene); generateIceTexture(scene);
assert.equal(writes, 16 * ICE_VARIANTS);
assert.equal(refreshes, 1);
assert.equal(frames.size, writes);
for (const [id, bounds] of frames) {
  assert.deepEqual(bounds, [(id % ICE_VARIANTS) * 16, Math.floor(id / ICE_VARIANTS) * 16, 16, 16]);
}
generateIceTexture({ textures: { exists: () => false, createCanvas: () => null } });
console.log('Rogue0 ice: exposed edges, connected interiors, stable variants, pixel atlas and texture caching passed');
