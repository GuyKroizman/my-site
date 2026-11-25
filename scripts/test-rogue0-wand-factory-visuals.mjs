import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('wand-factory-visuals');
import assert from 'node:assert/strict';
import {
  generateWandFactoryTextures, createWandFactoryVisuals, updateWandFactoryVisuals,
  clearWandFactoryVisuals, factoryMachineFrame, factoryMachinePixels, factoryBeltOffset,
  factoryWandProgress, FACTORY_ASSEMBLER_TEXTURE, FACTORY_DISTILLER_TEXTURE,
  FACTORY_BELT_TEXTURE, FACTORY_CRATE_TEXTURE, FACTORY_WAND_TEXTURE, FACTORY_FRAMES,
  FACTORY_BELT_TILES, FACTORY_MACHINE_WIDTH_TILES, FACTORY_MACHINE_HEIGHT_TILES,
  FACTORY_OUT_OF_SIGHT_ALPHA
} from '../src/games/rogue0/wandFactoryVisuals.ts';
import {
  telegraphTiles, updateTargetTelegraphs, clearTargetTelegraphs, TARGET_BORDER_COLOR
} from '../src/games/rogue0/targetTelegraphVisuals.ts';

// Pure animation selectors never touch gameplay state or RNG.
assert.deepEqual([0, 180, 360, 2700, 2880].map(factoryMachineFrame), [0, 1, 2, 15, 0]);
for (const kind of ['assembler', 'distiller']) {
  const frames = Array.from({ length: FACTORY_FRAMES }, (_,i) => factoryMachinePixels(kind, i));
  assert.equal(frames[0].length, kind === 'assembler' ? 48 : 64);
  assert.ok(frames.every(rows => rows.every(row => row.length === (kind === 'assembler' ? 80 : 64))));
  assert.ok(frames.flat(2).every(color => Number.isInteger(color) && color >= -1 && color <= 0xffffff));
  assert.equal(new Set(frames.map(f => JSON.stringify(f))).size, FACTORY_FRAMES,
    'every native-pixel animation frame is distinct');
  assert.deepEqual(factoryMachinePixels(kind, 0), frames[0], 'pixel generation is deterministic');
}
const empty = factoryMachinePixels('distiller', 0);
const filled = factoryMachinePixels('distiller', 12);
assert.notEqual(empty[58][50], filled[58][50], 'liquid flame fills the bottle');
assert.equal(factoryMachinePixels('distiller', 15)[58][50], empty[58][50], 'bottle resets empty');
assert.notDeepEqual(factoryMachinePixels('assembler', 0).slice(26, 34),
  factoryMachinePixels('assembler', 4).slice(26, 34), 'the stamping piston reciprocates');
for (const time of [0, 7, 99, 1000, 99999]) assert.ok(factoryBeltOffset(time) >= 16);
assert.equal(factoryBeltOffset(56), 17, 'the belt scroll is half its old speed');
assert.equal(factoryBeltOffset(112), 18);
assert.ok(factoryWandProgress(0, 0) < factoryWandProgress(550, 0));
assert.ok(factoryWandProgress(0, 0) < factoryWandProgress(0, 1));
assert.ok(Math.abs(factoryWandProgress(1100, 0) - 1 / 6) < 1e-9,
  'a wand takes 6.6 seconds to cross the belt, half its previous speed');

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
  const atlasFrames = new Map();
  const textureSizes = new Map();
  const sprites = [];
  const graphics = [];
  const scene = {
    textures: {
      exists: key => textures.has(key),
      get: key => ({ add(name, source, x, y, w, h) {
        const [width, height] = textureSizes.get(key);
        assert.ok(x >= 0 && y >= 0 && x + w <= width && y + h <= height, 'atlas frame fits texture');
        atlasFrames.set(`${key}/${name}`, { x, y, w, h });
      } })
    },
    make: {
      graphics: () => {
        const g = makeGraphics();
        const generate = g.generateTexture.bind(g);
        g.generateTexture = (key, w, h) => {
          textures.add(key); textureSizes.set(key, [w, h]); return generate(key);
        };
        return g;
      }
    },
    add: {
      sprite(x, y, key, frame) {
        const sprite = { kind: 'sprite', x, y, key, frame, visible: true, alpha: 1,
          setOrigin() { return this; }, setDepth(d) { this.depth = d; return this; },
          setFrame(f) {
            assert.ok(atlasFrames.has(`${this.key}/${f}`), 'animation frame is registered');
            this.frame = f; return this;
          },
          setVisible(v) { this.visible = v; return this; },
          setTexture(key) { this.key = key; return this; },
          setAlpha(a) { this.alpha = a; return this; },
          destroy() { this.destroyed = true; } };
        sprites.push(sprite);
        return sprite;
      },
      tileSprite(x, y, w, h, key) {
        const sprite = { kind: 'tile', x, y, width: w, height: h, key, visible: true, alpha: 1,
          tilePositionX: 0, setOrigin() { return this; }, setDepth(d) { this.depth = d; return this; },
          setVisible(v) { this.visible = v; return this; }, setAlpha(a) { this.alpha = a; return this; },
          destroy() { this.destroyed = true; } };
        sprites.push(sprite);
        return sprite;
      },
      graphics() { const g = makeGraphics(); graphics.push(g); return g; }
    },
    map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16,
      worldToTileX: x => Math.floor(x / 16), worldToTileY: y => Math.floor(y / 16) }
  };
  return { scene, textures, sprites, graphics, atlasFrames };
}

const hall = { x: 32, y: 22, w: 16, h: 16 };

