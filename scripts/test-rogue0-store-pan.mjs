import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('store-pan');
import assert from 'node:assert/strict';
import { STORE_ART, shelfSlots, storePanLayout, isPanoramaView, clampPan, panSlotAt } from '../src/games/rogue0/store/storeLayout.ts';
import { NO_PAN_GESTURE, PAN_DRAG_THRESHOLD, panGestureDown, panGestureMove, panGestureUp, panGestureCancel } from '../src/games/rogue0/store/storePanGesture.ts';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

assert.equal(isPanoramaView(360, 640, true), true);
assert.equal(isPanoramaView(390, 844, true), true);
assert.equal(isPanoramaView(1280, 720, true), false);
assert.equal(isPanoramaView(360, 640, false), false);
assert.equal(isPanoramaView(0, 640, true), false);

const layout = storePanLayout(360, 640);
assert.equal(layout.mode, 'panorama');
assert.ok(near(layout.scale, 640 / STORE_ART.height));
assert.ok(near(layout.artHeight, 640));
assert.ok(near(layout.artWidth, STORE_ART.width * 640 / STORE_ART.height));
assert.ok(layout.artWidth > 360, 'art must overflow the portrait viewport');
assert.ok(near(layout.offsetX, (360 - layout.artWidth) / 2));
assert.equal(layout.offsetY, 0);
assert.ok(near(layout.minPanX, -layout.maxPanX));
assert.ok(layout.maxPanX > 0);
assert.throws(() => storePanLayout(0, 100), RangeError);
assert.throws(() => storePanLayout(Infinity, 100), RangeError);

// At every allowed pan the art still covers the full viewport: no black gap.
for (const panX of [layout.minPanX, 0, layout.maxPanX]) {
  const left = layout.offsetX + panX;
  assert.ok(left <= 1e-9, `left edge uncovered at pan ${panX}`);
  assert.ok(left + layout.artWidth >= 360 - 1e-9, `right edge uncovered at pan ${panX}`);
}

assert.equal(clampPan(layout, 1e6), layout.maxPanX);
assert.equal(clampPan(layout, -1e6), layout.minPanX);
assert.equal(clampPan(layout, 12.5), 12.5);
assert.equal(clampPan(layout, NaN), 0);

// Hit testing follows the art as it is dragged. panSlotAt() is a pure inverse
// transform, so feed it points actually inside the viewport rather than the
// offscreen coordinates of every slot.
for (const panX of [layout.minPanX, 0, layout.maxPanX]) {
  shelfSlots().forEach((slot, index) => {
    const sx = layout.offsetX + panX + (slot.x + slot.width / 2) * layout.scale;
    const sy = (slot.y + slot.height / 2) * layout.scale;
    if (sx >= 0 && sx < 360) assert.equal(panSlotAt(layout, panX, sx, sy), index, `slot ${index} at pan ${panX}`);
  });
}
const visibleSlots = (panX) => {
  const hits = new Set();
  for (let sy = 5; sy < 640; sy += 10) {
    for (let sx = 2; sx < 360; sx += 4) {
      const hit = panSlotAt(layout, panX, sx, sy);
      if (hit !== undefined) hits.add(hit);
    }
  }
  return hits;
};
assert.ok(visibleSlots(layout.maxPanX).has(0), 'left column reachable at max pan');
assert.ok(!visibleSlots(layout.maxPanX).has(4), 'right column offscreen at max pan');
assert.ok(visibleSlots(layout.minPanX).has(4), 'right column reachable at min pan');
assert.ok(!visibleSlots(layout.minPanX).has(0), 'left column offscreen at min pan');
assert.equal(panSlotAt(layout, 0, layout.offsetX + 300 * layout.scale, 70 * layout.scale), undefined);

const bounds = { minPanX: -100, maxPanX: 100 };
let gesture = panGestureDown(NO_PAN_GESTURE, 1, 100, 200, 0);
assert.equal(gesture.tracking, true);
let step = panGestureMove(gesture, 1, 100 + PAN_DRAG_THRESHOLD - 1, 200, bounds);
assert.equal(step.action.kind, 'none', 'small movement stays a tap');
step = panGestureMove(step.gesture, 1, 130, 200, bounds);
assert.deepEqual(step.action, { kind: 'pan', panX: 30 });
step = panGestureMove(step.gesture, 1, 500, 200, bounds);
assert.deepEqual(step.action, { kind: 'pan', panX: 100 }, 'pan is clamped');
let release = panGestureUp(step.gesture, 1, 500, 200);
assert.equal(release.action.kind, 'none', 'a drag never becomes a tap');
assert.equal(release.gesture.tracking, false);

gesture = panGestureDown(NO_PAN_GESTURE, 2, 50, 50, -50);
step = panGestureMove(gesture, 2, 70, 50, bounds);
assert.deepEqual(step.action, { kind: 'pan', panX: -30 }, 'drag starts from the current pan');
release = panGestureUp(step.gesture, 2, 70, 50);
assert.equal(release.action.kind, 'none');

gesture = panGestureDown(NO_PAN_GESTURE, 3, 50, 50, 0);
step = panGestureMove(gesture, 3, 50, 200, bounds);
assert.equal(step.action.kind, 'none', 'vertical movement is not a browse gesture');
release = panGestureUp(step.gesture, 3, 52, 200);
assert.deepEqual(release.action, { kind: 'tap', x: 52, y: 200 });

gesture = panGestureDown(NO_PAN_GESTURE, 4, 80, 90, 0);
release = panGestureUp(gesture, 4, 80, 90);
assert.deepEqual(release.action, { kind: 'tap', x: 80, y: 90 });

gesture = panGestureDown(NO_PAN_GESTURE, 5, 10, 10, 0);
assert.equal(panGestureDown(gesture, 6, 20, 20, 0), gesture, 'a second finger is ignored');
assert.equal(panGestureMove(gesture, 6, 200, 10, bounds).action.kind, 'none');
assert.equal(panGestureUp(gesture, 6, 200, 10).action.kind, 'none');
assert.equal(panGestureCancel(gesture).tracking, false);

console.log('Store panorama passed: full-height touch portrait art, clamped drag, tap/drag separation and pan-aware hit testing.');
