import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('glyph-stones');
import assert from 'node:assert/strict';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
import {
  GLYPH_STONE_TEXTURES, GLYPH_STONE_KINDS, GLYPH_STONE_PALETTES,
  glyphStonePixels, generateGlyphStoneTextures
} from '../src/games/rogue0/glyphStoneTextures.ts';
import { bresenhamLine } from '../src/games/rogue0/fov.ts';
import { floorItemView, presentFloorItem } from '../src/games/rogue0/rendering.ts';
import { createTerrain } from '../src/games/rogue0/terrain.ts';
import { createHeroNavigation } from '../src/games/rogue0/heroNavigation.ts';

// Entity imports Phaser for sprites only; the stone suites use the established
// isolated loader with a coordinate-only init.
const curseData = load('src/games/rogue0/curseData.ts');
const { Entity, removeEntity } = load('src/games/rogue0/entity.ts', {
  ...curseData,
  actionCost: () => 1,
  sfx: { death() {} },
});
Entity.prototype.init = function (context, x, y) {
  this.context = context;
  this.x = x;
  this.y = y;
};

const dungeon = {
  logs: [],
  log(context, message) {
    this.logs.push(message);
    context.messages.unshift(message);
  },
};

const GlyphStone = load('src/games/rogue0/items/glyphStone.ts', { Entity }).default;
const blinkModule = load('src/games/rogue0/items/stoneOfBlink.ts', {
  Entity, GlyphStone, dungeon, bresenhamLine, terrainFor: () => terrain, GLYPH_STONE_TEXTURES,
});
const StoneOfBlink = blinkModule.default;
const { canBlinkTo } = blinkModule;
const StoneOfDetectCurse = load('src/games/rogue0/items/stoneOfDetectCurse.ts', {
  Entity, GlyphStone, removeEntity, dungeon, GLYPH_STONE_TEXTURES,
}).default;

let terrain = createTerrain();

// --- Item metadata and stacking category ---
const metaCtx = { messages: [] };
const blinkMeta = new StoneOfBlink(metaCtx);
const curseMeta = new StoneOfDetectCurse(metaCtx);
assert.equal(blinkMeta.name, 'Stone of Blink');
assert.equal(curseMeta.name, 'Stone of Detect Curse');
for (const stone of [blinkMeta, curseMeta]) {
  assert.equal(stone.type, 'item');
  assert.equal(stone.consumable, true);
  assert.equal(stone.equipSlot, 'consumable');
  assert.equal(stone.identified, true, 'glyph stones are recognized on sight');
  assert.equal(stone.count, 1);
  assert.equal(stone.damage(), 0);
}
assert.equal(blinkMeta.textureKey, GLYPH_STONE_TEXTURES.blink);
assert.equal(curseMeta.textureKey, GLYPH_STONE_TEXTURES.detectCurse);
assert.equal(blinkMeta.spriteTextureKey, GLYPH_STONE_TEXTURES.blink);
assert.equal(curseMeta.spriteTextureKey, GLYPH_STONE_TEXTURES.detectCurse);
assert.equal(blinkMeta.throwToUse, true, 'using blink starts throw targeting');
assert.equal(curseMeta.throwToUse, false);
assert.equal(curseMeta.requiresItemTarget, true);

// --- each stone kind has its own artwork -----------------------------------
const STONE_SIZE = 16;
assert.deepEqual([...GLYPH_STONE_KINDS].sort(), ['blink', 'detectCurse']);
const silhouettes = new Map();
const runeInks = new Map();
for (const kind of GLYPH_STONE_KINDS) {
  const pixels = glyphStonePixels(kind);
  assert.equal(pixels.length, STONE_SIZE * STONE_SIZE, `${kind} artwork is a 16x16 tile`);
  assert.deepEqual(pixels, glyphStonePixels(kind), `${kind} pixels are deterministic`);
  assert.ok(pixels.every(color => color === -1 ||
    (Number.isInteger(color) && color >= 0 && color <= 0xffffff)), `${kind} pixels are transparent or colours`);
  for (const corner of [0, STONE_SIZE - 1, STONE_SIZE * (STONE_SIZE - 1), STONE_SIZE * STONE_SIZE - 1]) {
    assert.equal(pixels[corner], -1, `${kind} leaves the tile corners clear`);
  }
  const opaque = pixels.filter(color => color !== -1);
  assert.ok(opaque.length >= 100, `${kind} fills enough of the tile to read as a stone (${opaque.length} px)`);
  const palette = GLYPH_STONE_PALETTES[kind];
  assert.ok(opaque.includes(palette.ink), `${kind} shows its rune ink`);
  assert.ok(opaque.includes(palette.glow), `${kind} highlights part of the rune`);
  assert.ok(!runeInks.has(palette.ink), `${kind} rune ink is unique (clashes with ${runeInks.get(palette.ink)})`);
  runeInks.set(palette.ink, kind);

  // The stone itself, not just the small rune, must differ: compare the whole
  // opaque silhouette as well as the colours it is cut from.
  const silhouette = pixels.map(color => color === -1 ? 0 : 1).join('');
  assert.ok(!silhouettes.has(silhouette), `${kind} stone silhouette is unique (clashes with ${silhouettes.get(silhouette)})`);
  silhouettes.set(silhouette, kind);
}
assert.notEqual(GLYPH_STONE_PALETTES.blink.body, GLYPH_STONE_PALETTES.detectCurse.body,
  'the stones are cut from different-coloured rock');
