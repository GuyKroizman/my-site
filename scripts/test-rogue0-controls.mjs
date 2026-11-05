import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('controls');
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { applyInspectChoice, createGameContext, forgetInspectedEntity, isModalOpen } from '../src/games/rogue0/context.ts';
import { actionCost, starvationDamageDuring } from '../src/games/rogue0/timing.ts';
import { createHeroNavigation } from '../src/games/rogue0/heroNavigation.ts';
import { createHeroTargeting } from '../src/games/rogue0/heroTargeting.ts';
import { createHeroInput } from '../src/games/rogue0/heroInput.ts';
import { cursorDirection } from '../src/games/rogue0/heroControlRules.ts';

// Import whole production modules: only world/rendering boundaries are faked.
function fixture() {
  const context = createGameContext();
  const state = { door: false, wall: false, trap: undefined, chasm: false,
    hidden: new Set(), blockedLOS: new Set(), paths: [], moves: [], attacks: [],
    pickups: [], found: 0, searches: 0, falls: 0, confirms: [], throws: [], stumbles: 0 };
  const level = Array.from({ length: 8 }, () => Array(8).fill(0));
  const keyboard = new EventEmitter(), input = new EventEmitter(), events = new EventEmitter();
  input.keyboard = keyboard;
  context.scene = { input, events };
  context.map = { worldToTileX: x => x, worldToTileY: y => y };
  context.visibleTiles = new Set(level.flatMap((row, y) => row.map((_, x) => `${x},${y}`)));
  const hero = {
    context, type: 'player', x: 1, y: 1, healthPoints: 30, hunger: 100,
    movementSpeed: 1, attackDelay: 1, nextActionTime: 0, actionReady: true, effects: [],
    inputBuffer: [], walkPath: [], acknowledgedWalkEnemies: new Set(), zapping: false,
    actions: [], items: [], acceptPickup: true,
    weapon: { range: () => 0, attackDelay: 1.5, attackTile: 12, tile: 2, damageType: 'physical' },
    canAct() { return this.actionReady && !this.moving && !this.effects.some(e => e.id === 'frozen'); },
    currentWeapon() { return this.weapon; },
    spendTurn(action) {
      this.actions.push(action);
      this.nextActionTime += actionCost(this, action, this.weapon?.attackDelay ?? this.attackDelay);
      this.actionReady = false;
    },
    getAllItems() { return this.items; },
    slotOf(item) { return this.weapon === item ? 'weapon' : undefined; },
    addItem(item) { if (!this.acceptPickup) return false; this.items.push(item); return true; },
    throwAt(x, y) { state.throws.push([x, y]); },
    search() {
      if (!this.canAct()) return;
      state.searches++;
      this.walkPath = [];
      this.spendTurn('search');
    },
    waitTurn() { if (this.canAct()) { this.walkPath = []; this.spendTurn('wait'); } },
  };
  context.player = hero;
  context.entities = [hero];
  context.onConfirmChasm = (warning, confirm) => state.confirms.push({ warning, confirm });
  const hasEffect = (actor, id) => actor.effects.some(effect => effect.id === id);
  const dungeon = {
    getCurrentLevel: () => level,
    entityAtTile: (ctx, x, y) => ctx.entities.find(entity => entity.x === x && entity.y === y),
    distanceBetweenEntities: (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)),
    attackEntity: (_ctx, actor, target) => state.attacks.push([actor, target]),
    log: (ctx, text) => ctx.messages.unshift(text),
    findPath(sx, sy, tx, ty, throughDoors, avoidTraps, actor) {
      state.paths.push([tx, ty]);
      assert.equal(throughDoors, true); assert.equal(avoidTraps, true); assert.equal(actor, hero);
      const path = [[sx, sy]];
      while (sx !== tx || sy !== ty) {
        sx += Math.sign(tx - sx); sy += Math.sign(ty - sy); path.push([sx, sy]);
        if (path.length > 20) throw Error('Bad test route');
      }
      return path;
    },
    confusedMove(_ctx, actor) {
      if (hasEffect(actor, 'rooted')) return false;
      state.stumbles++;
      actor.walkPath = []; actor.inputBuffer = [];
      actor.spendTurn('move'); return true;
    },
    itemPicked: item => state.pickups.push(item),
    moveEntityTo(_ctx, actor, x, y) { state.moves.push([x, y]); actor.x = x; actor.y = y; },
    openDoor() { if (!state.door) return false; state.door = false; return true; },
    isWalkableTile: (ctx, x, y) => !state.wall && !dungeon.entityAtTile(ctx, x, y),
    canStepBetween: (sx, sy, tx, ty) => Math.max(Math.abs(tx - sx), Math.abs(ty - sy)) === 1,
    canEnterChasm: () => state.chasm,
    stepIntoChasm() { state.falls++; return true; },
    inspectTile: () => 'Stone floor',
  };
  const services = { dungeon, hasEffect, isModalOpen, actionCost, starvationDamageDuring,
    getTrapState: () => state.trap,
    isGrassConcealed: (x, y) => state.hidden.has(`${x},${y}`),
    hasLineOfSight: (_map, _sx, _sy, tx, ty) => !state.blockedLOS.has(`${tx},${ty}`),
  };
  const controls = { ...createHeroNavigation(services), ...createHeroTargeting(services), ...createHeroInput(services) };
  for (const [name, method] of Object.entries(controls)) hero[name] = (...args) => method(hero, ...args);
  return { hero, context, state, controls, dungeon, keyboard, input, events };
}
function enemy(f, x, y, properties = {}) {
  const target = { type: 'enemy', x, y, healthPoints: 10, sprite: {}, ...properties };
  f.context.entities.push(target); return target;
}
function ready(f) { f.hero.actionReady = true; f.context.simulationTime = f.hero.nextActionTime; }
function key(f, value) {
  let prevented = 0;
  f.keyboard.emit('keydown', { key: value, preventDefault() { prevented++; } });
  return prevented;
}

