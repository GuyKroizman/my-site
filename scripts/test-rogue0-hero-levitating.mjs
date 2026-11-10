import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('hero-levitating');
import assert from 'node:assert/strict';
import { updateHeroLevitating, clearHeroLevitating } from '../src/games/rogue0/heroLevitatingVisuals.ts';
const created = [];
const scene = { add: { graphics() {
  const sheet = { rects: [], fills: [], destroyed: false,
    clear() { this.rects = []; this.fills = []; return this; },
    setVisible(v) { this.visible = v; return this; }, setAlpha(a) { this.alpha = a; return this; },
    setDepth(d) { this.depth = d; return this; },
    fillStyle(color, alpha) { this.fills.push({ color, alpha }); return this; },
    fillRect(...rect) { this.rects.push(rect); return this; }, destroy() { this.destroyed = true; },
  };
  created.push(sheet); return sheet;
} } };
// 16x24 hero art anchored at the cell bottom, matching rendering.actorOriginY.
const sprite = { x: 32, y: 48, width: 16, height: 24, displayOriginX: 0, displayOriginY: 8,
  scaleX: 1, scaleY: 1, depth: 5, alpha: 1, visible: true, tint: 0xffffff };
const hero = { sprite, effects: [], healthPoints: 30 };
const FEET = 64;

updateHeroLevitating(scene, hero, 0);
assert.equal(created.length, 0, 'a grounded hero gets no updraft');
updateHeroLevitating(scene, undefined, 0);
assert.equal(created.length, 0, 'no hero, no updraft');

hero.effects = [{ id: 'levitating', duration: 20 }];
const random = Math.random;
try {
  Math.random = () => { throw Error('visuals must not consume gameplay RNG'); };
  updateHeroLevitating(scene, hero, 0);
  const air = created[0];
  assert.equal(air.rects.length, 15, 'ten downdraft rects (halo + core per lane), the sole line and four puffs');
  assert.equal(air.fills.length, 15, 'each rect gets its own fill style');
  assert.equal(air.depth, 5.05, 'sits just above the hero sprite');
  for (const [, y, , h] of air.rects) {
    assert.ok(y >= FEET, 'every puff starts at or below the drawn soles');
    assert.ok(y + h <= FEET + 15, 'the air stays just under the hero, not a cloud');
  }
  for (const [x] of air.rects.slice(0, 10)) {
    assert.ok(x >= 30 && x + 2 <= 50, 'streaks leave from the footprint, allowing a one-pixel halo');
  }
  assert.deepEqual(air.rects[10], [32, 64, 16, 1], 'a lit line joins the flow to the soles');
  assert.equal(air.fills[0].color, 0x9ad7f2, 'air is pale blue, not fire or ice');
  assert.equal(air.fills[1].color, 0xffffff, 'streaks keep a bright core');
  assert.ok(air.fills.every(f => f.alpha > 0 && f.alpha <= 1), 'alpha stays in range');

  // Flow: lanes travel downward and the puffs slide outward, fading as they go.
  const initial = structuredClone(air.rects);
  const initialFills = air.fills.map(f => f.alpha);
  updateHeroLevitating(scene, hero, 160);
  assert.notDeepEqual(air.rects, initial, 'the updraft animates');
  assert.notDeepEqual(air.fills.map(f => f.alpha), initialFills, 'streaks fade while travelling');
  const travelled = air.rects.slice(0, 10).filter(([, y], i) => y > initial[i][1]).length;
  assert.ok(travelled >= 2, 'at least one lane moved a pixel further down per frame');
  updateHeroLevitating(scene, hero, 640);
  assert.deepEqual(air.rects, initial, 'the cycle repeats deterministically');

  sprite.x += 4;
  updateHeroLevitating(scene, hero, 0);
  for (let i = 0; i < initial.length; i++) {
    assert.equal(air.rects[i][0], initial[i][0] + 4, 'follows interpolated movement');
  }
  sprite.x -= 4;
  // The walking bob raises y and displayOriginY together, so the drawn art
  // does not move and neither should the updraft.
  sprite.y += 2; sprite.displayOriginY += 2;
  updateHeroLevitating(scene, hero, 0);
  assert.deepEqual(air.rects, initial, 'stays glued to the drawn soles during the bob');
  sprite.y -= 2; sprite.displayOriginY -= 2;

  sprite.scaleX = sprite.scaleY = 2;
  updateHeroLevitating(scene, hero, 0);
  const scaledFeet = 48 + (24 - 8) * 2;
  for (const [, y] of air.rects) {
    assert.ok(y >= scaledFeet, 'scaled hero art keeps the air under the soles');
    assert.ok(y <= scaledFeet + 18, 'scaled streaks travel the scaled distance, not a fixed one');
  }
  assert.equal(air.rects[11][2], 6, 'puffs grow with the art');
  sprite.scaleX = sprite.scaleY = 1;

  sprite.visible = false; sprite.alpha = 0.4;
  updateHeroLevitating(scene, hero, 240);
  assert.equal(air.visible, false); assert.equal(air.alpha, 0.4, 'inherits invisibility styling');
  sprite.visible = true; sprite.alpha = 1;

  assert.equal(created.length, 1, 'reuse one graphics object each frame');
  assert.deepEqual(hero.effects, [{ id: 'levitating', duration: 20 }], 'visuals cannot tick status effects');
  assert.equal(sprite.tint, 0xffffff, 'the hero tint (low health, hit flash) is left alone');

  hero.effects = [{ id: 'levitating', duration: 1 }, { id: 'chilled', duration: 2 }];
  updateHeroLevitating(scene, hero, 300);
  assert.equal(air.destroyed, false, 'other effects keep the updraft alive while levitating');
  hero.effects = [{ id: 'chilled', duration: 2 }];
  updateHeroLevitating(scene, hero, 300);
  assert.equal(air.destroyed, true, 'the updraft disappears the moment levitation expires');

  hero.effects = [{ id: 'levitating', duration: 20 }];
  updateHeroLevitating(scene, hero, 400);
  hero.healthPoints = 0;
  updateHeroLevitating(scene, hero, 500);
  assert.equal(created[1].destroyed, true, 'death removes the updraft');
  hero.healthPoints = 30;
  updateHeroLevitating(scene, hero, 600);
  clearHeroLevitating(scene); clearHeroLevitating(scene);
  assert.equal(created[2].destroyed, true, 'floor/shutdown cleanup is idempotent');
  updateHeroLevitating(scene, hero, 700);
  assert.equal(created.length, 4, 'a still-levitating hero recreates the updraft after floor travel or load');
  hero.sprite = undefined;
  updateHeroLevitating(scene, hero, 800);
  assert.equal(created[3].destroyed, true, 'a hero without a sprite clears the updraft');
} finally { Math.random = random; }
console.log('Rogue0 hero levitating: downdraft streaks, outward puffs, cycle, movement/bob/scale tracking, visibility, expiry, death and cleanup passed');