assert.notEqual(GLYPH_STONE_PALETTES.blink.ink, GLYPH_STONE_PALETTES.detectCurse.ink,
  'the runes are inlaid in different inks');

// --- both textures are generated once, under their own keys -----------------
{
  let graphicsCreated = 0;
  const generated = new Map();
  const scene = {
    textures: { exists: key => generated.has(key) },
    make: {
      graphics() {
        graphicsCreated += 1;
        const cells = [];
        return {
          fillStyle(color) { this.color = color; },
          fillRect(x, y, width, height) { cells.push([x, y, width, height, this.color]); },
          generateTexture(key, width, height) { generated.set(key, { cells: [...cells], width, height }); },
          destroy() {}
        };
      }
    }
  };
  generateGlyphStoneTextures(scene);
  assert.equal(graphicsCreated, GLYPH_STONE_KINDS.length, 'one graphics object per stone kind');
  assert.deepEqual([...generated.keys()].sort(),
    GLYPH_STONE_KINDS.map(kind => GLYPH_STONE_TEXTURES[kind]).sort());
  for (const kind of GLYPH_STONE_KINDS) {
    const texture = generated.get(GLYPH_STONE_TEXTURES[kind]);
    assert.deepEqual([texture.width, texture.height], [STONE_SIZE, STONE_SIZE]);
    const pixels = glyphStonePixels(kind);
    assert.equal(texture.cells.length, pixels.filter(color => color !== -1).length,
      `${kind} paints every opaque pixel once`);
    assert.ok(texture.cells.every(([x, y, w, h]) =>
      Number.isInteger(x) && Number.isInteger(y) && w === 1 && h === 1),
    `${kind} draws one explicit pixel at a time`);
  }
  const before = graphicsCreated;
  generateGlyphStoneTextures(scene);
  assert.equal(graphicsCreated, before, 'existing textures are not regenerated');
}

// --- Floor artwork is half size and centred in the tile --------------------
for (const kind of GLYPH_STONE_KINDS) {
  assert.deepEqual(floorItemView(GLYPH_STONE_TEXTURES[kind]), { scale: 0.5, centred: true },
    `${kind} is drawn half size and centred on its tile`);
}
assert.deepEqual(floorItemView('potion-3'), { scale: 0.5, centred: true },
  'potions are half size too, centred on the tile');
assert.deepEqual(floorItemView(undefined), { scale: 1, centred: false },
  'ordinary items still fill their whole tile');
{
  const tileX = 5 * 16, tileY = 7 * 16;
  const calls = [];
  const sprite = {
    x: tileX, y: tileY,
    setScale(scale) { calls.push(['scale', scale]); return this; },
    setPosition(x, y) { calls.push(['position', x, y]); this.x = x; this.y = y; return this; }
  };
  presentFloorItem(sprite, GLYPH_STONE_TEXTURES.blink);
  // Half-scale art is 8px wide, so it needs 4px of the unused cell on each
  // side: the artwork ends up spanning the middle of the tile, not its corner.
  assert.deepEqual(calls, [['scale', 0.5], ['position', tileX + 4, tileY + 4]],
    'the stone centres on the tile x/y');
  assert.equal(sprite.x + 16 * 0.5 / 2, tileX + 8, 'the stone centre matches the tile centre');

  const untouched = {
    x: tileX, y: tileY,
    setScale() { throw new Error('full-tile items are not scaled'); },
    setPosition() { throw new Error('full-tile items are not moved'); }
  };
  presentFloorItem(untouched, undefined);
}