// Direction mapping is shared by movement and cursors, including diagonal keys.
for (const [key, dx, dy] of [
  ['h', -1, 0], ['l', 1, 0], ['k', 0, -1], ['j', 0, 1],
  ['ArrowLeft', -1, 0], ['ArrowRight', 1, 0], ['ArrowUp', 0, -1], ['ArrowDown', 0, 1],
  ['Home', -1, -1], ['PageUp', 1, -1], ['End', -1, 1], ['PageDown', 1, 1],
  ['u', -1, -1], ['i', 1, -1], ['n', -1, 1], ['m', 1, 1],
]) assert.deepEqual(cursorDirection(key), { dx, dy });
assert.equal(cursorDirection('H'), undefined, 'uppercase vi keys retain their existing behavior');
assert.equal(cursorDirection('I'), undefined, 'uppercase diagonals retain their existing behavior');

// Binding twice never duplicates commands; shutdown removes only our listeners.
{
  const f = fixture();
  let unrelated = 0;
  f.keyboard.on('keydown', () => unrelated++);
  f.hero.bindInput(); f.hero.bindInput();
  assert.equal(f.keyboard.listenerCount('keydown'), 2);
  assert.equal(f.input.listenerCount('pointerup'), 1);
  assert.equal(f.events.listenerCount('shutdown'), 1);
  assert.equal(key(f, 'ArrowRight'), 1);
  assert.deepEqual(f.state.moves, [[2, 1]]);
  assert.deepEqual(f.hero.inputBuffer, []);
  assert.equal(unrelated, 1);
  f.events.emit('shutdown');
  assert.equal(f.keyboard.listenerCount('keydown'), 1);
  assert.equal(f.input.listenerCount('pointerup'), 0);
  assert.equal(f.events.listenerCount('shutdown'), 0);
  ready(f); key(f, 'ArrowRight');
  assert.equal(f.state.moves.length, 1);
  f.hero.bindInput(); key(f, 'ArrowRight');
  assert.equal(f.state.moves.length, 2, 'rebinding after shutdown is supported');
}

