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
  for (const f of features.filter(f => f.feature === 'trap')) {
    assert.equal(!!f.trapReusable, ['frost', 'teleport', 'alarm'].includes(f.trapKind));
  }
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
  assert.equal(dungeon.inspectTile(x, y), 'A wall.', 'inspect does not leak secret doors');
  assert.equal(tiles.isBlocking(x, y), true);
  assert.equal(fov.blocksSight(map, x, y), true);
  // Other generated traps may be nearby; only the secret must stay hidden.
  dungeon.searchAround(x, y + 2);
  assert.equal(tiles.getFeature(x, y), 'secretDoor', 'search cannot reveal a distant secret');
  const changesBeforeSearch = changes;
  tiles.setFeature(x + 1, y + 1, 'trap', { trap: 'hidden' });
  assert.equal(dungeon.searchAround(x, y + 1), 2, 'search preserves trap discovery');
  assert.equal(tiles.getTrapState(x + 1, y + 1), 'visible');
  assert.equal(map[y][x], 0);
  assert.equal(tiles.getDoorState(x, y), 'closed', 'discovery does not open the door');
  assert.equal(dungeon.pathGrid.isWalkableAt(x, y), false);
  assert.equal(changes, changesBeforeSearch + 1, 'discovery refreshes terrain once');
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
// Search reveals traps but never disables them, even on repeated use.
for (const trapKind of ['dart', 'fire', 'frost', 'teleport', 'arrow', 'summon', 'alarm']) {
  const searcher = Object.create(Hero.prototype);
  Object.assign(searcher, { x: 2, y: 3, context: setup([]), walkPath: [1] });
  tiles.setFeature(3, 3, 'trap', { trapKind, trap: 'visible' });
  tiles.setFeature(2, 4, 'trap', { trapKind, trap: 'hidden' });
  searcher.canAct = () => true;
  const costs = [];
  searcher.spendTurn = action => costs.push(action);
  searcher.search();
  searcher.search();
  assert.deepEqual(costs, ['search', 'search']);
  assert.equal(searcher.walkPath.length, 0);
  assert.equal(tiles.getTrapState(3, 3), 'visible', 'known trap remains armed');
  assert.equal(tiles.getTrapState(2, 4), 'visible', 'revealed trap remains armed');
  searcher.canAct = () => false;
  searcher.search();
  assert.equal(costs.length, 2, 'search respects action readiness');
}
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
// Pickup may merge only equivalent stack state, never silently erase it.
for (const difference of [
  { identified: true }, { level: 3 }, { cursed: true }, { blessed: true },
  { charges: 4 }, { tier: 2 }, { effects: [{ id: 'test', duration: 2 }] }
]) {
  const { hero, ctx, item } = throwingHero(3, Potion);
  hero.capacity = 1;
  const incoming = Object.assign(new Potion(ctx), {
    x: 2, y: 3, level: item.level, identified: item.identified, ...difference
  });
  ctx.entities.push(incoming);
  assert.equal(hero.addItem(incoming), false, 'different state cannot bypass a full backpack');
  assert.equal(item.count, 3);
  assert.equal(incoming.x, 2);
  assert.ok(ctx.entities.includes(incoming));
  hero.capacity = 2;
  assert.equal(hero.addItem(incoming), true);
  assert.deepEqual(hero.backpack, [item, incoming]);
  assert.equal(incoming.x, undefined);
  for (const [key, value] of Object.entries(difference)) assert.deepEqual(incoming[key], value);
}
{
  const { hero, ctx, item } = throwingHero(3, Potion);
  hero.capacity = 1;
  const incoming = Object.assign(new Potion(ctx), {
    x: 2, y: 3, level: item.level, identified: item.identified, count: 2
  });
  ctx.entities.push(incoming);
  assert.equal(hero.addItem(incoming), true, 'equivalent items still stack in a full backpack');
  assert.equal(item.count, 5);
  assert.deepEqual(hero.backpack, [item]);
  assert.ok(!ctx.entities.includes(incoming));
}
for (const Item of [Potion, Gem]) {
  // Dropping a stack must preserve the same state as throwing one unit.
  {
    const { hero, ctx, item } = throwingHero(3, Item);
    item.cursed = true; // Backpack curses do not prevent dropping.
    item.charges = 4;
    item.effects = [{ id: 'test', duration: 2 }];
    const icon = {};
    item.UISprite = icon;
    let turns = 0;
    hero.spendTurn = action => { assert.equal(action, 'drop'); turns++; };
    hero.dropItem(item);
    const dropped = ctx.entities.find(e => e.x === hero.x && e.y === hero.y);
    assert.ok(dropped instanceof Item);
    assert.notEqual(dropped, item);
    assert.equal(dropped.count, 1);
    assert.equal(dropped.level, 2);
    assert.equal(dropped.identified, false);
    assert.equal(dropped.cursed, true);
    assert.equal(dropped.charges, 4);
    assert.deepEqual(dropped.effects, item.effects);
    assert.notEqual(dropped.effects[0], item.effects[0]);
    assert.equal(dropped.UISprite, undefined);
    assert.equal(item.UISprite, icon);
    assert.ok(dropped.sprite);
    assert.equal(item.x, undefined);
    assert.equal(item.count, 2);
    assert.equal(hero.backpack[0], item);
    assert.equal(turns, 1);
  }
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
// Exercise real levitation effects and terrain together, including fractional
// expiry timing. Rendering is synchronous; logical time advances only explicitly.
const flightDungeon = load('dungeon', { PF, tiles, ...fov,
  hasEffect: (e, id) => e.effects.some(effect => effect.id === id),
  removeEffect: (e, id) => flightEffects.removeEffect(e, id),
  applyEffect: (e, effect) => flightEffects.applyEffect(e, effect),
  createPoisonedEffect: () => flightEffects.createPoisonedEffect(),
  createBurningEffect: () => flightEffects.createBurningEffect(),
  createFrozenEffect: () => flightEffects.createFrozenEffect(),
  sfx: { step() {} }
}).default;
const flightEffects = load('effects', { dungeon: flightDungeon, spawnEntityFloatingText() {} });
function flightSetup() {
  tiles.clearAllFeatures();
  const map = Array.from({ length: 5 }, (_, y) =>
    Array.from({ length: 7 }, (_, x) => y === 2 && x > 0 && x < 6 ? 0 : 1));
  tiles.setFeature(3, 2, 'chasm');
  flightDungeon.currentLevel = map;
  flightDungeon.pathGrid = new PF.Grid(map);
  tiles.applyToPathGrid(flightDungeon.pathGrid);
  flightDungeon.diagonalFinder = new PF.AStarFinder({ diagonalMovement: PF.DiagonalMovement.OnlyWhenNoObstacles });
  const ctx = renderContext({ entities: [], messages: [], visibleTiles: new Set(), simulationTime: 0.5 });
  ctx.map.getTileAt = (x, y) => ({ index: map[y][x] === 1 ? 637 : 0 });
  const flyer = Object.assign(new Entity(), { context: ctx, type: 'player', name: 'Hero',
    healthPoints: 10, x: 2, y: 2, sprite: sprite(), protection: () => 0,
    takeDamage(amount) { this.healthPoints -= amount; } });
  ctx.player = flyer; ctx.entities = [flyer];
  return { ctx, flyer };
}
{
  const { ctx, flyer } = flightSetup();
  assert.equal(flightDungeon.isWalkableTile(ctx, 3, 2), false);
  assert.deepEqual(flightDungeon.findPath(2, 2, 4, 2, true, true, flyer), []);
  flightEffects.applyEffect(flyer, flightEffects.createLevitatingEffect(2));
  assert.equal(flightDungeon.isWalkableTile(ctx, 3, 2), true);
  assert.equal(flightDungeon.isWalkableTile(ctx, 3, 1), false, 'flight never crosses walls');
  assert.equal(flightDungeon.findPath(2, 2, 4, 2, true, true, flyer).length, 3);
  assert.equal(flightDungeon.pathGrid.isWalkableAt(3, 2), false, 'flight never changes shared grid');
  assert.equal(flightDungeon.canStepBetween(2, 2, 3, 1, flyer), false, 'no wall corner cutting');
  flightDungeon.moveEntityTo(ctx, flyer, 3, 2);
  ctx.simulationTime = 1.49;
  flightEffects.tickEffects(flyer, ctx);
  assert.equal(flyer.effects[0].duration, 2);
  ctx.simulationTime = 1.5; flightEffects.tickEffects(flyer, ctx);
  assert.equal(flyer.effects[0].duration, 1);
  ctx.simulationTime = 2.5; flightEffects.tickEffects(flyer, ctx);
  assert.equal(flightEffects.hasEffect(flyer, 'levitating'), false);
  assert.deepEqual([flyer.x, flyer.y], [3, 2], 'expiry does not rescue the player');
  assert.equal(ctx.pendingFall, true);
  assert.equal(flyer.actionReady, false);
  assert.equal(flightDungeon.isWalkableTile(ctx, 3, 2), false);
}
for (const feature of ['water', 'grass', 'dart', 'arrow']) {
  const { ctx, flyer } = flightSetup();
  tiles.setFeature(2, 2, feature === 'dart' || feature === 'arrow' ? 'trap' : feature,
    { trapKind: feature, trap: 'hidden' });
  flightEffects.applyEffect(flyer, flightEffects.createLevitatingEffect());
  flightEffects.applyEffect(flyer, flightEffects.createBurningEffect());
  flyer.x = 1;
  flightDungeon.moveEntityTo(ctx, flyer, 2, 2);
  assert.equal(flightEffects.hasEffect(flyer, 'burning'), true, 'flight prevents water contact');
  assert.equal(tiles.getFeature(2, 2), feature === 'dart' || feature === 'arrow' ? 'trap' : feature);
  if (feature === 'dart' || feature === 'arrow') assert.equal(tiles.getTrapState(2, 2), 'hidden');
  assert.equal(flightEffects.hasEffect(flyer, 'poisoned'), false);
  flightEffects.removeEffect(flyer, 'levitating');
  assert.equal(flyer.x, 2, 'expiry on solid ground does not relocate');
  assert.ok(!ctx.pendingFall);
  flyer.x = 1;
  flightDungeon.moveEntityTo(ctx, flyer, 2, 2);
  if (feature === 'water') assert.equal(flightEffects.hasEffect(flyer, 'burning'), false);
  if (feature === 'dart') assert.equal(flightEffects.hasEffect(flyer, 'poisoned'), true);
  if (feature === 'dart' || feature === 'arrow') assert.equal(tiles.getTrapState(2, 2), 'triggered');
}
{
  const { ctx, flyer } = flightSetup();
  flyer.x = 3;
  // Traps are not safe landing sites; an occupied tile is not displaced.
  tiles.setFeature(2, 2, 'trap', { trapKind: 'dart', trap: 'hidden' });
  ctx.entities.push(actor('enemy', 4, 2));
  flightEffects.applyEffect(flyer, flightEffects.createLevitatingEffect(1));
  flightEffects.removeEffect(flyer, 'levitating');
  assert.deepEqual([flyer.x, flyer.y], [3, 2]);
  assert.equal(ctx.pendingFall, true, 'explicit removal also falls');
}
{
  const { ctx, flyer } = flightSetup();
  flyer.x = 3;
  for (const x of [1, 2, 4, 5]) ctx.entities.push(actor('enemy', x, 2));
  flightEffects.applyEffect(flyer, flightEffects.createLevitatingEffect(1));
  ctx.simulationTime = 1.5; flightEffects.tickEffects(flyer, ctx);
  assert.equal(flightEffects.hasEffect(flyer, 'levitating'), false, 'no emergency hovering');
  assert.equal(ctx.pendingFall, true);
  assert.equal(flyer.x, 3);
}
// Activation policy is independent of trap kind, and is never a world-time timer.
for (const trapKind of ['dart', 'fire', 'frost', 'teleport', 'arrow', 'summon', 'alarm']) {
  for (const trapReusable of [false, true]) {
    const { ctx, flyer } = flightSetup();
    flyer.healthPoints = 100; flyer.x = 1;
    let summons = 0;
    ctx.onSummonTrap = (x, y) => {
      assert.deepEqual([x, y], [2, 2]); summons++; return true;
    };
    const listeners = [[10, 2, 10], [11, 2, 10], [2, 1, 0]].map(([x, y, hp]) =>
      Object.assign(new Entity(), { type: 'enemy', x, y, healthPoints: hp }));
    ctx.entities.push(...listeners);
    tiles.clearFeature(3, 2);
    flightDungeon.pathGrid.setWalkableAt(3, 2, true);
    tiles.setFeature(2, 2, 'trap', { trapKind, trapReusable, trap: 'hidden' });
    assert.equal(tiles.describeTile(tiles.getTileState(2, 2), false), 'Stone floor.');
    assert.equal(flightDungeon.searchAround(1, 2), 1);
    assert.equal(flightDungeon.searchAround(1, 2), 0);
    assert.equal(tiles.getTrapState(2, 2), 'visible', 'search reveals, never disarms');
    assert.equal(tiles.getTileState(2, 2).trapReusable, trapReusable);
    assert.match(tiles.describeTile(tiles.getTileState(2, 2), false),
      trapReusable ? /Reusable/ : /Single-use/);
    tiles.setTrapState(2, 2, 'hidden');
    let activations = 0;
    flightDungeon.onTerrainChanged = () => activations++;
    const randomTile = flightDungeon.randomWalkableTile;
    flightDungeon.randomWalkableTile = () => ({ x: 4, y: 2 });
    flightEffects.applyEffect(flyer, flightEffects.createLevitatingEffect());
    flightDungeon.moveEntityTo(ctx, flyer, 2, 2);
    assert.equal(activations, 0, 'flight never activates reusable traps either');
    assert.equal(summons, 0);
    assert.equal(listeners[0].lastSeenX, undefined);
    flightEffects.removeEffect(flyer, 'levitating');
    flyer.x = 1;
    flightDungeon.moveEntityTo(ctx, flyer, 2, 2);
    assert.equal(activations, 1);
    assert.equal(tiles.getTrapState(2, 2), trapReusable ? 'visible' : 'triggered');
    assert.match(tiles.describeTile(tiles.getTileState(2, 2), false),
      trapReusable ? /Reusable/ : /triggered/);
    if (trapReusable) {
      assert.deepEqual(flightDungeon.findPath(1, 2, 4, 2, true, true, flyer), [],
        'auto-walk still avoids an activated reusable trap');
      assert.equal(flightDungeon.findPath(1, 2, 2, 2, true, true, flyer).length, 2,
        'explicitly selecting the trap permits entry');
    }
    if (trapKind === 'teleport') assert.equal(flyer.x, 4);
    if (trapKind === 'frost') assert.equal(flightEffects.hasEffect(flyer, 'frozen'), true);
    flightDungeon.moveEntityTo(ctx, flyer, flyer.x, flyer.y);
    assert.equal(activations, 1, 'standing on the tile is not another entry');
    flightDungeon.moveEntityTo(ctx, flyer, 1, 2);
    flightDungeon.moveEntityTo(ctx, flyer, 2, 2);
    assert.equal(activations, trapReusable ? 2 : 1, 'only reusable traps reactivate');
    assert.equal(ctx.simulationTime, 0.5, 'no rearming timer or extra action cost');
    assert.equal(summons, trapKind === 'summon' ? (trapReusable ? 2 : 1) : 0);
    if (trapKind === 'alarm') {
      assert.deepEqual([listeners[0].lastSeenX, listeners[0].lastSeenY], [2, 2], 'inclusive noise radius');
      assert.equal(listeners[0].awareOfPlayer, false, 'noise is not player vision');
      assert.equal(listeners[1].lastSeenX, undefined, 'outside radius unaffected');
      assert.equal(listeners[2].lastSeenX, undefined, 'dead actors unaffected');
    }
    // Search and snapshot restoration must preserve the activation policy/state.
    flightDungeon.searchAround(1, 2);
    const saved = { ...tiles.getTileState(2, 2) };
    tiles.clearAllFeatures();
    tiles.setFeature(2, 2, saved.feature, saved);
    assert.equal(tiles.getTileState(2, 2).trapReusable, trapReusable);
    assert.equal(tiles.activateTrap(2, 2), trapReusable);
    flightDungeon.randomWalkableTile = randomTile;
    tiles.setFeature(2, 2, 'grass');
    assert.equal(tiles.getTileState(2, 2).trapReusable, undefined);
    tiles.setFeature(2, 2, 'trap');
    assert.equal(tiles.getTileState(2, 2).trapReusable, false, 'legacy traps remain single-use');
  }
}
{
  const { ctx, flyer } = flightSetup();
  flyer.x = 1;
  let attempts = 0;
  ctx.onSummonTrap = () => { attempts++; return false; };
  tiles.setFeature(2, 2, 'trap', { trapKind: 'summon', trap: 'hidden' });
  flightDungeon.moveEntityTo(ctx, flyer, 2, 2);
  assert.equal(tiles.getTrapState(2, 2), 'triggered', 'blocked summons still consume the trap');
  assert.ok(ctx.messages.some(message => message.includes('fizzles')));
  flightDungeon.moveEntityTo(ctx, flyer, 1, 2);
  flightDungeon.moveEntityTo(ctx, flyer, 2, 2);
  assert.equal(attempts, 1, 'fizzled single-use trap does not retry');
}
// Fire consumes an entire connected patch, not just one tile per movement.
{
  const { ctx, flyer: source } = flightSetup();
  tiles.clearAllFeatures();
  flightDungeon.currentLevel = Array.from({ length: 9 }, () => Array(10).fill(0));
  const patch = [[2, 2], [3, 2], [3, 3], [2, 3], [4, 3], [5, 3]];
  for (const [x, y] of patch) tiles.setFeature(x, y, 'grass');
  for (const [x, y] of [[6, 4], [7, 3], [5, 5], [1, 5]]) tiles.setFeature(x, y, 'grass');
  tiles.setFeature(6, 3, 'water'); // firebreak before (7,3)
  tiles.setFeature(5, 4, 'grass');
  flightDungeon.currentLevel[4][5] = 1; // stale overlay on a wall must not burn through it
  const make = (type, x, y, hp = 20) => Object.assign(new Entity(), {
    type, x, y, healthPoints: hp, context: ctx, name: type
  });
  const grounded = make('enemy', 5, 3);
  const airborne = make('enemy', 4, 3);
  const item = make('item', 3, 3);
  const corpse = make('enemy', 3, 2, 0);
  ctx.entities.push(grounded, airborne, item, corpse);
  flightEffects.applyEffect(airborne, flightEffects.createLevitatingEffect());
  flightEffects.applyEffect(source, flightEffects.createBurningEffect());
  let refreshes = 0;
  flightDungeon.onTerrainChanged = () => refreshes++;
  assert.equal(fov.blocksSight(flightDungeon.currentLevel, 3, 2), true);
  flightDungeon.igniteGrass(ctx, source, 2, 2);
  for (const [x, y] of patch) assert.equal(tiles.getFeature(x, y), undefined);
  for (const [x, y] of [[6, 4], [7, 3], [5, 5], [1, 5], [5, 4]]) {
    assert.equal(tiles.getFeature(x, y), 'grass', 'diagonal, separated and wall grass survives');
  }
  assert.equal(tiles.getFeature(6, 3), 'water');
  assert.equal(flightEffects.hasEffect(grounded, 'burning'), true, 'offscreen actors burn without sprites');
  assert.equal(flightEffects.hasEffect(airborne, 'burning'), false);
  assert.equal(flightEffects.hasEffect(item, 'burning'), false);
  assert.equal(flightEffects.hasEffect(corpse, 'burning'), false);
  assert.equal(refreshes, 1, 'refresh terrain/FOV once per spread');
  assert.equal(fov.blocksSight(flightDungeon.currentLevel, 3, 2), false);
  assert.equal(ctx.simulationTime, 0.5);
  const hp = grounded.healthPoints;
  ctx.simulationTime = 1.49; flightEffects.tickEffects(grounded, ctx);
  assert.equal(grounded.healthPoints, hp, 'ignition does not invent an extra damage tick');
  ctx.simulationTime = 1.5; flightEffects.tickEffects(grounded, ctx);
  assert.ok(grounded.healthPoints < hp, 'burn damage uses the existing world-time clock');
  flightDungeon.igniteGrass(ctx, source, 2, 2);
  assert.equal(refreshes, 1, 'spent patch cannot ignite again');
  const saved = [];
  tiles.forEachFeature((x, y, state) => saved.push({ ...state, x, y }));
  tiles.clearAllFeatures(); saved.forEach(f => tiles.setFeature(f.x, f.y, f.feature, f));
  assert.equal(tiles.getFeature(3, 2), undefined, 'burned grass stays gone on restoration');
}
// Large, cyclic patches terminate iteratively with a single terrain refresh.
{
  const { ctx, flyer } = flightSetup();
  tiles.clearAllFeatures();
  flightDungeon.currentLevel = Array.from({ length: 50 }, () => Array(50).fill(0));
  for (let y = 0; y < 50; y++) for (let x = 0; x < 50; x++) tiles.setFeature(x, y, 'grass');
  let refreshes = 0; flightDungeon.onTerrainChanged = () => refreshes++;
  flightDungeon.igniteGrass(ctx, flyer, 0, 0);
  let remaining = 0; tiles.forEachFeature(() => remaining++);
  assert.equal(remaining, 0); assert.equal(refreshes, 1);
}
console.log('terrain-pressure: generation, secrets, FOV, paths, persistence, reusable/summon/alarm traps, fire spread, arrows, stacks, deaths and levitation passed');