// --- Trample drop odds: independent chance then a rune choice ---
const { GLYPH_STONE_TRAMPLE_CHANCE, rollGlyphStoneKind, createGlyphStone,
  dropTrampledGlyphStone } =
  load('src/games/rogue0/glyphStoneDrop.ts', { StoneOfBlink, StoneOfDetectCurse });
const seq = values => {
  let index = 0;
  return () => values[index++] ?? 0.99;
};
assert.equal(GLYPH_STONE_TRAMPLE_CHANCE, 0.12);
assert.equal(rollGlyphStoneKind(seq([0.12])), undefined, 'at or above the chance finds nothing');
assert.equal(rollGlyphStoneKind(seq([0.99])), undefined);
assert.equal(rollGlyphStoneKind(seq([0, 0])), 'blink');
assert.equal(rollGlyphStoneKind(seq([0, 0.499])), 'blink');
assert.equal(rollGlyphStoneKind(seq([0, 0.5])), 'detect-curse');
assert.ok(createGlyphStone(metaCtx, 'blink') instanceof StoneOfBlink);
assert.ok(createGlyphStone(metaCtx, 'detect-curse') instanceof StoneOfDetectCurse);

// --- A trample find stays on the floor, never in the backpack ---
{
  const ctx = { entities: [], messages: [] };
  const stone = dropTrampledGlyphStone(ctx, 2, 3, seq([0, 0]));
  assert.ok(stone instanceof StoneOfBlink);
  assert.deepEqual([stone.x, stone.y], [2, 3], 'the stone rests on the trampled tile');
  assert.equal(ctx.entities.includes(stone), true, 'it is on the floor for a later pickup');
  assert.equal(stone.count, 1);
  assert.equal(dropTrampledGlyphStone(ctx, 2, 4, seq([0.99])), undefined);
  assert.equal(ctx.entities.length, 1, 'a missed roll leaves no stone behind');
}

// --- Blink destination: exact free tile only, like any thrown item ---
function blinkScene() {
  terrain = createTerrain();
  const player = Object.assign(new Entity(), {
    type: 'player', x: 1, y: 1, healthPoints: 10,
    walkPath: [2, 2], inputBuffer: ['x'],
    sprite: { position: undefined,
      setPosition(x, y) { this.position = { x, y }; } },
  });
  const ctx = {
    entities: [player], messages: [], player,
    currentLevel: Array.from({ length: 6 }, () => Array(7).fill(0)),
    map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 },
  };
  player.context = ctx;
  return { ctx, player };
}

{
  const { ctx, player } = blinkScene();
  assert.equal(canBlinkTo(ctx, player, 4, 2), true);
  const enemy = Object.assign(new Entity(), {
    type: 'enemy', x: 3, y: 2, healthPoints: 5,
  });
  ctx.entities.push(enemy);
  assert.equal(canBlinkTo(ctx, player, 3, 2), false,
    'an occupied landing tile is not a blink destination');
  ctx.currentLevel[2][4] = 1;
  assert.equal(canBlinkTo(ctx, player, 4, 2), false, 'walls are never blink destinations');
  ctx.currentLevel[2][4] = 0;
  terrain.setFeature(4, 3, 'chasm');
  assert.equal(canBlinkTo(ctx, player, 4, 3), false, 'chasms are never blink destinations');
}

{
  const { ctx, player } = blinkScene();
  const stone = new StoneOfBlink(ctx, 1, 1);
  ctx.entities.push(stone);
  assert.equal(stone.onThrownLand(5, 3), true);
  assert.deepEqual([player.x, player.y], [5, 3]);
  assert.deepEqual(player.sprite.position, { x: 80, y: 48 });
  assert.deepEqual(player.walkPath, []);
  assert.deepEqual(player.inputBuffer, []);
  assert.match(dungeon.logs.at(-1), /carries you/);
}

{
  // A living actor blocks the stone like any thrown item. The hero is carried
  // to the last clear tile before the blocker, never around or beyond it.
  const { ctx, player } = blinkScene();
  const enemy = Object.assign(new Entity(), {
    type: 'enemy', name: 'Goblin', x: 4, y: 1, healthPoints: 5,
  });
  const stone = new StoneOfBlink(ctx, 1, 1);
  ctx.entities.push(enemy, stone);
  assert.equal(stone.onThrownLand(4, 1), true);
  assert.deepEqual([player.x, player.y], [3, 1]);
  assert.match(dungeon.logs.at(-1), /stopped by Goblin/);
}

