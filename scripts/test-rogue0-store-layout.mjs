import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('store-layout');
import assert from 'node:assert/strict';
import { STORE_ART, shelfSlots, storeLayout, artToScreen, screenToArt, slotAt, moveSelection } from '../src/games/rogue0/store/storeLayout.ts';

const slots = shelfSlots();
assert.equal(slots.length, 15);
slots.forEach((rect, index) => {
  assert.equal(rect.width, 101.2);
  assert.equal(rect.y, [13, 81, 144][Math.floor(index / 5)]);
  assert.equal(rect.y + rect.height, [66, 130, 195][Math.floor(index / 5)]);
  assert.ok(rect.x >= 46 && rect.x + rect.width <= 552 + 1e-9);
  assert.equal(slotAt(rect.x + rect.width / 2, rect.y + rect.height / 2), index);
  assert.equal(slotAt(rect.x + 1, rect.y + rect.height), undefined);
});
for (const [x, y] of [[45, 40], [552, 40], [300, 67], [300, 140], [300, 200], [300, 300]]) {
  assert.equal(slotAt(x, y), undefined);
}
for (const [w, h] of [[1920, 1080], [1280, 720], [800, 400], [360, 640], [600, 500], [500, 500], [320, 240]]) {
  const layout = storeLayout(w, h);
  const image = artToScreen({ x: 0, y: 0, ...STORE_ART }, layout);
  assert.ok(image.x >= 0 && image.y >= 0);
  assert.ok(image.x + image.width <= w + 1e-9 && image.y + image.height <= h + 1e-9);
  for (const rect of slots) {
    const screen = artToScreen(rect, layout);
    const point = screenToArt(screen.x + screen.width / 2, screen.y + screen.height / 2, layout);
    assert.ok(Math.abs(point.x - rect.x - rect.width / 2) < 1e-9);
    assert.equal(slotAt(point.x, point.y), slots.indexOf(rect));
  }
}
assert.equal(storeLayout(360, 640).mode, 'stacked');
assert.equal(storeLayout(1280, 720).mode, 'overlay');
for (let i = 0; i < 15; i++) {
  assert.equal(moveSelection(i, -1, 0), i % 5 ? i - 1 : i);
  assert.equal(moveSelection(i, 1, 0), i % 5 < 4 ? i + 1 : i);
  assert.equal(moveSelection(i, 0, -1), i >= 5 ? i - 5 : i);
  assert.equal(moveSelection(i, 0, 1), i < 10 ? i + 5 : i);
}
assert.throws(() => storeLayout(0, 100), RangeError);
assert.throws(() => storeLayout(Infinity, 100), RangeError);
console.log('Store layout passed: 15 shelf slots, clamped navigation, uncropped layout and inverse hit testing.');