// Rebinding a host to another scene detaches the old scene, not other heroes.
{
  const first = fixture(), second = fixture();
  first.hero.bindInput();
  first.hero.context = second.context;
  first.controls.bindInput(first.hero);
  assert.equal(first.keyboard.listenerCount('keydown'), 0);
  assert.equal(first.input.listenerCount('pointerup'), 0);
  assert.equal(first.events.listenerCount('shutdown'), 0);
  assert.equal(second.keyboard.listenerCount('keydown'), 1);
  first.controls.bindInput(second.hero);
  assert.equal(second.keyboard.listenerCount('keydown'), 2);
  second.events.emit('shutdown');
  assert.equal(second.keyboard.listenerCount('keydown'), 0);
  assert.equal(second.input.listenerCount('pointerup'), 0);
}

// Waiting actors buffer four commands, drain one per ready action, and allow
// aiming/cancellation while animation or frozen state blocks physical actions.
{
  const f = fixture(); f.hero.bindInput(); f.hero.actionReady = false;
  for (const value of ['l', 'j', 'h', 'k', 's', 'x']) key(f, value);
  assert.deepEqual(f.hero.inputBuffer, ['l', 'j', 'h', 'k']);
  f.hero.drainInputBuffer(); assert.equal(f.hero.inputBuffer.length, 4);
  ready(f); f.hero.drainInputBuffer();
  assert.deepEqual(f.state.moves, [[2, 1]]);
  assert.deepEqual(f.hero.inputBuffer, ['j', 'h', 'k']);
  f.context.throwMode = true; f.context.throwItem = {}; f.context.cursorX = 3; f.context.cursorY = 3;
  key(f, 'l');
  assert.deepEqual([f.context.cursorX, f.context.cursorY], [4, 3]);
  assert.equal(f.hero.inputBuffer.length, 3);
  key(f, 'Enter'); assert.deepEqual(f.state.throws, [[4, 3]]);
  key(f, 'Escape'); assert.equal(f.context.throwMode, false);
  f.context.inventoryOpen = true;
  key(f, 'l'); assert.equal(f.hero.inputBuffer.length, 3, 'modal keys never queue movement');
}

// Walls/traps are free; closed doors are separate actions; pickup and movement
// share one action, while full backpacks/chests don't move the hero.
{
  const f = fixture(); f.state.wall = true;
  f.hero.processInput('l'); assert.equal(f.hero.nextActionTime, 0);
  f.state.wall = false; f.state.trap = 'visible';
  f.hero.processInput('l'); assert.equal(f.hero.nextActionTime, 0);
  f.state.trap = undefined; f.state.door = true;
  f.hero.processInput('l');
  assert.deepEqual(f.hero.actions, ['openDoor']); assert.equal(f.hero.x, 1);
  ready(f); f.hero.processInput('l');
  assert.deepEqual(f.hero.actions, ['openDoor', 'move']); assert.equal(f.hero.x, 2);
}
for (const method of ['manual', 'auto']) {
  const f = fixture();
  const item = { type: 'item', x: 2, y: 1, displayName: 'Amulet' };
  f.context.entities.push(item);
  const act = () => {
    if (method === 'manual') f.hero.processInput('l');
    else { f.hero.setWalkTarget(2, 1); f.hero.stepAutoWalk(); }
  };
  f.hero.acceptPickup = false; act();
  assert.equal(f.hero.nextActionTime, 0); assert.equal(f.hero.x, 1);
  f.hero.acceptPickup = true; act();
  assert.deepEqual(f.hero.actions, ['move']); assert.equal(f.hero.x, 2);
  assert.deepEqual(f.state.pickups, [item]);
  assert.equal(f.context.messages[0], 'You picked up an Amulet.');
  const chest = { type: 'item', x: 3, y: 1, isContainer: true,
    openContainer() { f.hero.spendTurn('use'); } };
  f.context.entities.push(chest); ready(f);
  if (method === 'manual') f.hero.processInput('l');
  else { f.hero.setWalkTarget(3, 1); f.hero.stepAutoWalk(); }
  assert.equal(f.hero.x, 2); assert.deepEqual(f.hero.actions, ['move', 'use']);
}

