import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('wand-projectiles');
import assert from 'node:assert/strict';
import { showWandZap, showShockArc, updateWandZaps, clearWandZaps } from '../src/games/rogue0/wandZapVisuals.ts';
const graphics = [];
const scene = { time: { now: 0 }, add: { graphics() {
  const g = { rects: [], setDepth(depth) { this.depth = depth; return this; },
    clear() { this.rects = []; return this; },
    fillStyle(color, alpha) { this.color = color; this.alpha = alpha; return this; },
    fillRect(x, y, w, h) { this.rects.push({ x, y, w, h, color: this.color, alpha: this.alpha }); return this; },
    destroy() { this.destroyed = true; } };
  graphics.push(g); return g;
} } };
const context = { visibleTiles: new Set(Array.from({ length: 20 }, (_, x) => `${x},1`)), simulationTime: 3.5 };
const random = Math.random;
try {
  Math.random = () => { throw Error('projectiles cannot consume gameplay randomness'); };
  const palettes = [];
  for (const damageType of ['fire', 'ice', 'shock']) {
    showWandZap(scene, context, { fromX: 1, fromY: 1, toX: 10, toY: 1, damageType });
    const g = graphics.at(-1);
    assert.equal(g.depth, 98, 'projectiles are below fog');
    const start = Math.max(...g.rects.map(r => r.x));
    updateWandZaps(scene, context, 160, false);
    assert.ok(Math.max(...g.rects.map(r => r.x)) > start, 'bolt travels toward its destination');
    palettes.push(g.rects.map(r => r.color));
    const held = structuredClone(g.rects);
    updateWandZaps(scene, context, 5000, true);
    assert.deepEqual(g.rects, held, 'modal pauses presentation without losing projectile');
    context.visibleTiles.clear();
    updateWandZaps(scene, context, 5000, true);
    assert.ok(g.rects.length > 0, 'bolts fired beyond sight remain visible');
    assert.ok(g.rects.every(r => r.alpha <= 0.35), 'unlit bolt samples are dimmed');
    context.visibleTiles.add('10,1');
    updateWandZaps(scene, context, 5200, false);
    assert.ok(g.rects.length > 0, 'impact flash at destination');
    updateWandZaps(scene, context, 6000, false);
    assert.equal(g.destroyed, true);
    context.visibleTiles = new Set(Array.from({ length: 20 }, (_, x) => `${x},1`));
  }
  assert.notDeepEqual(palettes[0], palettes[1]);
  assert.notDeepEqual(palettes[1], palettes[2]);
  assert.equal(context.simulationTime, 3.5);
  showWandZap(scene, context, { fromX: 1, fromY: 1, toX: 1, toY: 1, damageType: 'ice' });
  assert.ok(graphics.at(-1).rects.every(r => Number.isFinite(r.x) && Number.isFinite(r.y)), 'self-target has no NaN positions');
  clearWandZaps(scene); clearWandZaps(scene);
  assert.equal(graphics.at(-1).destroyed, true, 'floor/shutdown cleanup is idempotent');
  // Secondary arcs are emitted from inside primary impact callbacks. They
  // survive the current update, travel outwards, pause and clean up normally.
  scene.time.now = 10000;
  let impacts = 0;
  showWandZap(scene, context, { fromX: 1, fromY: 1, toX: 3, toY: 1, damageType: 'shock' }, () => {
    impacts++;
    for (let x = 4; x <= 6; x++) showShockArc(scene, context,
      { fromX: 3, fromY: 1, toX: x, toY: 1, damageType: 'shock' });
  });
  const arcs = graphics.at(-1);
  updateWandZaps(scene, context, 10400, false); // primary has expired; arcs must survive
  assert.equal(impacts, 1);
  assert.ok(!arcs.destroyed);
  updateWandZaps(scene, context, 10480, false);
  assert.ok(arcs.rects.some(r => r.x > 56), 'electricity travels from target towards secondary victims');
  const heldArcs = structuredClone(arcs.rects);
  updateWandZaps(scene, context, 11000, true);
  assert.deepEqual(arcs.rects, heldArcs);
  context.visibleTiles.clear();
  updateWandZaps(scene, context, 11100, true);
  assert.equal(arcs.rects.length, 0, 'secondary arcs never reveal unseen victims');
  updateWandZaps(scene, context, 12000, false);
  assert.equal(arcs.destroyed, true);
  assert.equal(impacts, 1, 'no duplicate impact through reentrant arc creation');
} finally { Math.random = random; }
console.log('Rogue0 wand projectiles: elemental trails, travel, impact, beyond-sight dimming, modal pause and lifecycle passed');