{
  // An adjacent blocker leaves no clear tile to land on: the stone is still
  // consumed, but the hero does not move.
  const { ctx, player } = blinkScene();
  const enemy = Object.assign(new Entity(), {
    type: 'enemy', name: 'Goblin', x: 2, y: 1, healthPoints: 5,
  });
  const stone = new StoneOfBlink(ctx, 1, 1);
  ctx.entities.push(enemy, stone);
  const before = [player.x, player.y];
  assert.equal(stone.onThrownLand(2, 1), true);
  assert.deepEqual([player.x, player.y], before);
  assert.match(dungeon.logs.at(-1), /stopped by Goblin/);
}

{
  // A chasm is a one-way trip: the stone is consumed, the scene descends, and
  // the hero takes no fall damage.
  const { ctx, player } = blinkScene();
  ctx.floor = 3;
  ctx.maxFloor = 25;
  terrain.setFeature(4, 3, 'chasm');
  const stone = new StoneOfBlink(ctx, 1, 1);
  ctx.entities.push(stone);
  const health = player.healthPoints;
  assert.equal(stone.onThrownLand(4, 3), true);
  assert.equal(player.healthPoints, health, 'the blink fall is not damage yet');
  assert.equal(ctx.pendingFall, true);
  assert.equal(ctx.pendingBlinkFall, true);
  assert.deepEqual([player.x, player.y], [1, 1], 'floor placement waits for the scene');
  assert.match(dungeon.logs.at(-1), /pulls you through/);
}

{
  // There is no floor below the abyss, so the stone is simply consumed.
  const { ctx, player } = blinkScene();
  ctx.floor = 25;
  ctx.maxFloor = 25;
  terrain.setFeature(4, 3, 'chasm');
  const stone = new StoneOfBlink(ctx, 1, 1);
  ctx.entities.push(stone);
  assert.equal(stone.onThrownLand(4, 3), true);
  assert.equal(ctx.pendingFall, undefined);
  assert.match(dungeon.logs.at(-1), /vanishes into the abyss/);
}