// Rooted heroes can attack but not move. Confusion delegates to one stumble;
// deliberately attacking an adjacent enemy does not reroll that choice.
{
  const f = fixture(); f.hero.effects = [{ id: 'rooted' }];
  f.hero.processInput('l'); assert.deepEqual(f.hero.actions, []);
  const target = enemy(f, 2, 1);
  f.hero.processInput('l');
  assert.deepEqual(f.state.attacks, [[f.hero, target]]);
  assert.equal(f.hero.nextActionTime, 1.5);
  ready(f); f.hero.effects = [{ id: 'confused' }]; f.hero.processInput('l');
  assert.equal(f.state.stumbles, 0);
  f.context.entities = [f.hero]; ready(f); f.hero.processInput('l');
  assert.equal(f.state.stumbles, 1);
  assert.equal(f.state.moves.length, 0);
}

// New visible threats cancel a route even between actions; previously
// acknowledged or grass-concealed threats do not interrupt it.
{
  const f = fixture(); const known = enemy(f, 6, 6);
  f.hero.setWalkTarget(5, 1);
  assert.ok(f.hero.acknowledgedWalkEnemies.has(known));
  const hidden = enemy(f, 7, 7); f.state.hidden.add('7,7');
  f.hero.stepAutoWalk(); assert.deepEqual(f.state.moves, [[2, 1]]);
  enemy(f, 4, 4); f.hero.stepAutoWalk();
  assert.deepEqual(f.hero.walkPath, []);
  assert.equal(f.hero.walkTargetEntity, undefined);
  assert.equal(f.hero.nextActionTime, 1);
  assert.ok(f.context.entities.includes(hidden));
}
{
  const f = fixture(); const target = enemy(f, 5, 1);
  f.hero.setWalkTarget(5, 1, target); target.x = 6;
  f.hero.stepAutoWalk();
  assert.ok(f.state.paths.some(([x, y]) => x === 6 && y === 1));
  ready(f); f.context.visibleTiles.delete('7,1'); target.x = 7; f.state.paths = [];
  f.hero.stepAutoWalk();
  assert.equal(f.hero.walkTargetEntity, undefined);
  assert.ok(f.state.paths.every(([x]) => x === 6), 'continue to last seen destination, not hidden current position');
  ready(f); f.hero.setWalkTarget(7, 1, target); target.healthPoints = 0;
  f.hero.stepAutoWalk(); assert.deepEqual(f.hero.walkPath, []);
}

// Starvation checks use actual fractional action cost, before any door/pickup.
{
  const f = fixture(); f.hero.hunger = 0; f.hero.healthPoints = 1; f.state.door = true;
  f.hero.setWalkTarget(5, 1); f.hero.stepAutoWalk();
  assert.deepEqual(f.hero.actions, []); assert.equal(f.state.door, true);
  assert.match(f.context.messages[0], /starvation would kill you/);
  f.state.door = false; f.hero.effects = [{ id: 'haste' }];
  f.hero.setWalkTarget(5, 1); f.hero.stepAutoWalk();
  assert.equal(f.hero.nextActionTime, 0.5);
  ready(f); f.hero.stepAutoWalk();
  assert.equal(f.hero.nextActionTime, 0.5, 'stop before the next integer hunger tick');
}

