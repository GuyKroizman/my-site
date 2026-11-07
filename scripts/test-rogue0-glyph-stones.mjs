import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('glyph-stones');
import assert from 'node:assert/strict';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
import { GLYPH_STONE_TEXTURES } from '../src/games/rogue0/glyphStoneTextures.ts';
import { bresenhamLine } from '../src/games/rogue0/fov.ts';
import { createTerrain } from '../src/games/rogue0/terrain.ts';

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

// --- Trample drop odds: independent chance then a rune choice ---
const { GLYPH_STONE_TRAMPLE_CHANCE, rollGlyphStoneKind, createGlyphStone } =
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

console.log('Rogue0 glyph stones: trample drops, blink landing, curse scrying and descriptions passed');
