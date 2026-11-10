import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('hero-chilled');
import assert from 'node:assert/strict';
import { updateHeroChilled, clearHeroChilled } from '../src/games/rogue0/heroChilledVisuals.ts';
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

updateHeroChilled(scene, hero, 0);
assert.equal(created.length, 0, 'an unchilled hero gets no overlay');
updateHeroChilled(scene, undefined, 0);
assert.equal(created.length, 0, 'no hero, no overlay');

hero.effects = [{ id: 'chilled', duration: 10 }];
const random = Math.random;
try {
  Math.random = () => { throw Error('visuals must not consume gameplay RNG'); };
  updateHeroChilled(scene, hero, 0);
  const ice = created[0];
  assert.equal(ice.rects.length, 11, 'one body wash plus ten frost glints');
  assert.equal(ice.fills.length, 11, 'each rect gets its own fill style');
  assert.equal(ice.depth, 5.05, 'sits just above the hero sprite');
  const [wash] = ice.rects;
  assert.deepEqual(wash, [32, 40, 16, 24], 'the wash covers the whole hero art, bob included');
  for (const [x, y, w, h] of ice.rects.slice(1)) {
    assert.ok(x >= 32 && x + w <= 48, 'glints stay within the silhouette horizontally');
    assert.ok(y >= 40 && y + h <= 64, 'glints stay within the silhouette vertically');
  }
  assert.equal(ice.fills[0].color, 0x9fd6ff, 'ice blue, not a white-out');
  assert.ok(ice.fills[0].alpha >= 0.25 && ice.fills[0].alpha <= 0.4, 'the wash stays translucent so the hero reads');
  assert.equal(ice.fills.slice(1).filter(f => f.color === 0xdff3ff).length, 10, 'glints are pale frost');

  const washAlpha = ice.fills[0].alpha;
  const glintAlphas = ice.fills.slice(1).map(f => f.alpha);
  const initial = structuredClone(ice.rects);
  updateHeroChilled(scene, hero, 260);
  assert.notEqual(ice.fills[0].alpha, washAlpha, 'the wash pulses so the debuff reads as active');
  assert.deepEqual(ice.rects, initial, 'pulsing and twinkling never move the overlay');

  // Twinkle: one glint every third index dims as the fixed cycle advances.
  const dimmed = alphas => alphas.filter(a => a < 0.5).length;
  assert.equal(dimmed(glintAlphas), 4, 'four of the ten glints are dim at frame 0');
  updateHeroChilled(scene, hero, 220);
  const twinkled = ice.fills.slice(1).map(f => f.alpha);
  assert.notDeepEqual(twinkled, glintAlphas, 'glints twinkle over time');
  assert.equal(dimmed(twinkled), 3, 'the twinkle step dims a different glint each frame');
  updateHeroChilled(scene, hero, 1980);
  assert.deepEqual(ice.fills.slice(1).map(f => f.alpha), glintAlphas, 'the twinkle pattern repeats deterministically');

  sprite.x += 4; sprite.y += 2; sprite.displayOriginY += 2;
  updateHeroChilled(scene, hero, 0);
  for (let i = 0; i < initial.length; i++) {
    assert.equal(ice.rects[i][0], initial[i][0] + 4, 'follows interpolated movement');
    // The walking bob raises y and displayOriginY together, so the drawn art
    // does not move and neither should the overlay.
    assert.equal(ice.rects[i][1], initial[i][1], 'stays glued to the drawn silhouette during the bob');
  }
  sprite.scaleX = sprite.scaleY = 2;
  updateHeroChilled(scene, hero, 0);
  assert.deepEqual(ice.rects[0], [36, 30, 32, 48], 'scaled hero art is covered exactly');
  assert.deepEqual(ice.rects[1].slice(2), [2, 2], 'glints scale with the art');

  sprite.visible = false; sprite.alpha = 0.4;
  updateHeroChilled(scene, hero, 240);
  assert.equal(ice.visible, false); assert.equal(ice.alpha, 0.4, 'inherits invisibility styling');
  sprite.visible = true; sprite.alpha = 1;

  assert.equal(created.length, 1, 'reuse one graphics object each frame');
  assert.deepEqual(hero.effects, [{ id: 'chilled', duration: 10 }], 'visuals cannot tick status effects');
  assert.equal(sprite.tint, 0xffffff, 'the hero tint (low health, hit flash) is left alone');

  hero.effects = [{ id: 'chilled', duration: 1 }, { id: 'burning', duration: 2 }];
  updateHeroChilled(scene, hero, 300);
  assert.equal(ice.destroyed, false, 'other effects keep the overlay alive while chilled');
  hero.effects = [{ id: 'burning', duration: 2 }];
  updateHeroChilled(scene, hero, 300);
  assert.equal(ice.destroyed, true, 'the overlay disappears the moment chilled expires');

  hero.effects = [{ id: 'chilled' }];
  updateHeroChilled(scene, hero, 400);
  hero.healthPoints = 0;
  updateHeroChilled(scene, hero, 500);
  assert.equal(created[1].destroyed, true, 'death removes the overlay');
  hero.healthPoints = 30;
  updateHeroChilled(scene, hero, 600);
  clearHeroChilled(scene); clearHeroChilled(scene);
  assert.equal(created[2].destroyed, true, 'floor/shutdown cleanup is idempotent');
  updateHeroChilled(scene, hero, 700);
  assert.equal(created.length, 4, 'a still-chilled hero recreates the overlay after floor travel or load');
  hero.sprite = undefined;
  updateHeroChilled(scene, hero, 800);
  assert.equal(created[3].destroyed, true, 'a hero without a sprite clears the overlay');
} finally { Math.random = random; }
console.log('Rogue0 hero chilled: ice wash, ten twinkling glints, pulse, movement/bob/scale tracking, visibility, expiry, death and cleanup passed');