// Chasm confirmation is free and asynchronous; stale callbacks cannot commit.
for (const stale of ['floor', 'position', 'death', 'readiness', 'modal', 'none']) {
  const f = fixture(); f.state.chasm = true;
  f.hero.walkPath = [{ x: 2, y: 1 }]; f.hero.inputBuffer = ['l'];
  f.hero.processInput('l');
  assert.equal(f.state.falls, 0); assert.deepEqual(f.hero.actions, []);
  assert.deepEqual(f.hero.inputBuffer, []); assert.deepEqual(f.hero.walkPath, []);
  assert.match(f.state.confirms[0].warning, /maximum HP/);
  if (stale === 'floor') f.context.floor++;
  if (stale === 'position') f.hero.x++;
  if (stale === 'death') f.hero.healthPoints = 0;
  if (stale === 'readiness') f.hero.actionReady = false;
  if (stale === 'modal') f.context.inventoryOpen = true;
  f.state.confirms[0].confirm();
  assert.equal(f.state.falls, stale === 'none' ? 1 : 0, stale);
}
{
  const f = fixture(); f.context.floor = 25; f.state.chasm = true;
  f.hero.setWalkTarget(2, 1);
  assert.match(f.state.confirms[0].warning, /death/);
}

// Aim filtering is independent of entity order, excludes decoys/dead/hidden
// actors, and uses nearest Chebyshev distance with stable ties.
{
  const f = fixture(); const wand = { displayName: 'Wand', charges: 3 }; f.hero.items = [wand];
  enemy(f, 2, 1, { isDecoy: true }); enemy(f, 1, 2, { healthPoints: 0 });
  enemy(f, 2, 2); f.state.hidden.add('2,2');
  enemy(f, 3, 1); f.state.blockedLOS.add('3,1');
  enemy(f, 1, 3); f.context.visibleTiles.delete('1,3');
  const chosen = enemy(f, 4, 1); const tie = enemy(f, 1, 4);
  f.hero.beginThrow(wand, true);
  assert.equal(f.hero.closestZapTarget(), chosen);
  assert.deepEqual([f.context.cursorX, f.context.cursorY], [4, 1]);
  assert.deepEqual(f.hero.actions, []); assert.equal(wand.charges, 3);
  const loot = { type: 'item', x: 1, y: 4, sprite: {} }; f.context.entities.unshift(loot);
  f.hero.processTouchInput(f.context, { worldX: tie.x, worldY: tie.y });
  assert.deepEqual(f.state.throws, []);
  assert.deepEqual([f.context.cursorX, f.context.cursorY], [1, 4]);
  f.hero.processTouchInput(f.context, { worldX: tie.x, worldY: tie.y });
  assert.deepEqual(f.state.throws, [[1, 4]]);
  f.hero.cancelThrow();
  assert.equal(f.hero.zapping, false); assert.equal(f.context.throwItem, undefined);
  f.context.entities = [f.hero]; f.hero.beginThrow(wand, true);
  assert.deepEqual([f.context.cursorX, f.context.cursorY], [1, 1]);
  f.hero.cancelThrow();
  const cursed = { cursed: true, displayName: 'Sword' }; f.hero.items = [cursed]; f.hero.weapon = cursed;
  f.hero.beginThrow(cursed); assert.equal(f.context.throwMode, false);
  f.hero.beginThrow({}); assert.equal(f.context.throwMode, false);
}

// `f` no longer triggers a class special: the action and its binding are gone.
{
  const f = fixture(); f.hero.bindInput();
  const before = f.hero.nextActionTime;
  key(f, 'f'); key(f, 'F');
  assert.equal(f.hero.nextActionTime, before, 'f spends no time');
  assert.deepEqual(f.hero.inputBuffer, [], 'f is not even a buffered command');
  assert.deepEqual([f.state.moves.length, f.state.attacks.length, f.state.searches], [0, 0, 0]);
}

