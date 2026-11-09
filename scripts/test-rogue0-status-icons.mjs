import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('status-icons');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const transpile = (path) => {
  const source = fs.readFileSync(path, 'utf8').replace(/^import.*;$/gm, '');
  const exports = {};
  new Function('exports', ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }))(exports);
  return exports;
};

const icons = transpile('src/games/rogue0/statusIconTextures.ts');
const layoutModule = transpile('src/games/rogue0/statusHudLayout.ts');
const view = transpile('src/games/rogue0/heroViewModel.ts');

const {
  STATUS_ICON_IDS, STATUS_ICON_FRAME_COUNT, STATUS_ICON_SIZE, STATUS_ICON_TEXTURE,
  statusIconFrame, statusIconGlyph, statusIconPalette, statusIconPixels,
  generateStatusIconTextures
} = icons;
const { statusIconLayout, LOG_STRIP_HEIGHT, LOG_STRIP_GAP, HUD_EDGE } = layoutModule;
const { statusDurationLabel } = view;

// --- the icon sheet itself -------------------------------------------------

assert.equal(STATUS_ICON_SIZE, 24, 'icons are drawn at 24x24, one pixel per game pixel');
assert.equal(STATUS_ICON_FRAME_COUNT, STATUS_ICON_IDS.length + 1, 'one frame per effect plus the unknown fallback');
assert.equal(new Set(STATUS_ICON_IDS).size, STATUS_ICON_IDS.length, 'no duplicate icon entries');

