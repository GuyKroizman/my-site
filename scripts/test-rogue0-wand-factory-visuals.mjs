import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('wand-factory-visuals');
import assert from 'node:assert/strict';
import {
  generateWandFactoryTextures, createWandFactoryVisuals, updateWandFactoryVisuals,
  clearWandFactoryVisuals, factoryDropFrame, factoryBeltOffset, factoryWandProgress,
  factoryClockAngle, FACTORY_CABINET_TEXTURE, FACTORY_BELT_TEXTURE, FACTORY_CRATE_TEXTURE,
  FACTORY_BOTTLE_TEXTURE, FACTORY_DROP_TEXTURE, FACTORY_WAND_TEXTURE,
  FACTORY_PIPE_TEXTURE, FACTORY_CLOCK_TEXTURE, FACTORY_CLOCK_HAND_TEXTURE,
  FACTORY_BELT_TILES, FACTORY_MACHINE_WIDTH_TILES, FACTORY_MACHINE_HEIGHT_TILES
} from '../src/games/rogue0/wandFactoryVisuals.ts';
import { FIRE_ELEMENTAL_TEXTURE } from '../src/games/rogue0/monsters/fireElementalTexture.ts';
import {
  telegraphTiles, updateTargetTelegraphs, clearTargetTelegraphs, TARGET_BORDER_COLOR
} from '../src/games/rogue0/targetTelegraphVisuals.ts';

// Pure animation selectors never touch gameplay state or RNG.
assert.deepEqual([0, 140, 280, 420, 560].map(t => factoryDropFrame(t)), [0, 1, 2, 3, 0]);
assert.equal(factoryDropFrame(140, 2), 3);
for (const time of [0, 7, 99, 1000, 99999]) assert.ok(factoryBeltOffset(time) >= 16);
assert.equal(factoryBeltOffset(56), 17, 'the belt scroll is half its old speed');
assert.equal(factoryBeltOffset(112), 18);
assert.ok(factoryWandProgress(0, 0) < factoryWandProgress(550, 0));
assert.ok(factoryWandProgress(0, 0) < factoryWandProgress(0, 1));
assert.ok(Math.abs(factoryWandProgress(1100, 0) - 1 / 6) < 1e-9,
  'a wand takes 6.6 seconds to cross the belt, half its previous speed');
assert.notEqual(factoryClockAngle(0), factoryClockAngle(500));

function makeGraphics() {
  return {
    strokes: [], fills: [], textures: [],
    clear() { this.strokes = []; this.fills = []; return this; },
    fillStyle(color, alpha) { this.fillColor = color; this.fillAlpha = alpha; return this; },
    fillRect(x, y, w, h) { this.fills.push({ x, y, w, h, color: this.fillColor }); return this; },
    lineStyle(width, color, alpha) {
      this.lineWidth = width; this.lineColor = color; this.lineAlpha = alpha; return this;
    },
    strokeRect(x, y, w, h) {
      this.strokes.push({ x, y, w, h, width: this.lineWidth, color: this.lineColor });
      return this;
    },
    generateTexture(key) { this.textures.push(key); return this; },
    setDepth(depth) { this.depth = depth; return this; },
    setVisible(visible) { this.visible = visible; return this; },
    destroy() { this.destroyed = true; }
  };
}

function makeScene() {
  const textures = new Set();
  const sprites = [];
  const graphics = [];
  const scene = {
    textures: {
      exists: key => textures.has(key),
      create: key => textures.add(key)
    },
    make: {
      graphics: () => {
        const g = makeGraphics();
        const generate = g.generateTexture.bind(g);
        g.generateTexture = key => { textures.add(key); return generate(key); };
        return g;
      }
    },
    add: {
      sprite(x, y, key) {
        const sprite = { kind: 'sprite', x, y, key, visible: true, alpha: 1,
          setOrigin() { return this; }, setDepth(d) { this.depth = d; return this; },
          setVisible(v) { this.visible = v; return this; },
          setTexture(key) { this.key = key; return this; },
          setAlpha(a) { this.alpha = a; return this; },
          destroy() { this.destroyed = true; } };
        sprites.push(sprite);
        return sprite;
      },
      tileSprite(x, y, w, h, key) {
        const sprite = { kind: 'tile', x, y, width: w, height: h, key, visible: true,
          tilePositionX: 0, setOrigin() { return this; }, setDepth(d) { this.depth = d; return this; },
          setVisible(v) { this.visible = v; return this; },
          destroy() { this.destroyed = true; } };
        sprites.push(sprite);
        return sprite;
      },
      graphics() { const g = makeGraphics(); graphics.push(g); return g; }
    },
    map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 }
  };
  return { scene, textures, sprites, graphics };
}

const hall = { x: 32, y: 22, w: 16, h: 16 };

