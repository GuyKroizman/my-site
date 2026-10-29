import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('hero-burning');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync('src/games/rogue0/heroBurningVisuals.ts', 'utf8').replace(/^import.*;\n/gm, '');
const exports = {};
new Function('exports', ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }))(exports);
const { updateHeroBurning, clearHeroBurning } = exports;
const created = [];
const scene = { add: { graphics() {
  const fire = { rects: [], destroyed: false,
    clear() { this.rects = []; return this; },
    setVisible(v) { this.visible = v; return this; }, setAlpha(a) { this.alpha = a; return this; },
    setDepth(d) { this.depth = d; return this; }, fillStyle() { return this; },
    fillRect(...rect) { this.rects.push(rect); return this; }, destroy() { this.destroyed = true; },
  };
  created.push(fire); return fire;
} } };
const sprite = { x: 32, y: 48, width: 16, height: 24, displayOriginX: 0, displayOriginY: 8,
  scaleX: 1, scaleY: 1, depth: 5, alpha: 1, visible: true };
const hero = { sprite, effects: [], healthPoints: 30 };
updateHeroBurning(scene, hero, 0);
assert.equal(created.length, 0, 'healthy hero has no fire');
hero.effects = [{ id: 'burning', duration: 4 }];
const random = Math.random;
try {
  Math.random = () => { throw Error('visuals must not consume gameplay RNG'); };
  updateHeroBurning(scene, hero, 0);
  const fire = created[0];
  assert.equal(fire.rects.length, 8, 'two small flames, not a particle cloud');
  assert.equal(fire.depth, 5.1);
  for (const [x, y, w, h] of fire.rects) {
    assert.ok(x >= 32 && x + w <= 48);
    assert.ok(y >= 56 && y + h <= 64, 'flames stay within the bottom eight pixels, away from face and torso');
  }
  const initial = structuredClone(fire.rects);
  updateHeroBurning(scene, hero, 120);
  assert.notDeepEqual(fire.rects, initial, 'flames flicker');
  sprite.x += 4; sprite.y += 2; sprite.displayOriginY += 1;
  updateHeroBurning(scene, hero, 0);
  for (let i = 0; i < initial.length; i++) {
    assert.equal(fire.rects[i][0], initial[i][0] + 4, 'follows interpolated movement');
    assert.equal(fire.rects[i][1], initial[i][1] + 1, 'follows the walking bob');
  }
  sprite.visible = false; sprite.alpha = 0.4;
  updateHeroBurning(scene, hero, 240);
  assert.equal(fire.visible, false); assert.equal(fire.alpha, 0.4);
  assert.equal(created.length, 1, 'reuse one graphics object each frame');
  assert.deepEqual(hero.effects, [{ id: 'burning', duration: 4 }], 'visuals cannot tick status effects');
  hero.effects = [];
  updateHeroBurning(scene, hero, 300);
  assert.equal(fire.destroyed, true, 'extinguishing immediately removes flames');
  hero.effects = [{ id: 'burning' }];
  updateHeroBurning(scene, hero, 400);
  hero.healthPoints = 0;
  updateHeroBurning(scene, hero, 500);
  assert.equal(created[1].destroyed, true, 'death removes flames');
  hero.healthPoints = 30;
  updateHeroBurning(scene, hero, 600);
  clearHeroBurning(scene); clearHeroBurning(scene);
  assert.equal(created[2].destroyed, true, 'floor/shutdown cleanup is idempotent');
  updateHeroBurning(scene, hero, 700);
  assert.equal(created.length, 4, 'a still-burning hero recreates the visual after floor travel or load');
  hero.sprite = undefined;
  updateHeroBurning(scene, hero, 800);
  assert.equal(created[3].destroyed, true);
} finally { Math.random = random; }
console.log('Rogue0 hero burning: small flames, movement/bob tracking, visibility, status removal, death and cleanup passed');