{
  // A non-floor, non-chasm landing is handed back to the normal thrown-item
  // path (walls are already rejected before the stone lands).
  const { ctx, player } = blinkScene();
  ctx.currentLevel = [
    [1, 1, 1, 1, 1],
    [1, 0, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
  ];
  player.x = 1;
  player.y = 1;
  const stone = new StoneOfBlink(ctx, 1, 1);
  ctx.entities.push(stone);
  const before = [player.x, player.y];
  assert.equal(stone.onThrownLand(2, 2), false);
  assert.deepEqual([player.x, player.y], before);
}

// --- Detect curse: reveal only the curse state, never the identity ---
function detectScene() {
  const player = Object.assign(new Entity(), {
    type: 'player', x: 1, y: 1, healthPoints: 10,
    backpack: [], actions: [],
    getAllItems() { return this.backpack; },
    removeItem(item) {
      if (item.count > 1) { item.count -= 1; return; }
      this.backpack = this.backpack.filter(candidate => candidate !== item);
    },
    canAct() { return true; },
    spendTurn(action) { this.actions.push(action); },
  });
  const ctx = { entities: [player], messages: [], player };
  player.context = ctx;
  return { ctx, player };
}

{
  const { ctx, player } = detectScene();
  const target = Object.assign(new Entity(), {
    name: 'Sword', type: 'item', equipSlot: 'weapon', tier: 1, level: 0,
    identified: false, cursed: true, curseId: 'wayward', context: ctx,
  });
  const stone = new StoneOfDetectCurse(ctx);
  ctx.entities.push(stone);
  player.backpack.push(target, stone);

  assert.equal(stone.canTargetItem(target), true);
  assert.equal(stone.canTargetItem(stone), false, 'the stone cannot scry itself');
  assert.equal(stone.useOnItem(target), true);
  assert.equal(target.identified, false, 'detect curse never identifies the item');
  assert.equal(target.curseScanned, true);
  assert.match(target.curseDescription, /cursed/);
  assert.doesNotMatch(target.curseDescription, /Wayward/);
  assert.match(dungeon.logs.at(-1), /is cursed/);
  assert.deepEqual(player.actions, ['use']);
  assert.equal(player.backpack.includes(stone), false, 'the stone is consumed');
  assert.equal(ctx.entities.includes(stone), false);
  assert.equal(stone.canTargetItem(target), false, 'one reading per item is enough');
}

{
  const { ctx, player } = detectScene();
  const target = Object.assign(new Entity(), {
    name: 'Ring', type: 'item', equipSlot: 'ring', identified: false,
    cursed: false, context: ctx,
  });
  const stone = new StoneOfDetectCurse(ctx);
  ctx.entities.push(stone);
  player.backpack.push(target, stone);
  assert.equal(stone.useOnItem(target), true);
  assert.equal(target.curseScanned, true);
  assert.match(target.curseDescription, /free of curse/);
  assert.match(dungeon.logs.at(-1), /free of curse/);

  // Identified items are no longer candidates: their curse state is explicit.
  const known = Object.assign(new Entity(), {
    name: 'Shield', type: 'item', equipSlot: 'armor', identified: true,
    cursed: false, context: ctx,
  });
  player.backpack.push(known);
  const another = new StoneOfDetectCurse(ctx);
  player.backpack.push(another);
  assert.equal(another.canTargetItem(known), false);
  assert.equal(another.canTargetItem(target), false, 'already scanned');
}

// --- Unidentified descriptions carry the verdict but not the item's name ---
{
  const cursed = Object.assign(new Entity(), {
    name: 'Axe', type: 'item', equipSlot: 'weapon', tier: 1,
    identified: false, cursed: true, curseId: 'sacrificial', curseScanned: true,
  });
  assert.match(cursed.displayDescription, /glyph stone reveals that this item is cursed/i);
  assert.doesNotMatch(cursed.displayDescription, /Sacrificial/);
  const clean = Object.assign(new Entity(), {
    name: 'Ration', type: 'item', equipSlot: 'consumable',
    identified: false, cursed: false, curseScanned: true,
  });
  assert.match(clean.displayDescription, /glyph stone reveals that this item is free of curse/i);
  const unscanned = Object.assign(new Entity(), {
    name: 'Axe', type: 'item', equipSlot: 'weapon', tier: 1,
    identified: false, cursed: true, curseId: 'wayward',
  });
  assert.equal(unscanned.curseDescription, '');
}

// --- Throw landing delegates to the stone and removes it on success ---
{
  let impact;
  const throwDungeon = {
    log() {},
    triggered: false,
    triggerArrowTrap() { this.triggered = true; },
  };
  const Hero = load('src/games/rogue0/classes/basicHero.ts', {
    Entity: class { init() {} },
    dungeon: throwDungeon,
    removeEntity: (ctx, entity) => {
      ctx.entities = ctx.entities.filter(candidate => candidate !== entity);
    },
    sfx: { equip() {}, potion() {} },
  }).default;
  const hero = Object.create(Hero.prototype);
  const ctx = { entities: [], messages: [], player: hero };
  hero.context = ctx;
  const stone = {
    type: 'item',
    onThrownLand(tx, ty) { impact = [tx, ty]; return true; },
  };
  ctx.entities = [stone];
  hero.resolveThrowLanding(stone, 3, 4);
  assert.deepEqual(impact, [3, 4]);
  assert.equal(ctx.entities.includes(stone), false, 'a handled stone never rests on the floor');
  assert.equal(throwDungeon.triggered, true, 'landing still probes the arrow plate');
}

// --- Dungeon invokes the trample hook only for the hero ---
{
  terrain = createTerrain();
  const map = Array.from({ length: 5 }, () => Array(6).fill(0));
  const dungeonLogic = load('src/games/rogue0/dungeon.ts', {
    tiles: terrain,
    hasEffect: () => false,
    sfx: { step() {} },
  }).default;
  dungeonLogic.currentLevel = map;

  const hero = {
    type: 'player', x: 1, y: 1, healthPoints: 10, isFlying: false,
    moving: false, effects: [], sprite: undefined,
  };
  const calls = [];
  const ctx = {
    entities: [hero], messages: [], player: hero, visibleTiles: new Set(),
    map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16,
      getTileAt: () => ({ index: 0 }) },
    scene: { tweens: { add() {} }, add: { sprite() {} } },
    onGrassTrampled: (entity, x, y) => calls.push([entity, x, y]),
  };
  terrain.setFeature(2, 1, 'grass');
  dungeonLogic.moveEntityTo(ctx, hero, 2, 1);
  assert.equal(terrain.getFeature(2, 1), undefined, 'grass is still trampled');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], hero);
  assert.deepEqual(calls[0].slice(1), [2, 1]);

  const monster = {
    type: 'enemy', x: 3, y: 1, healthPoints: 10, isFlying: false,
    moving: false, effects: [], sprite: undefined,
  };
  ctx.entities.push(monster);
  terrain.setFeature(4, 1, 'grass');
  dungeonLogic.moveEntityTo(ctx, monster, 4, 1);
  assert.equal(terrain.getFeature(4, 1), undefined, 'monsters still flatten grass');
  assert.equal(calls.length, 1, 'only the hero disturbs hidden stones');
}