for (const id of STATUS_ICON_IDS) {
  const glyph = statusIconGlyph(id);
  assert.equal(glyph.length, 12, `${id}: twelve authored rows`);
  glyph.forEach((row, i) => {
    assert.equal(row.length, 12, `${id} row ${i}: twelve authored columns`);
    assert.match(row, /^[.#+-]{12}$/, `${id} row ${i}: only ink/highlight/shade/transparent`);
  });
  const palette = statusIconPalette(id);
  assert.ok(Number.isInteger(palette.ink) && Number.isInteger(palette.dark), `${id}: has its own palette`);

  const pixels = statusIconPixels(id);
  assert.equal(pixels.length, STATUS_ICON_SIZE * STATUS_ICON_SIZE, `${id}: full 24x24 frame`);
  const drawn = pixels.filter(p => p >= 0);
  assert.ok(drawn.length > 0, `${id}: is not an empty icon`);
  // Art is authored on a 12x12 grid and doubled into 2x2 blocks, so a frame
  // never needs fractional scaling to stay crisp.
  for (let y = 0; y < STATUS_ICON_SIZE; y += 2) {
    for (let x = 0; x < STATUS_ICON_SIZE; x += 2) {
      const block = [pixels[y * 24 + x], pixels[y * 24 + x + 1], pixels[(y + 1) * 24 + x], pixels[(y + 1) * 24 + x + 1]];
      assert.ok(block.every(p => p === block[0]), `${id}: pixel block at ${x},${y} is uniform`);
    }
  }
  const allowed = new Set([palette.ink, palette.light, palette.dark]);
  assert.ok(pixels.every(p => p < 0 || allowed.has(p)), `${id}: every pixel comes from its palette`);
}

// Distinct frames: this is the bug the new art replaced.
const frames = STATUS_ICON_IDS.map(statusIconFrame);
assert.equal(new Set(frames).size, frames.length, 'every effect resolves to a frame of its own');
assert.equal(statusIconFrame('brand-new-effect'), STATUS_ICON_IDS.length, 'unknown effects fall back to the ? icon');
assert.equal(statusIconFrame(''), STATUS_ICON_IDS.length, 'an empty id falls back too');
assert.equal(statusIconGlyph('').length, 12, 'the fallback glyph is a real 12x12 glyph');
assert.notDeepEqual(statusIconPixels('brand-new-effect'), statusIconPixels('burning'), 'the fallback is not borrowed art');

// Every status effect the game can apply must have its own icon. Parsed from
// source so a future effect cannot be added without noticing this test.
const declaredIds = [
  ...fs.readFileSync('src/games/rogue0/effects.ts', 'utf8').matchAll(/id:\s*["']([a-z0-9-]+)["']/g),
  ...fs.readFileSync('src/games/rogue0/items/ChaliceOfBlood.ts', 'utf8').matchAll(/id:\s*["']([a-z0-9-]+)["']/g)
].map(match => match[1]);
const uniqueDeclared = [...new Set(declaredIds)];
assert.ok(uniqueDeclared.length >= 20, 'found the effect ids to check against');
for (const id of uniqueDeclared) {
  assert.ok(STATUS_ICON_IDS.includes(id), `effect "${id}" has a status icon`);
}

// --- the canvas sheet ------------------------------------------------------

const added = [];
const puts = [];
const created = [];
const context = {
  createImageData(width, height) {
    return { width, height, data: new Uint8ClampedArray(width * height * 4) };
  },
  putImageData(image, x, y) { puts.push({ image, x, y }); }
};
let refreshed = 0;
const scene = {
  textures: {
    exists: () => false,
    createCanvas(key, width, height) {
      const texture = {
        key, width, height,
        getContext: () => context,
        add(frame, source, x, y, w, h) { added.push({ frame, source, x, y, w, h }); },
        refresh() { refreshed++; }
      };
      created.push(texture);
      return texture;
    }
  }
};

const random = Math.random;
try {
  Math.random = () => { throw Error('icons must not consume gameplay RNG'); };
  generateStatusIconTextures(scene);
} finally { Math.random = random; }

const sheet = created[0];
assert.equal(created.length, 1, 'builds one sheet');
assert.equal(sheet.key, STATUS_ICON_TEXTURE, 'under the HUD texture key');
assert.equal(sheet.width, STATUS_ICON_SIZE, 'one icon wide');
assert.equal(sheet.height, STATUS_ICON_SIZE * STATUS_ICON_FRAME_COUNT, 'one row per frame');
assert.equal(added.length, STATUS_ICON_FRAME_COUNT, 'registers every frame');
assert.equal(puts.length, STATUS_ICON_FRAME_COUNT, 'writes every frame');
assert.equal(refreshed, 1, 'refreshes the canvas once');
added.forEach((frame, i) => {
  assert.equal(frame.frame, i, 'frames are registered in order');
  assert.equal(frame.w, STATUS_ICON_SIZE, 'frame width');
  assert.equal(frame.h, STATUS_ICON_SIZE, 'frame height');
  assert.equal(frame.y, i * STATUS_ICON_SIZE, 'frame rows stack top to bottom');
});
assert.deepEqual([...puts[0].image.data.slice(0, 4)], [0, 0, 0, 0], 'transparent where the glyph has no ink');
assert.ok(puts[0].image.data.some((v, i) => i % 4 === 3 && v === 255), 'the burning frame has opaque pixels');

generateStatusIconTextures({ textures: { exists: () => true, createCanvas: () => { throw Error('must not rebuild'); } } });
assert.doesNotThrow(
  () => generateStatusIconTextures({ textures: { exists: () => false, createCanvas: () => undefined } }),
  'a scene that cannot create the canvas simply skips the sheet'
);

// --- the HUD column --------------------------------------------------------

const metric = (w) => Math.max(24, Math.min(34, Math.floor((w - 36) / 7)));
const COLUMN = { iconSize: 28, gap: 4 };

const desktop = statusIconLayout({ width: 1280, height: 720, count: 6, toolbarSize: metric(1280), ...COLUMN });
assert.equal(desktop.startX, 8, 'flush with the left edge, like the portrait');
assert.equal(desktop.startY, 8 + 34 + 4, 'starts directly under the portrait button');
assert.ok(desktop.boxes.every(b => b.visible), 'a desktop shows a full column');
assert.equal(desktop.boxes[0].x, 8, 'single column on a desktop');
assert.ok(desktop.boxes[3].y > desktop.boxes[2].y, 'icons stack downwards');
assert.ok(desktop.boxes[5].y + 28 <= desktop.bottom + 4, 'never reaches the message strip');

const phone = statusIconLayout({ width: 390, height: 844, count: 12, toolbarSize: metric(390), ...COLUMN });
assert.ok(phone.boxes.every(b => b.visible), 'a phone shows all twelve, unlike the old single row of three');
assert.ok(phone.boxes.every(b => b.x === 8), 'a tall phone still uses one column');

const short = statusIconLayout({ width: 844, height: 390, count: 12, toolbarSize: metric(844), ...COLUMN });
assert.ok(short.boxes.every(b => b.visible), 'a short landscape window wraps instead of hiding icons');
assert.equal(short.boxes[0].x, 8, 'the first column starts at the edge');
assert.equal(short.boxes[1].x, 8, 'the first column fills before wrapping');
assert.equal(short.boxes[short.rows].x, 8 + 28 + 4, 'the overflow column sits to the right');
assert.equal(short.boxes[short.rows].y, short.startY, 'a wrapped column starts back at the top');
assert.equal(short.rows * (28 + 4) + short.startY <= short.bottom + 4, true, 'rows stay above the log strip');

const letterbox = statusIconLayout({ width: 260, height: 150, count: 12, toolbarSize: metric(260), ...COLUMN });
assert.ok(letterbox.boxes.some(b => !b.visible), 'a viewport too small for the stack hides the overflow instead of drawing over the log');
for (const box of letterbox.boxes.filter(b => b.visible)) {
  assert.ok(box.x >= HUD_EDGE && box.x + 28 <= 260 - HUD_EDGE, 'visible icons stay on screen');
  assert.ok(box.y + 28 <= letterbox.bottom + 4, 'visible icons stay above the message strip');
}
assert.equal(statusIconLayout({ width: 390, height: 844, count: 0, toolbarSize: 34, ...COLUMN }).boxes.length, 0, 'no effects, no boxes');
assert.equal(
  statusIconLayout({ width: 1280, height: 720, count: 1, toolbarSize: 34, ...COLUMN }).bottom,
  720 - 34 - 8 - LOG_STRIP_HEIGHT - LOG_STRIP_GAP - 6,
  'the column stops where the message strip starts'
);

// --- remaining-turn label --------------------------------------------------

assert.equal(statusDurationLabel({ duration: 20 }), '20', 'a levitation potion reads as 20 turns');
assert.equal(statusDurationLabel({ duration: 1 }), '1', 'the last turn is still shown');
assert.equal(statusDurationLabel({ duration: Number.POSITIVE_INFINITY }), '∞', 'curses never count down');
assert.equal(statusDurationLabel({ duration: 50, manualExpiry: true }), '∞', 'manual-expiry effects read as ∞');

console.log('Rogue0 status icons: 24 own 24x24 icons, distinct frames per effect, '
  + 'block-aligned palettes, canvas sheet, portrait column layout with wrapping and turn badges passed');