{
  const { scene, textures, sprites, atlasFrames } = makeScene();
  const originalRandom = Math.random;
  try {
    Math.random = () => { throw new Error('factory visuals must not roll gameplay RNG'); };
    generateWandFactoryTextures(scene);
    for (const key of [FACTORY_ASSEMBLER_TEXTURE, FACTORY_DISTILLER_TEXTURE,
      FACTORY_BELT_TEXTURE, FACTORY_CRATE_TEXTURE]) {
      assert.equal(textures.has(key), true, `${key} is generated`);
    }
    createWandFactoryVisuals(scene, hall, scene.map);
    assert.equal(FACTORY_MACHINE_WIDTH_TILES, 5);
    assert.equal(FACTORY_MACHINE_HEIGHT_TILES, 3);
    assert.equal(sprites.length, 38, '31 fog-clipped machine tiles, three belt tiles, crate and three wands');
    assert.equal(atlasFrames.size, 31 * FACTORY_FRAMES, 'all tile animation frames exist');
    const count = atlasFrames.size;
    generateWandFactoryTextures(scene);
    assert.equal(atlasFrames.size, count, 'texture generation is idempotent');
    assert.equal(sprites.filter(s => s.key === FACTORY_WAND_TEXTURE).length, 3,
      'the belt carries existing wand art');
    const belts = sprites.filter(s => s.kind === 'tile');
    const belt = belts[0];
    assert.equal(belts.reduce((w, s) => w + s.width, 0), FACTORY_BELT_TILES * 16,
      'the fog-clipped belt is three tiles long');
    assert.deepEqual(belts.map(s => s.x), [41, 42, 43].map(x => x * 16));

    updateWandFactoryVisuals(scene, 0, false, new Set()); // establish the clock baseline
    const before = sprites.map(s => ({ x: s.x, y: s.y, frame: s.frame, offset: s.tilePositionX }));
    updateWandFactoryVisuals(scene, 500, false, new Set());
    assert.ok(sprites.some((s, i) => s.tilePositionX !== before[i].offset), 'the belt scrolls');
    assert.ok(sprites.some((s, i) => s.frame !== before[i].frame), 'gears, steam, gauges and bottling animate');
    const wands = sprites.filter(s => s.key === FACTORY_WAND_TEXTURE);
    assert.ok(wands.every((s, i) => s.x < before[sprites.indexOf(s)].x),
      'wands travel from the assembler on the right toward the crate on the left');
    assert.ok(sprites.every(s => Number.isInteger(s.x) && Number.isInteger(s.y)),
      'moving parts remain on native pixels');
    // Everything is in sight: out-of-FOV dimming does not mask the fade.
    const sight = () => new Set(sprites.map(s => `${Math.floor(s.x / 16)},${Math.floor(s.y / 16)}`));
    // Everything is in sight: out-of-FOV dimming does not mask the fade.
    updateWandFactoryVisuals(scene, 6000, false, sight());
    assert.ok(wands.some(s => s.y > belt.y && s.x < belt.x),
      'a wand drops off the left lip toward the crate, still opaque during its fall');
    updateWandFactoryVisuals(scene, 6400, false, sight());
    assert.ok(wands.some(s => s.y > belt.y && s.alpha < 1),
      'a wand fades only as it enters the crate');

    const snapshot = () => sprites.map(s => ({ x: s.x, y: s.y, frame: s.frame,
      alpha: s.alpha, offset: s.tilePositionX }));
    const paused = snapshot();
    updateWandFactoryVisuals(scene, 7000, true, sight());
    assert.deepEqual(snapshot(), paused,
      'a modal pause freezes the machines');

    // Machines are decorative floor art: always drawn; out of FOV they dim
    // like the player cursor outside sight instead of being hidden.
    const seen = new Set([`${hall.x + 4},${hall.y + 4}`]);
    updateWandFactoryVisuals(scene, 7100, false, seen);
    for (const s of sprites) {
      assert.equal(s.visible, true, 'machines, belts, crate and wands stay drawn');
      const inSight = seen.has(`${Math.floor(s.x / 16)},${Math.floor(s.y / 16)}`);
      assert.ok(s.alpha >= 0 && s.alpha <= 1, 'alpha stays in range');
      if (s.key !== FACTORY_WAND_TEXTURE) {
        assert.equal(s.alpha, inSight ? 1 : FACTORY_OUT_OF_SIGHT_ALPHA,
          'machine tiles dim out of sight instead of being hidden');
      }
    }
    const wand = wands[0];
    updateWandFactoryVisuals(scene, 7100, true, new Set());
    assert.equal(wand.visible, true, 'wands stay drawn while paused');

    clearWandFactoryVisuals(scene);
    assert.equal(sprites.every(s => s.destroyed), true, 'floor change destroys the props');
    updateWandFactoryVisuals(scene, 8000, false);
    createWandFactoryVisuals(scene, hall, scene.map);
    const recreated = sprites.filter(s => !s.destroyed);
    assert.equal(recreated.length, 38);
    createWandFactoryVisuals(scene, undefined, scene.map);
    assert.ok(recreated.every(s => s.destroyed), 'leaving the factory tears down all animation');
    clearWandFactoryVisuals(scene);
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
  assert.ok(g.strokes.every(s => s.color === TARGET_BORDER_COLOR && s.width === 1));
  assert.equal(g.depth, 300, 'the warning draws above fog');
  assert.equal(g.fills.every(f => f.color === TARGET_BORDER_COLOR), true);
  updateTargetTelegraphs(scene, [{ ...thrower, telegraphStage: 0 }], scene.map, new Set());
  assert.equal(g.destroyed, true, 'a finished telegraph removes its overlay');
  clearTargetTelegraphs(scene);
}

console.log('Wand Factory visuals: generated textures, looping machines, pause/teardown and red target borders passed');