// --- A trample find waits underfoot: step off, then back, to take it --------
// The drop tile is occupied by the hero, so the find must lie there until the
// hero leaves and walks back onto it. This is the room-scale behaviour the
// normal walk-onto-item pickup provides; the handoff is asserted end to end.
function spriteStub() {
  return {
    x: 0, y: 0, depth: 0, width: 16, height: 16,
    setOrigin() { return this; },
    setScale() { return this; },
    setDepth(depth) { this.depth = depth; return this; },
    setPosition(x, y) { this.x = x; this.y = y; },
    getBounds() { return { x: this.x, y: this.y, width: 16, height: 16 }; },
    destroy() { this.destroyed = true; },
  };
}

function trampleScenario() {
  terrain = createTerrain();
  const map = Array.from({ length: 5 }, () => Array(6).fill(0));
  const dungeonLogic = load('src/games/rogue0/dungeon.ts', {
    tiles: terrain, hasEffect: () => false,
    sfx: { step() {}, pickup() {} },
  }).default;
  dungeonLogic.currentLevel = map;

  const hero = Object.assign(new Entity(), {
    type: 'player', x: 1, y: 1, healthPoints: 10, effects: [], moving: false,
    walkPath: [], inputBuffer: [], actionReady: true, hunger: 100, attackDelay: 1,
    backpack: [], acknowledgedWalkEnemies: new Set(),
  });
  hero.sprite = spriteStub();
  hero.context = undefined;
  hero.addItem = function (item) { this.backpack.push(item); return true; };
  hero.spendTurn = function (action) { (this.actions ??= []).push(action); };
  hero.canAct = function () { return true; };
  hero.currentWeapon = function () { return undefined; };
  hero.tryStepIntoChasm = function () { return false; };

  const ctx = {
    entities: [hero], messages: [], player: hero, visibleTiles: new Set(),
    map: {
      tileToWorldX: x => x * 16, tileToWorldY: y => y * 16,
      getTileAt: () => ({ index: 0 }),
    },
    scene: {
      add: { sprite: spriteStub },
      tweens: { add() {}, killTweensOf() {} },
    },
  };
  hero.context = ctx;
  const dropped = [];
  ctx.onGrassTrampled = (entity, x, y) => {
    if (entity !== hero) return;
    const stone = dropTrampledGlyphStone(ctx, x, y, seq([0, 0]));
    if (!stone) return;
    // The suite's coordinate-only Entity.init does not build sprites; floor-item
    // lookup and walkability both require one.
    stone.sprite = spriteStub();
    dropped.push(stone);
  };
  const navigation = createHeroNavigation({
    dungeon: dungeonLogic, isModalOpen: () => false, hasEffect: () => false,
    isGrassConcealed: () => false, actionCost: () => 1,
    starvationDamageDuring: () => 0,
  });
  return { ctx, hero, navigation, dropped };
}