// Inspect stays free and visibility-limited; a second inspect request searches.
{
  const f = fixture(); f.hero.actionReady = false;
  f.hero.processInput('x'); assert.equal(f.context.inspectMode, true);
  f.context.visibleTiles.delete('7,7');
  f.hero.processTouchInput(f.context, { worldX: 7, worldY: 7 });
  assert.equal(f.context.inspectMode, false); assert.equal(f.context.inspectedTerrain, undefined);
  const a = enemy(f, 3, 3), b = enemy(f, 3, 3);
  f.hero.inspectTile(3, 3);
  assert.deepEqual(f.context.inspectChoices.map(choice => choice.entity), [a, b]);
  f.context.inspectChoices = undefined; f.context.entities = [f.hero];
  f.hero.inspectOrSearch(); assert.equal(f.context.inspectMode, true);
  ready(f); f.hero.inspectOrSearch();
  assert.equal(f.state.searches, 1); assert.equal(f.hero.nextActionTime, 2);
}

// Terrain on a tile with an item is offered as its own inspect entry instead of
// being hidden behind the item, and can be selected on its own.
{
  const f = fixture();
  const scroll = { type: 'item', x: 3, y: 3, sprite: {}, displayName: 'Scroll of Blink',
    identified: false };
  f.context.entities.push(scroll);
  f.dungeon.inspectTileInfo = () => ({ label: 'Dart trap',
    description: 'A dart trap (poisons). Single-use: spent after activation.' });
  f.context.visibleTiles.add('3,3');
  f.hero.inspectTile(3, 3);
  assert.equal(f.context.inspectedEntity, undefined, 'the item no longer wins by default');
  assert.deepEqual(f.context.inspectChoices.map(choice => choice.kind), ['entity', 'terrain']);
  assert.equal(f.context.inspectChoices[1].label, 'Dart trap');
  applyInspectChoice(f.context, f.context.inspectChoices[1]);
  assert.equal(f.context.inspectChoices, undefined);
  assert.equal(f.context.inspectedTerrain, 'A dart trap (poisons). Single-use: spent after activation.');
  assert.equal(f.context.inspectedEntity, undefined);
  applyInspectChoice(f.context, { kind: 'entity', entity: scroll });
  assert.equal(f.context.inspectedEntity, scroll);
  assert.equal(f.context.inspectedTerrain, undefined);
  // An item on plain floor still resolves straight to the item.
  f.dungeon.inspectTileInfo = () => ({ description: 'Stone floor.' });
  f.hero.inspectTile(3, 3);
  assert.equal(f.context.inspectChoices, undefined);
  assert.equal(f.context.inspectedEntity, scroll);
  // Killing a listed entity drops only its entry.
  f.dungeon.inspectTileInfo = () => ({ label: 'Dart trap', description: 'A dart trap.' });
  f.hero.inspectTile(3, 3);
  assert.equal(f.context.inspectChoices.length, 2);
  forgetInspectedEntity(f.context, scroll);
  assert.deepEqual(f.context.inspectChoices.map(choice => choice.kind), ['terrain']);
  forgetInspectedEntity(f.context, scroll);
  assert.equal(f.context.inspectChoices.length, 1, 'unrelated entities leave the list alone');
}

// Pinch/pan/modal taps never become walk commands; stairs dispatch only while
// standing on the tile, without spending a turn in the input layer itself.
{
  const f = fixture();
  for (const flag of ['pinching', 'panning', 'inventoryOpen']) {
    f.context[flag] = true;
    f.hero.processTouchInput(f.context, { worldX: 5, worldY: 1 });
    assert.deepEqual(f.hero.walkPath, []); f.context[flag] = false;
  }
  let down = 0, up = 0;
  f.context.stairsX = 1; f.context.stairsY = 1; f.context.onDescend = () => down++;
  f.hero.processTouchInput(f.context, { worldX: 1, worldY: 1 }); assert.equal(down, 1);
  f.context.upstairsX = 1; f.context.upstairsY = 1; f.context.onAscend = () => up++;
  f.hero.processTouchInput(f.context, { worldX: 1, worldY: 1 }); assert.equal(up, 1);
  assert.deepEqual(f.hero.actions, []);
}
console.log('Rogue0 controls: real-module input lifecycle, buffering, routing, costs, pickups, roots/confusion, pursuit, starvation, chasm confirmations, visibility, wand aiming and touch gestures passed');