{
  const { scene, textures, sprites } = makeScene();
  const originalRandom = Math.random;
  try {
    Math.random = () => { throw new Error('factory visuals must not roll gameplay RNG'); };
    generateWandFactoryTextures(scene);
    for (const key of [FACTORY_CABINET_TEXTURE, FACTORY_BELT_TEXTURE, FACTORY_CRATE_TEXTURE,
      FACTORY_BOTTLE_TEXTURE, FACTORY_PIPE_TEXTURE, FACTORY_CLOCK_TEXTURE,
      FACTORY_CLOCK_HAND_TEXTURE, FIRE_ELEMENTAL_TEXTURE,
      FACTORY_DROP_TEXTURE(0), FACTORY_DROP_TEXTURE(3)]) {
      assert.equal(textures.has(key), true, `${key} is generated`);
    }
    createWandFactoryVisuals(scene, hall, scene.map);
    assert.equal(FACTORY_MACHINE_WIDTH_TILES, 5);
    assert.equal(FACTORY_MACHINE_HEIGHT_TILES, 3);
    assert.equal(sprites.length, 17,
      'two cabinets, fire source, pipe, bottle, belt, crate, clocks, hands, drops and wands');
    assert.equal(sprites.filter(s => s.key === FACTORY_WAND_TEXTURE).length, 3,
      'the belt carries existing wand art');
    assert.equal(sprites.filter(s => s.key === FIRE_ELEMENTAL_TEXTURE).length, 1,
      'a captured fire elemental feeds the distiller');
    const belt = sprites.find(s => s.kind === 'tile');
    assert.equal(belt.width, FACTORY_BELT_TILES * 16, 'the belt is three tiles long');

    updateWandFactoryVisuals(scene, 0, false, new Set()); // establish the clock baseline
    const before = sprites.map(s => ({ x: s.x, y: s.y, key: s.key, offset: s.tilePositionX }));
    updateWandFactoryVisuals(scene, 500, false, new Set());
    assert.ok(sprites.some((s, i) => s.tilePositionX !== before[i].offset), 'the belt scrolls');
    assert.ok(sprites.some((s, i) => s.key !== before[i].key), 'the drip uses looping frames');
    const wands = sprites.filter(s => s.key === FACTORY_WAND_TEXTURE);
    assert.ok(wands.every((s, i) => s.x < before[sprites.indexOf(s)].x),
      'wands travel from the assembler on the right toward the crate on the left');
    const hands = sprites.filter(s => s.key === FACTORY_CLOCK_HAND_TEXTURE);
    assert.equal(hands.length, 2);
    assert.ok(hands.every(hand => typeof hand.rotation === 'number'), 'clock hands rotate');
    updateWandFactoryVisuals(scene, 6000, false, new Set());
    assert.ok(wands.some(s => s.y > belt.y && s.alpha < 1),
      'a wand drops off the belt into the crate');

    const paused = sprites.map(s => ({ x: s.x, key: s.key, offset: s.tilePositionX }));
    updateWandFactoryVisuals(scene, 5000, true, new Set());
    assert.deepEqual(sprites.map(s => ({ x: s.x, key: s.key, offset: s.tilePositionX })), paused,
      'a modal pause freezes the machines');

    const seen = new Set([`${hall.x + 4},${hall.y + 4}`]);
    updateWandFactoryVisuals(scene, 5100, false, seen);
    assert.equal(sprites.every(s => typeof s.visible === 'boolean'), true);
    assert.ok(sprites.every(s => !s.visible || seen.has(`${hall.x + 3},${hall.y + 4}`) ||
      seen.has(`${hall.x + 4},${hall.y + 4}`)), 'unseen machine tiles are hidden');

    clearWandFactoryVisuals(scene);
    assert.equal(sprites.every(s => s.destroyed), true, 'floor change destroys the props');
    updateWandFactoryVisuals(scene, 6000, false);
  } finally {
    Math.random = originalRandom;
  }
}

// --- Red-bordered target overlay --------------------------------------------
{
  const thrower = { type: 'enemy', name: 'Fire Potion Thrower', telegraphStage: 1,
    targetX: 5, targetY: 6 };
  assert.deepEqual(telegraphTiles(thrower), [{ x: 5, y: 6 }]);
  thrower.telegraphStage = 2;
  assert.equal(telegraphTiles(thrower).length, 9);
  thrower.telegraphStage = 0;
  assert.deepEqual(telegraphTiles(thrower), []);

  const { scene, graphics } = makeScene();
  thrower.telegraphStage = 2;
  updateTargetTelegraphs(scene, [thrower], scene.map, new Set(['5,6', '6,6']));
  const g = graphics[0];
  assert.equal(g.strokes.length, 2, 'only visible tiles are outlined');
  assert.ok(g.strokes.every(s => s.color === TARGET_BORDER_COLOR && s.width === 2));
  assert.equal(g.depth, 300, 'the warning draws above fog');
  assert.equal(g.fills.every(f => f.color === TARGET_BORDER_COLOR), true);
  updateTargetTelegraphs(scene, [{ ...thrower, telegraphStage: 0 }], scene.map, new Set());
  assert.equal(g.destroyed, true, 'a finished telegraph removes its overlay');
  clearTargetTelegraphs(scene);
}

console.log('Wand Factory visuals: generated textures, looping machines, pause/teardown and red target borders passed');