{
  const { ctx, hero, navigation, dropped } = trampleScenario();
  terrain.setFeature(2, 1, 'grass');

  navigation.stepManually(hero, 1, 0);
  assert.deepEqual([hero.x, hero.y], [2, 1], 'the hero steps onto the grass');
  assert.equal(dropped.length, 1, 'the trampled tile yields a stone');
  assert.deepEqual([dropped[0].x, dropped[0].y], [2, 1], 'the stone lies under the hero');
  assert.equal(ctx.entities.includes(dropped[0]), true, 'the stone stays on the floor');
  assert.equal(hero.backpack.length, 0, 'sharing the tile does not take the stone');

  navigation.stepManually(hero, 1, 0);
  assert.deepEqual([hero.x, hero.y], [3, 1], 'the hero steps off the trampled tile');
  assert.equal(hero.backpack.length, 0, 'leaving the tile does not take the stone');
  assert.deepEqual([dropped[0].x, dropped[0].y], [2, 1], 'the stone stays where it fell');

  navigation.stepManually(hero, -1, 0);
  assert.deepEqual([hero.x, hero.y], [2, 1], 'walking back enters the stone tile');
  assert.deepEqual(hero.backpack, [dropped[0]], 'returning to the tile picks the stone up');
  assert.equal(dropped[0].sprite, undefined, 'a taken stone leaves no floor sprite');
  assert.equal(ctx.messages[0], 'You picked up a Stone of Blink.');
}

{
  // Click-to-move uses the same walk-onto-item rule, not a special case.
  const { hero, navigation, dropped } = trampleScenario();
  terrain.setFeature(2, 1, 'grass');
  navigation.stepManually(hero, 1, 0);
  navigation.stepManually(hero, 1, 0);
  assert.equal(hero.backpack.length, 0, 'the stone waits after leaving');

  hero.walkPath = [{ x: 2, y: 1 }];
  hero.nextStepToward = () => ({ x: 2, y: 1 });
  navigation.stepAutoWalk(hero);
  assert.deepEqual(hero.backpack, [dropped[0]], 'auto-walk back to the tile picks it up');
  assert.deepEqual([hero.x, hero.y], [2, 1], 'auto-walk finishes on the tile');
}

// --- A fresh stone builds its own sprite, not the atlas fallback -----------
// Field initializers in the concrete class run only after super() returns. If
// the base class builds the sprite, textureKey is still undefined and the stone
// lies on the floor looking like an empty atlas frame.
{
  const Rendering = load('src/games/rogue0/rendering.ts');
  const FreshEntity = load('src/games/rogue0/entity.ts', {
    ...curseData, ...Rendering, actionCost: () => 1,
    sfx: { death() {} },
  }).Entity;
  const FreshGlyphStone = load('src/games/rogue0/items/glyphStone.ts', {
    Entity: FreshEntity,
  }).default;
  const created = [];
  const scene = {
    add: {
      sprite(x, y, key, frame) {
        const sprite = {
          x, y, key, frame, width: 16, height: 16,
          setOrigin() { return this; },
          setScale(scale) { this.scale = scale; return this; },
          setPosition(x, y) { this.x = x; this.y = y; return this; },
          setDepth() { return this; },
          destroy() {},
        };
        created.push(sprite);
        return sprite;
      },
    },
    tweens: { add() {} },
  };
  const ctx = {
    messages: [], entities: [], scene,
    map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 },
  };
  const freshDungeon = { log() {} };
  const FreshBlink = load('src/games/rogue0/items/stoneOfBlink.ts', {
    Entity: FreshEntity, GlyphStone: FreshGlyphStone, dungeon: freshDungeon,
    bresenhamLine, terrainFor: () => terrain, GLYPH_STONE_TEXTURES,
  }).default;
  const FreshCurse = load('src/games/rogue0/items/stoneOfDetectCurse.ts', {
    Entity: FreshEntity, GlyphStone: FreshGlyphStone, dungeon: freshDungeon,
    removeEntity() {}, GLYPH_STONE_TEXTURES,
  }).default;

  new FreshBlink(ctx, 2, 3);
  new FreshCurse(ctx, 4, 5);
  assert.deepEqual(created.map(sprite => sprite.key),
    [GLYPH_STONE_TEXTURES.blink, GLYPH_STONE_TEXTURES.detectCurse],
    'a freshly dropped stone renders its own artwork, not the atlas frame');
  assert.ok(created.every(sprite => sprite.frame === 0),
    'custom stone textures use frame zero');
  // Half-scale art inset by 4px: (2,3) -> (36,52) and (4,5) -> (68,84).
  assert.deepEqual(created.map(sprite => [sprite.x, sprite.y, sprite.scale]),
    [[2 * 16 + 4, 3 * 16 + 4, 0.5], [4 * 16 + 4, 5 * 16 + 4, 0.5]],
    'a fresh stone is drawn half size and centred on its tile');
}

console.log('Rogue0 glyph stones: trample drops, floor waits, own sprite, blink landing, curse scrying and descriptions passed');
