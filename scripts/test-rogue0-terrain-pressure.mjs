import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('terrain-pressure');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import PF from 'pathfinding';
function load(name, bindings = {}) {
  const source = fs.readFileSync(`src/games/rogue0/${name}.ts`, 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
  const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
  const exports = {};
  new Function('exports', ...Object.keys(bindings), js)(exports, ...Object.values(bindings));
  return exports;
}
const tiles = load('tiles');
const fov = load('fov', tiles);
const { generateMap } = load('mapgen', tiles);
const dungeon = load('dungeon', { PF, tiles, ...fov,
  hasEffect: () => false, sfx: { step() {} },
  removeEntity: (ctx, e) => { ctx.entities = ctx.entities.filter(v => v !== e); }
}).default;
let changes = 0;
dungeon.onTerrainChanged = () => changes++;
for (let i = 0; i < 200; i++) {
  tiles.clearAllFeatures();
  const { map, rooms, features } = generateMap(i % 2 + 1);
  assert.ok(rooms.length > 1);
  for (const f of features) tiles.setFeature(f.x, f.y, f.feature, f);
  const secret = features.find(f => f.feature === 'secretDoor');
  assert.ok(secret, 'every floor has a secret branch');
  assert.ok(features.some(f => f.trapKind === 'arrow' && f.trap === 'visible'));
  const { x, y } = secret;
  assert.equal(map[y][x], 1);
  assert.equal(map[y + 1][x], 0);
  assert.equal(map[y - 1][x], 0);
  assert.equal(map[y - 2][x], 0);
  assert.equal(map[y + 1][x - 1], 1);
  assert.equal(map[y + 1][x + 1], 1);
  assert.equal(tiles.describeTile(tiles.getTileState(x, y), true), 'A wall.');
  dungeon.currentLevel = map;
  dungeon.pathGrid = new PF.Grid(map);
  tiles.applyToPathGrid(dungeon.pathGrid);
  dungeon.diagonalFinder = new PF.AStarFinder({ diagonalMovement: PF.DiagonalMovement.OnlyWhenNoObstacles });
  dungeon.context = { messages: [] };
  let redraw;
  dungeon.layer = { putTileAt: (...args) => { redraw = args; } };
  assert.equal(dungeon.findPath(x, y + 1, x, y - 1, true).length, 0);
  tiles.setFeature(x + 1, y + 1, 'trap', { trap: 'hidden' });
  assert.equal(dungeon.searchAround(x, y + 1), 2, 'search preserves trap discovery');
  assert.equal(tiles.getTrapState(x + 1, y + 1), 'visible');
  assert.equal(map[y][x], 0);
  assert.deepEqual(redraw, [0, x, y]);
  assert.equal(fov.blocksSight(map, x, y), true);
  assert.equal(dungeon.findPath(x, y + 1, x, y - 1, true).length, 3);
  assert.equal(dungeon.searchAround(x, y + 1), 0);
  dungeon.openDoor(x, y);
  assert.equal(fov.blocksSight(map, x, y), false);
  assert.equal(dungeon.pathGrid.isWalkableAt(x, y), true);
  const saved = [];
  tiles.forEachFeature((x, y, state) => saved.push({ ...state, x, y }));
  tiles.clearAllFeatures();
  saved.forEach(f => tiles.setFeature(f.x, f.y, f.feature, f));
  assert.equal(tiles.getDoorState(x, y), 'open', 'revisit keeps discovered/open door');
}
function actor(type, x, y, hp = 10) {
  return { type, x, y, healthPoints: hp, name: type, protection: () => 0,
    takeDamage(n) { this.healthPoints -= n; } };
}
function setup(actors) {
  tiles.clearAllFeatures();
  tiles.setFeature(3, 3, 'trap', { trapKind: 'arrow', trap: 'visible' });
  dungeon.currentLevel = Array.from({ length: 9 }, () => Array(9).fill(0));
  return { entities: actors, messages: [], visibleTiles: new Set() };
}
let player = actor('player', 1, 3), enemy = actor('enemy', 4, 3);
let ctx = setup([player, enemy, actor('item', 3, 3), actor('enemy', 3, 3, 0)]);
assert.equal(dungeon.triggerArrowTrap(ctx, 3, 3), true);
assert.equal(enemy.healthPoints, 5);
assert.equal(player.healthPoints, 10);
assert.equal(dungeon.triggerArrowTrap(ctx, 3, 3), false);
player = actor('player', 3, 4); enemy = actor('enemy', 7, 3);
ctx = setup([enemy, player]);
dungeon.triggerArrowTrap(ctx, 3, 3);
assert.equal(player.healthPoints, 5, 'nearest player can be hit');
ctx = setup([actor('enemy', 5, 3)]);
dungeon.currentLevel[3][4] = 1;
dungeon.triggerArrowTrap(ctx, 3, 3);
assert.equal(ctx.entities[0].healthPoints, 10, 'arrow cannot pass a wall');
ctx = setup([actor('enemy', 3, 3, 4)]);
dungeon.triggerArrowTrap(ctx, 3, 3);
assert.equal(ctx.entities.length, 0, 'lethal trap removes victim');
// Real throw landing and step entry integration, without renderer dependencies.
const { Entity } = load('entity', {});
const Hero = load('classes/basicHero', {
  Entity, dungeon, ...fov, Wand: class {}, hasEffect: () => false,
  removeEntity: (ctx, e) => { ctx.entities = ctx.entities.filter(v => v !== e); }
}).default;
ctx = setup([actor('enemy', 4, 3)]);
const hero = Object.create(Hero.prototype);
hero.context = ctx;
hero.placeItemOnGround = () => {};
hero.resolveThrowLanding({ type: 'item' }, 3, 3);
assert.equal(ctx.entities[0].healthPoints, 5);
const walker = actor('enemy', 2, 3);
ctx = setup([walker]);
ctx.map = { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 };
ctx.scene = {};
dungeon.moveEntityTo(ctx, walker, 3, 3);
assert.equal(walker.healthPoints, 5, 'monster stepping triggers plate at new position');
// Physical arrows cannot cut corners, but can fly over a chasm.
ctx = setup([actor('enemy', 4, 4)]);
dungeon.currentLevel[3][4] = 1;
dungeon.triggerArrowTrap(ctx, 3, 3);
assert.equal(ctx.entities[0].healthPoints, 10);
ctx = setup([actor('enemy', 5, 3)]);
tiles.setFeature(4, 3, 'chasm');
dungeon.triggerArrowTrap(ctx, 3, 3);
assert.equal(ctx.entities[0].healthPoints, 5);
ctx = setup([actor('enemy', 5, 3)]);
tiles.setFeature(4, 3, 'door');
dungeon.triggerArrowTrap(ctx, 3, 3);
assert.equal(ctx.entities[0].healthPoints, 10);

function sprite() {
  return { setOrigin() { return this; }, setDepth() { return this; },
    setRotation() { return this; }, setPosition() { return this; }, destroy() {} };
}
function renderContext(ctx) {
  ctx.map = { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 };
  ctx.scene = { add: { sprite }, tweens: {
    add(opts) { opts.onComplete?.(); }, killTweensOf() {}
  } };
  return ctx;
}
function throwingHero(count = 3, Item) {
  const ctx = renderContext(setup([]));
  const item = Object.assign(Item ? new Item(ctx) : new Entity(), {
    type: 'item', count, identified: false, level: 2
  });
  ctx.entities.push(item);
  const hero = Object.assign(Object.create(Hero.prototype), {
    context: ctx, backpack: [item], effects: [], x: 1, y: 3,
    moving: false, actionReady: true, spendTurn() {}
  });
  ctx.throwItem = item;
  ctx.throwMode = true;
  return { hero, ctx, item };
}
let thrownSetup = throwingHero();
thrownSetup.hero.throwAt(3, 3);
let floorItem = thrownSetup.ctx.entities.find(e => e.x === 3 && e.y === 3);
assert.notEqual(floorItem, thrownSetup.item, 'stack throw creates independent floor entity');
assert.equal(floorItem.count, 1);
assert.equal(floorItem.level, 2);
assert.equal(floorItem.identified, false);
assert.equal(thrownSetup.item.count, 2);
assert.equal(thrownSetup.item.x, undefined);
assert.equal(thrownSetup.hero.backpack[0], thrownSetup.item);
assert.equal(tiles.getTrapState(3, 3), 'triggered');
thrownSetup = throwingHero();
thrownSetup.hero.backpack = [];
thrownSetup.hero.throwAt(3, 3);
assert.equal(tiles.getTrapState(3, 3), 'visible', 'stale throw selection cannot fire trap');
assert.equal(thrownSetup.item.count, 3);
thrownSetup = throwingHero();
thrownSetup.ctx.scene = undefined;
thrownSetup.hero.throwAt(3, 3);
assert.equal(thrownSetup.item.count, 3, 'missing renderer cannot mutate/duplicate stack');
thrownSetup = throwingHero();
const stackedEnemy = actor('enemy', 3, 3);
thrownSetup.ctx.entities.push({ type: 'item', x: 3, y: 3, sprite: sprite() }, stackedEnemy);
let struck;
thrownSetup.hero.applyThrownItemToEnemy = (_item, target) => { struck = target; };
thrownSetup.hero.throwAt(3, 3);
assert.equal(struck, stackedEnemy, 'loot does not hide the enemy from impact');
assert.equal(thrownSetup.item.count, 2);
assert.ok(thrownSetup.ctx.entities.includes(thrownSetup.item), 'hit cannot remove inventory stack');

// Actual potion and gem classes: throw one from a stack onto the plate or
// into an enemy. The remaining inventory entity survives both paths.
const Potion = load('items/PotionOfHealing', { Entity }).default;
const Gem = load('items/gem', { Entity }).default;
for (const Item of [Potion, Gem]) {
  for (const hitEnemy of [false, true]) {
    const { hero, ctx, item } = throwingHero(3, Item);
    if (hitEnemy) ctx.entities.push(actor('enemy', 3, 3));
    hero.throwAt(3, 3);
    assert.equal(item.count, 2, `${Item.name}: exactly one is thrown`);
    assert.equal(hero.backpack[0], item);
    assert.ok(ctx.entities.includes(item));
    assert.equal(item.x, undefined);
    if (!hitEnemy) {
      const landed = ctx.entities.find(e => e.x === 3 && e.y === 3);
      assert.ok(landed instanceof Item, 'split retains potion/gem behavior');
      assert.notEqual(landed, item);
      assert.equal(landed.count, 1);
      assert.equal(landed.level, item.level);
      assert.equal(landed.identified, item.identified);
    } else {
      assert.equal(ctx.entities.filter(e => e.type === 'item').length, 1,
        'consumed projectile leaves only the original backpack stack');
    }
    assert.equal(tiles.getTrapState(3, 3), 'triggered');
  }
  const { hero, ctx, item } = throwingHero(1, Item);
  hero.throwAt(3, 3);
  assert.equal(hero.backpack.length, 0, 'last unit leaves inventory');
  assert.equal(ctx.entities.find(e => e.x === 3 && e.y === 3), item);
  assert.equal(item.count, 1);
}

// Exercise actual shared death cleanup: onDestroy sees landing coordinates,
// coordinates/sprites are then cleared, and no movement tween revives it.
const realRemove = load('entity', { sfx: { death() {} } }).removeEntity;
const deathDungeon = load('dungeon', { PF, tiles, ...fov, hasEffect: () => false,
  sfx: { step() {} }, removeEntity: realRemove }).default;
for (const type of ['player', 'enemy']) {
  for (const visible of [false, true]) {
    const victim = actor(type, 2, 3, 4);
    victim.sprite = sprite();
    let deathPosition;
    victim.onDestroy = () => { deathPosition = [victim.x, victim.y]; };
    const ctx = renderContext(setup([victim]));
    if (visible) ctx.visibleTiles.add('3,3');
    deathDungeon.currentLevel = dungeon.currentLevel;
    deathDungeon.moveEntityTo(ctx, victim, 3, 3);
    assert.deepEqual(deathPosition, [3, 3]);
    assert.equal(ctx.entities.includes(victim), false);
    assert.equal(victim.sprite, undefined);
    assert.equal(victim.x, undefined);
    assert.ok(!victim.moving);
    assert.equal(tiles.getTrapState(3, 3), 'triggered');
  }
}
assert.ok(changes > 0);
console.log('terrain-pressure: generation, secrets, FOV, paths, persistence, arrows, stack throws and visible/offscreen deaths passed');
