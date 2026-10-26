import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('movement');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import PF from 'pathfinding';

// Load real TS logic with rendering/audio imports replaced by small fakes.
function load(path, bindings = {}) {
  const source = fs.readFileSync(path, 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
  const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
  const exports = {};
  new Function('exports', ...Object.keys(bindings), js)(exports, ...Object.values(bindings));
  return exports;
}
const { actionCost } = load('src/games/rogue0/timing.ts');
const rendering = load('src/games/rogue0/rendering.ts');
const doorTextures = new Map();
load('src/games/rogue0/potionTextures.ts').generateDoorThresholdTexture({
  textures: { exists: key => doorTextures.has(key) },
  make: { graphics: () => ({
    fillStyle() {}, fillRect() {}, destroy() {},
    generateTexture(key, width, height) { doorTextures.set(key, { width, height }); },
  }) },
});
for (const key of ['door-front', 'door-side']) {
  assert.deepEqual(doorTextures.get(key), { width: 16, height: 21 }, 'both door orientations have real height rather than floating 16px art');
}
for (const height of [16, 21, 22, 24, 32]) {
  const top = -rendering.actorOriginY(height) * height;
  assert.ok(Math.abs(top + height - 16) < 1e-9, 'all actor sizes keep their feet at the cell bottom');
  if (height > 16) assert.ok(top < 0, 'tall actors extend over the wall in the row above');
}
assert.equal(rendering.wallOverhang([[0], [1]], 0, 1), true, 'south wall overlaps corridor occupants');
assert.equal(rendering.wallOverhang([[1], [0]], 0, 0), false, 'north wall does not project into the corridor below');
assert.equal(rendering.wallOverhang([[1], [1]], 0, 1), false, 'solid wall interiors need no overhang');
assert.equal(rendering.wallOverhang([[0], [0]], 0, 1), false, 'revealed passages remove wall overlap');
assert.equal(rendering.doorPassage([[1, 1, 1], [0, 0, 0], [1, 1, 1]], 1, 1), 'horizontal', 'east-west passage uses a side-on door');
assert.equal(rendering.doorPassage([[1, 0, 1], [1, 0, 1], [1, 0, 1]], 1, 1), 'vertical', 'north-south passage uses the broad door face');
assert.equal(rendering.doorPassage([[0, 0, 0], [0, 0, 0], [0, 0, 0]], 1, 1), 'vertical', 'ambiguous junction has a stable default');
assert.equal(rendering.doorPassage([[0, 0]], 0, 0), 'horizontal', 'map boundaries count as walls');
for (const y of [0, 16, 160, 1600]) {
  assert.ok(rendering.worldDepth(y + 16, 'terrain') > rendering.worldDepth(y, 'actor'), 'near grass/doors overlap actors behind');
  assert.ok(rendering.worldDepth(y, 'actor') > rendering.worldDepth(y, 'terrain'), 'actors stand in front of their own terrain');
  assert.ok(rendering.worldDepth(y, 'actor') < 99, 'world stays below gas and fog');
}
assert.ok(rendering.UPRIGHT_LIFT > 0 && rendering.UPRIGHT_LIFT < 16, 'upright silhouettes overlap without shifting a full cell');
const { Entity } = load('src/games/rogue0/entity.ts', { actionCost, ...rendering });
const hasEffect = (e, id) => e.effects.some(effect => effect.id === id);
const removeEffect = (e, id) => { e.effects = e.effects.filter(effect => effect.id !== id); };
const manager = load('src/games/rogue0/turnManager.ts', {
  dungeon: { log() {} }, hasEffect, removeEffect
}).default;

function actor(type, action = 'wait') {
  const e = new Entity();
  Object.assign(e, {
    type, healthPoints: 10, turns: 0, ticks: 0,
    context: { simulationTime: 0, messages: [] },
    refresh() { this.ticks++; }, tickEffects() {},
    turn() { if (type !== 'player') { this.turns++; this.spendTime(action); } }
  });
  return e;
}
function setup() {
  const player = actor('player');
  const enemy = actor('enemy');
  const entities = [player, enemy, ...Array.from({ length: 100 }, () => actor('item'))];
  manager.reset(entities);
  return { player, enemy, entities };
}
let { player, enemy, entities } = setup();
for (let i = 0; i < 100; i++) manager.update(entities);
assert.equal(manager.time, 0, 'waiting for input never advances world time');
assert.equal(enemy.turns, 0);
player.effects = [{ id: 'haste' }];
player.spendTime('move');
manager.update(entities);
assert.equal(manager.time, 0.5);
assert.equal(enemy.turns, 1);
assert.equal(player.ticks, 0, 'half a time unit is not a hunger/effect tick');
player.spendTime('move');
manager.update(entities);
assert.equal(manager.time, 1);
assert.equal(enemy.turns, 1, 'two fast moves fit between normal enemy actions');
assert.equal(player.ticks, 1);
assert.equal(actionCost(player, 'attack'), 1, 'haste affects movement only');
player.effects.push({ id: 'crippled' });
assert.equal(actionCost(player, 'move'), 1, 'haste and cripple cancel');
player.effects = [{ id: 'crippled' }];
assert.equal(actionCost(player, 'move'), 2);
assert.equal(actionCost(player, 'search'), 2);
assert.equal(actionCost(player, 'attack', 1.5), 1.5);
assert.equal(actionCost(player, 'attack', 0), 1, 'invalid delays cannot loop');

({ player, enemy, entities } = setup());
player.spendTime('attack', 1.5);
player.moving = true;
for (let i = 0; i < 20; i++) manager.update(entities);
assert.equal(manager.time, 0, 'animations must resolve before later events');
player.moving = false;
manager.update(entities);
assert.equal(manager.time, 1.5);
assert.equal(enemy.turns, 2, 'slow attack permits two normal enemy actions');
assert.equal(player.ticks, 1);
assert.equal(player.actionReady, true);

// Fast monsters use the same queue, but their attack speed is independent.
({ player, enemy, entities } = setup());
enemy.movementSpeed = 2;
enemy.turn = function () { this.turns++; this.spendTime('move'); };
player.spendTime('wait');
manager.update(entities);
assert.equal(enemy.turns, 2);
assert.equal(actionCost(enemy, 'attack'), 1);

// Fractional costs accumulate, without rounding each action to a round.
({ player, enemy, entities } = setup());
for (let i = 0; i < 4; i++) {
  player.spendTime('attack', 1.25);
  manager.update(entities);
}
assert.equal(manager.time, 5);
assert.equal(player.ticks, 5);
assert.equal(enemy.turns, 5);

({ player, enemy, entities } = setup());
player.effects = [{ id: 'frozen' }];
manager.update(entities);
assert.equal(manager.time, 1);
assert.equal(hasEffect(player, 'frozen'), false);
assert.equal(player.actionReady, true);

// World-tick deaths and loot insertion must not corrupt scheduling.
({ player, enemy, entities } = setup());
enemy.tickEffects = () => {
  entities.splice(entities.indexOf(enemy), 1);
  entities.push(actor('item'));
};
player.spendTime('search');
manager.update(entities);
assert.equal(manager.time, 2);
assert.equal(player.actionReady, true);
assert.ok(!entities.includes(enemy));
manager.reset(entities);
assert.equal(player.nextActionTime, 0);
assert.equal(manager.time, 0);

// Real hero input/pickup logic, with rendering and pathfinding stubbed.
const item = { type: 'item', displayName: 'Potion' };
let picked = 0;
let moved = 0;
const dungeon = {
  entityAtTile: () => item, itemPicked() { picked++; }, log() {},
  moveEntityTo() { moved++; }, openDoor() {},
  canStepBetween: () => true,
  isWalkableTile: () => false, attackEntity() {}
};
const Hero = load('src/games/rogue0/classes/basicHero.ts', {
  Entity, ...load('src/games/rogue0/timing.ts'), Gem: class Gem {}, Wand: class Wand {}, dungeon, isModalOpen: () => false, hasEffect, removeEffect,
  isGrassConcealed: () => false, getTrapState: () => undefined, sfx: { potion() {}, equip() {} },
  spawnEntityFloatingText() {}
}).default;
// Auto-walk never commits an action whose upkeep would starve the hero to death.
{
  const original = { ...dungeon };
  let actions = 0, messages = 0, doors = 0;
  Object.assign(dungeon, { entityAtTile: () => undefined, isWalkableTile: () => true,
    moveEntityTo() {}, openDoor() { doors++; }, log() { messages++; } });
  const walker = Object.assign(Object.create(Hero.prototype), {
    context: { entities: [], visibleTiles: new Set(), simulationTime: 0 },
    acknowledgedWalkEnemies: new Set(), effects: [], hunger: 0, healthPoints: 1,
    movementSpeed: 1, attackDelay: 1, actionReady: true, moving: false,
    currentWeapon: () => undefined, movementCostMultiplier: () => 1,
    nextStepToward: () => ({ x: 2, y: 1 }), spendTurn() { actions++; },
  });
  const attempt = () => { walker.walkPath = [{ x: 2, y: 1 }]; walker.stepAutoWalk(); };
  attempt();
  assert.equal(actions, 0); assert.equal(doors, 0); assert.equal(messages, 1);
  assert.deepEqual(walker.walkPath, []);
  attempt();
  assert.equal(actions, 0, 'retapping cannot bypass starvation protection');
  walker.healthPoints = 2;
  attempt();
  assert.equal(actions, 1, 'safe starving steps remain allowed');
  walker.healthPoints = 1; walker.hunger = 20;
  attempt();
  assert.equal(actions, 2, 'fed low-health movement remains allowed');
  walker.hunger = 0; walker.movementSpeed = 2;
  attempt();
  assert.equal(actions, 3, 'half-step before the next upkeep is safe');
  walker.context.simulationTime = 0.5;
  attempt();
  assert.equal(actions, 3, 'half-step crossing the lethal upkeep is blocked');
  walker.context.simulationTime = 0; walker.movementSpeed = 0.5; walker.healthPoints = 2;
  attempt();
  assert.equal(actions, 3, 'slow movement may incur multiple lethal starvation ticks');
  Object.assign(dungeon, original);
}
// Combined magnifying glass: inspection is free; a second press searches.
const lookHero = new Entity();
Object.setPrototypeOf(lookHero, Hero.prototype);
const modeChanges = [];
Object.assign(lookHero, {
  context: { inspectMode: false, onInspectModeChange: mode => modeChanges.push(mode) },
  x: 3, y: 4, walkPath: [{ x: 4, y: 4 }], actionReady: true,
});
let searches = 0;
dungeon.searchAround = () => { searches++; return 0; };
lookHero.inspectOrSearch();
assert.equal(lookHero.context.inspectMode, true);
assert.equal(lookHero.context.cursorX, 3);
assert.equal(lookHero.walkPath.length, 0, 'inspection stops auto-walking');
assert.equal(searches, 0, 'first press never searches');
assert.equal(lookHero.nextActionTime, 0, 'arming inspection is free');
lookHero.inspectOrSearch();
assert.equal(searches, 1);
assert.equal(lookHero.context.inspectMode, false);
assert.equal(lookHero.nextActionTime, 2, 'second press pays normal search cost');
assert.deepEqual(modeChanges, [true, false]);
lookHero.inspectOrSearch();
lookHero.inspectOrSearch();
assert.equal(searches, 1, 'search cannot bypass action readiness');
assert.equal(lookHero.context.inspectMode, false);

lookHero.inspectOrSearch();
Object.assign(lookHero.context, {
  map: { worldToTileX: () => 5, worldToTileY: () => 6 },
  entities: [], visibleTiles: new Set(['5,6']),
});
dungeon.inspectTile = () => 'Stone floor';
lookHero.processTouchInput(lookHero.context, { worldX: 5, worldY: 6 });
assert.equal(lookHero.context.inspectedTerrain, 'Stone floor');
assert.equal(lookHero.context.inspectMode, false, 'tile selection ends targeting');
assert.equal(lookHero.nextActionTime, 2, 'tile inspection spends no time');
assert.equal(searches, 1, 'selecting a tile does not search');

const hero = new Entity();
Object.setPrototypeOf(hero, Hero.prototype);
Object.assign(hero, {
  context: { entities: [], visibleTiles: new Set() },
  walkPath: [{ x: 1, y: 0 }], actionReady: false,
  nextStepToward: () => ({ x: 1, y: 0 }), addItem: () => true,
  x: 0, y: 0
});
hero.stepAutoWalk();
assert.equal(picked, 0);
assert.equal(hero.walkPath.length, 1, 'queued loot target survives waiting');
hero.actionReady = true;
hero.stepAutoWalk();
assert.equal(picked, 1);
assert.equal(moved, 1);
assert.equal(hero.nextActionTime, 1, 'pickup and move share one action cost');
assert.equal(hero.canAct(), false);

hero.actionReady = true;
hero.currentWeapon = () => ({ range: () => 0, attackDelay: 1.5 });
item.type = 'enemy';
hero.processInput('ArrowRight');
assert.equal(hero.canAct(), false, 'attack ends readiness even on a miss');
assert.equal(hero.nextActionTime, 2.5, 'keyboard attacks use weapon speed');
assert.equal(moved, 1);
hero.actionReady = true;
dungeon.entityAtTile = () => undefined;
hero.processInput('ArrowRight');
assert.equal(hero.canAct(), true, 'bumping a wall is free');
assert.equal(hero.nextActionTime, 2.5);

hero.context.messages = [];
const potion = { consumable: true, identified: true, equip() {} };
hero.getAllItems = () => [potion];
assert.equal(hero.useItem(potion), true);
assert.equal(hero.canAct(), false);
assert.equal(hero.useItem(potion), false, 'cannot consume while waiting');
assert.equal(hero.nextActionTime, 3.5);
assert.ok(!hero.statsText().includes('Ap:'));
assert.ok(!hero.statsText().includes('Mp:'));

hero.actionReady = true;
hero.effects = [{ id: 'rooted' }];
item.type = 'item';
dungeon.entityAtTile = () => item;
hero.walkPath = [{ x: 1, y: 0 }];
hero.stepAutoWalk();
assert.equal(picked, 1, 'rooted player cannot pick up an adjacent item');
assert.equal(hero.canAct(), true, 'rooting still allows other actions');
hero.waitTurn();
assert.equal(hero.canAct(), false);
// Hunger lasts four times as long without changing the world-time tick rate.
Object.assign(hero, { hunger: 100, maxHunger: 100, healthPoints: 1000, maxHealthPoints: 1000 });
let starvationDamage = 0;
hero.takeDamage = amount => { starvationDamage += amount; };
for (let tick = 0; tick < 399; tick++) hero.refresh();
assert.equal(hero.hunger, 0.25);
assert.equal(starvationDamage, 0, 'no starvation before 400 normal moves');
hero.refresh();
assert.equal(hero.hunger, 0);
assert.equal(starvationDamage, 1);
hero.refresh();
assert.equal(hero.hunger, 0, 'hunger cannot become negative');
hero.restoreHunger(25);
for (let tick = 0; tick < 99; tick++) hero.refresh();
assert.equal(hero.hunger, 0.25, 'restored food also lasts four times as long');
assert.equal(starvationDamage, 2, 'eating stops starvation damage');

// Starvation interrupts only on entry; resumed navigation remains usable.
delete hero.takeDamage;
hero.context.player = hero;
hero.hunger = 0.25;
hero.walkPath = [{ x: 1, y: 0 }];
hero.refresh();
assert.equal(hero.walkPath.length, 0, 'entering starvation stops navigation');
hero.walkPath = [{ x: 1, y: 0 }];
const starvingHealth = hero.healthPoints;
hero.refresh();
assert.equal(hero.walkPath.length, 1, 'resuming while starving keeps navigation');
assert.equal(hero.healthPoints, starvingHealth - 1, 'ongoing starvation still damages');
hero.takeDamage(1);
assert.equal(hero.walkPath.length, 0, 'other damage still stops navigation');
hero.restoreHunger(0.25);
hero.walkPath = [{ x: 1, y: 0 }];
hero.refresh();
assert.equal(hero.walkPath.length, 0, 'starving again after eating stops navigation');

// Fed healing, hungry suppression, and starving damage have distinct boundaries.
Object.assign(hero, { hunger: 60, healthPoints: 50, maxHealthPoints: 100 });
assert.equal(hero.hungerState, 'Fed');
hero.refresh();
hero.refresh();
assert.equal(hero.healthPoints, 50, 'no regeneration before three world-time units');
hero.refresh();
assert.equal(hero.healthPoints, 51, 'food below the old 80 threshold still heals');
hero.refresh();
hero.refresh();
hero.hunger = 30.25;
hero.refresh();
assert.equal(hero.hungerState, 'Fed', 'exactly 30 food is fed');
assert.equal(hero.healthPoints, 52);
hero.refresh();
assert.equal(hero.hungerState, 'Hungry');
assert.equal(hero.healthPoints, 52, 'entering hunger stops healing immediately');
assert.ok(hero.statsText().includes('(Hungry)'));
hero.hunger = 0.5;
hero.refresh();
assert.equal(hero.healthPoints, 52, 'hungry does not deal damage');
hero.refresh();
assert.equal(hero.hungerState, 'Starving');
assert.equal(hero.healthPoints, 51);
assert.ok(hero.statsText().includes('(Starving)'));
hero.restoreHunger(10);
hero.refresh();
assert.equal(hero.hungerState, 'Hungry');
assert.equal(hero.healthPoints, 51, 'small meals stop damage without enabling healing');
hero.restoreHunger(30);
hero.refresh();
hero.refresh();
hero.refresh();
assert.equal(hero.healthPoints, 52, 'sufficient food resumes natural healing');
assert.ok(hero.statsText().includes('(Fed)'));
hero.healthPoints = 99.5;
hero.refresh();
hero.refresh();
hero.refresh();
assert.equal(hero.healthPoints, 100, 'natural healing cannot exceed max HP');
hero.refresh();
assert.equal(hero.healthPoints, 100);
hero.restoreHunger(1000);
assert.equal(hero.hunger, 100, 'food remains capped');

const effects = load('src/games/rogue0/effects.ts', { spawnEntityFloatingText() {} });
// Continuous frost hits must not steal every action, even with two fast enemies.
for (const delay of [1, 0.25]) {
  ({ player, enemy, entities } = setup());
  const second = actor('enemy');
  entities.push(second);
  for (const attacker of [enemy, second]) {
    attacker.turn = function () {
      this.turns++;
      effects.applyEffect(player, effects.createFrozenEffect());
      this.spendTime('attack', delay);
    };
  }
  let frostSplashes = 0;
  player.x = player.y = 1;
  player.context.onFrostTerrain = () => frostSplashes++;
  for (let hit = 0; hit < 5; hit++) {
    player.spendTime('attack', 1.5);
    manager.update(entities);
    assert.equal(player.actionReady, true, 'frost victims get another action');
    assert.equal(hasEffect(player, 'frozen'), false);
    assert.equal(player.freezeRecovery, true);
    const time = manager.time;
    manager.update(entities);
    assert.equal(manager.time, time, 'choosing an action is still free');
    effects.applyEffect(player, effects.createFrozenEffect());
    assert.equal(hasEffect(player, 'frozen'), false, 'input wait retains protection');
  }
  assert.ok(frostSplashes > 5, 'blocked freezes still affect terrain');
  player.spendTime('move');
  assert.equal(player.freezeRecovery, false, 'committing an action ends protection');
  effects.applyEffect(player, effects.createFrozenEffect());
  assert.equal(hasEffect(player, 'frozen'), true, 'frost can freeze again after recovery');
}

// A buff applied between integer time boundaries keeps its full lifetime.
({ player, enemy, entities } = setup());
player.spendTime('attack', 0.5);
manager.update(entities);
assert.equal(manager.time, 0.5);
let effectTicks = 0;
effects.applyEffect(player, {
  id: 'test', name: 'Test', duration: 2,
  tick() { effectTicks++; }
});
player.tickEffects = () => effects.tickEffects(player, player.context);
player.spendTime('wait');
manager.update(entities);
assert.equal(manager.time, 1.5);
assert.equal(effectTicks, 1);
assert.equal(player.effects[0].duration, 1);
player.spendTime('wait');
manager.update(entities);
assert.equal(manager.time, 2.5);
assert.equal(effectTicks, 2);
assert.equal(player.effects.length, 0);

hero.context.simulationTime = 0.5;
hero.skillCooldown = 3;
hero.context.simulationTime = 3;
assert.equal(hero.skillCooldown, 1, 'cooldown must not expire at an early integer boundary');
hero.context.simulationTime = 3.5;
assert.equal(hero.skillCooldown, 0);
manager.reset(entities, true);
assert.equal(manager.time, 2.5, 'floor transitions preserve the world clock');
assert.equal(player.nextActionTime, 2.5);
// Equal elapsed time must produce identical survival/effect/cooldown outcomes,
// regardless of action count or extra render polling. Use real hero upkeep.
function elapsedRun(action, count, delay = 1, polls = 0) {
  const p = new Entity();
  Object.setPrototypeOf(p, Hero.prototype);
  Object.assign(p, {
    type: 'player', context: { simulationTime: 0, messages: [] },
    healthPoints: 50, maxHealthPoints: 100, hunger: 100, maxHunger: 100,
    movementSpeed: 4, turn() {},
    tickEffects() { effects.tickEffects(this, this.context); }
  });
  manager.reset([p]);
  p.skillCooldown = 7;
  effects.applyEffect(p, effects.createPoisonedEffect(4));
  for (let i = 0; i < count; i++) {
    p.spendTime(action, delay);
    manager.update([p]);
    const before = [manager.time, p.hunger, p.healthPoints, p.skillCooldown];
    for (let frame = 0; frame < polls; frame++) manager.update([p]);
    assert.deepEqual([manager.time, p.hunger, p.healthPoints, p.skillCooldown], before,
      'idle rendering cannot advance upkeep, effects or cooldowns');
  }
  return { time: manager.time, hunger: p.hunger, hp: p.healthPoints,
    cooldown: p.skillCooldown, effects: p.effects.length };
}
const elapsedExpected = { time: 6, hunger: 98.5, hp: 48, cooldown: 1, effects: 0 };
assert.deepEqual(elapsedRun('move', 24, 1, 10), elapsedExpected);
assert.deepEqual(elapsedRun('attack', 4, 1.5), elapsedExpected);
assert.deepEqual(elapsedRun('wait', 6), elapsedExpected);

// Non-binary fractions expose drift that four 1.25-cost actions cannot.
({ player, enemy, entities } = setup());
player.movementSpeed = 3;
for (let i = 0; i < 3000; i++) {
  player.spendTime('move');
  manager.update(entities);
}
assert.ok(Math.abs(manager.time - 1000) < 1e-9, 'fractional costs retain elapsed time');
assert.equal(player.ticks, 1000, 'fractional drift cannot lose world ticks');
assert.equal(enemy.turns, 1000, 'fractional drift cannot grant extra enemy turns');

// Two effects applied at different phases tick and expire independently,
// including during one long action spanning several events.
({ player, enemy, entities } = setup());
const phaseEvents = [];
player.tickEffects = () => effects.tickEffects(player, player.context);
function phasedEffect(id, duration) {
  return { id, name: id, duration,
    tick(e) { phaseEvents.push([id, 'tick', e.context.simulationTime]); },
    remove(e) { phaseEvents.push([id, 'remove', e.context.simulationTime]); } };
}
player.spendTime('attack', 0.25);
manager.update(entities);
effects.applyEffect(player, phasedEffect('early', 2));
player.spendTime('attack', 0.5);
manager.update(entities);
effects.applyEffect(player, phasedEffect('late', 2));
player.spendTime('attack', 0.49);
manager.update(entities);
assert.deepEqual(phaseEvents, [], 'neither effect ticks before its own boundary');
player.spendTime('attack', 2.51);
manager.update(entities);
assert.deepEqual(phaseEvents, [
  ['early', 'tick', 1.25], ['late', 'tick', 1.75],
  ['early', 'tick', 2.25], ['early', 'remove', 2.25],
  ['late', 'tick', 2.75], ['late', 'remove', 2.75]
]);
assert.equal(player.effects.length, 0);
assert.equal(player.ticks, 3, 'fractional effect events do not trigger extra upkeep');

// Exercise actual monster decision logic, not just fake scheduled actors.
let attacks = 0;
const { enemyTurn } = load('src/games/rogue0/ai.ts', {
  hasEffect, fleeStep: () => true, canSee: () => true,
  dungeon: { getCurrentLevel: () => [[]], attackEntity() { attacks++; } }
});
const monster = actor('enemy');
Object.assign(monster, {
  x: 1, y: 0, attackDelay: 1.5, movementSpeed: 2,
  range: () => 0, effects: [{ id: 'rooted' }]
});
monster.context.player = { x: 0, y: 0, effects: [] };
enemyTurn(monster);
assert.equal(attacks, 1, 'rooting does not prevent a monster attack');
assert.equal(monster.nextActionTime, 1.5);
monster.effects = [{ id: 'terrified' }];
enemyTurn(monster);
assert.equal(attacks, 1, 'terrified monster flees rather than attacks');
assert.equal(monster.nextActionTime, 2, 'fleeing uses movement speed');

// Player death during a time event must stop the simulation immediately.
({ player, enemy, entities } = setup());
player.refresh = () => { entities.splice(entities.indexOf(player), 1); };
player.spendTime('search');
manager.update(entities);
assert.equal(manager.time, 1);
assert.ok(!entities.includes(player));
// Skeletons use normal monster death handling and never spawn a replacement.
class DeathTestMonster {
  constructor(context, config, x, y) {
    Object.assign(this, config, { context, x, y, maxHealthPoints: config.healthPoints });
  }
  onDestroy() { this.context.deaths++; }
}
const Skeleton = load('src/games/rogue0/monsters/skelaton.ts', {
  Monster: DeathTestMonster, Gem: class {}, HolyPotion: class {}, BerserkPotion: class {},
  dungeon: { log() {} }
}).default;
const deathContext = { entities: [], deaths: 0 };
const skeleton = new Skeleton(deathContext, 3, 4);
skeleton.healthPoints = 0;
skeleton.onDestroy();
assert.equal(deathContext.deaths, 1, 'skeleton retains normal monster death handling');
assert.equal(deathContext.entities.length, 0, 'killed skeleton does not reanimate at its old position');

// Cover, awareness, and pursuit use real sight/combat/AI logic.
const doors = new Map();
const terrain = {
  getDoorState: (x, y) => doors.get(`${x},${y}`),
  getTileState: () => undefined
};
const sight = load('src/games/rogue0/fov.ts', { ...terrain, isGrassConcealed: () => false });
const arena = Array.from({ length: 7 }, () => Array(7).fill(0));
const combat = load('src/games/rogue0/combat.ts', {
  tiles: load('src/games/rogue0/tiles.ts'),
  canSee: sight.canSee, hasEffect, createBleedingEffect: () => ({ id: 'bleeding' })
});
const hunter = actor('enemy');
const target = actor('player');
Object.assign(target, { x: 4, y: 3, attack: () => 3, accuracy: 0 });
Object.assign(hunter, { x: 2, y: 3, visionRadius: 8, range: () => 0,
  protection: () => 0, evasion: 100 });
const huntContext = { player: target, entities: [target, hunter], currentLevel: arena,
  visibleTiles: new Set(), messages: [], simulationTime: 0 };
hunter.context = target.context = huntContext;
let plannedThroughDoors = false;
let plannedTarget;
let nextPath = [];
let huntAttacks = 0;
const huntAI = load('src/games/rogue0/ai.ts', {
  ...sight, hasEffect, fleeStep: () => false, tiles: terrain,
  dungeon: {
    getCurrentLevel: () => arena,
    findPath(sx, sy, tx, ty, throughDoors) {
      plannedThroughDoors = throughDoors; plannedTarget = [tx, ty]; return nextPath;
    },
    moveEntityTo(ctx, e, x, y) { e.x = x; e.y = y; },
    openDoor(x, y) { doors.set(`${x},${y}`, 'open'); return true; },
    attackEntity() { huntAttacks++; }
  }
});
doors.set('3,3', 'closed');
assert.equal(sight.canSee(arena, 2, 3, 4, 3, 8), false, 'closed door hides the player');
assert.equal(sight.canSee(arena, 2, 3, 3, 3, 8), true, 'door itself remains visible');
doors.set('3,3', 'open');
nextPath = [[2, 3], [3, 3], [4, 3]];
huntAI.enemyTurn(hunter);
assert.equal(hunter.awareOfPlayer, true);
assert.deepEqual([hunter.lastSeenX, hunter.lastSeenY], [4, 3]);
assert.equal(plannedThroughDoors, true, 'pursuit routes can cross doors');
assert.equal(combat.isSurpriseAttack(huntContext, target, hunter), false, 'visible pursuit is not an ambush');
huntAI.enemyTurn(hunter);
assert.equal(huntAttacks, 1);
assert.deepEqual([hunter.lastSeenX, hunter.lastSeenY], [4, 3], 'attacking enemies also remember the target');

hunter.x = 2;
doors.set('3,3', 'closed');
huntAI.enemyTurn(hunter);
assert.equal(hunter.x, 3, 'hunter opens and enters the door while pursuing');
assert.equal(doors.get('3,3'), 'open');
assert.equal(hunter.awareOfPlayer, false, 'emerging from cover leaves a reaction window');
assert.equal(combat.isSurpriseAttack(huntContext, target, hunter), true);
assert.equal(combat.resolveAttack(huntContext, target, hunter).hit, true, 'surprise bypasses evasion');
assert.equal(combat.isSurpriseAttack(huntContext, target, hunter), false, 'ambush is consumed by the attack');

// Walking around a one-tile pillar breaks sight without erasing pursuit.
doors.clear();
arena[3][3] = 1;
hunter.x = 2; hunter.y = 3;
target.x = 3; target.y = 2;
assert.equal(sight.canSee(arena, 2, 3, 3, 2, 8), false, 'pillar edge blocks diagonal peeking');
nextPath = [[2, 3], [2, 2], [3, 2], [4, 2], [4, 3]];
huntAI.enemyTurn(hunter);
assert.equal(hunter.awareOfPlayer, false);
assert.deepEqual(plannedTarget, [4, 3], 'hunter follows the last seen position around a pillar');
assert.equal(sight.canSee(arena, hunter.x, hunter.y, target.x, target.y, 8), true);
assert.equal(Math.max(Math.abs(hunter.x - target.x), Math.abs(hunter.y - target.y)), 1);
assert.equal(combat.isSurpriseAttack(huntContext, target, hunter), true, 'rounding a pillar permits an adjacent ambush despite restored sight');
arena[3][3] = 0;
huntAI.enemyTurn(hunter);
assert.equal(hunter.awareOfPlayer, true, 'a further turn in sight removes the ambush window');
target.effects = [{ id: 'invisible' }];
assert.equal(huntAI.enemyCanSeePlayer(hunter), false);

// Real eight-way pathfinding: room corners, obstacles, doors and trap avoidance.
const features = new Map();
const realDungeon = load('src/games/rogue0/dungeon.ts', {
  PF, bresenhamLine: sight.bresenhamLine, hasEffect,
  tiles: {
    getFeature() {}, getDoorState() {}, getTileState() {},
    forEachFeature(fn) { for (const [key, state] of features) fn(...key.split(',').map(Number), state); }
  }
}).default;
// Concurrent walk animations must reserve their destination immediately.
const walkTweens = [];
const walkContext = {
  entities: [], visibleTiles: new Set(['1,1', '3,1']),
  map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 },
  scene: {
    add: { sprite: (x, y) => ({ x, y, setOrigin(x, y = x) { this.originY = y; }, setDepth(depth) { this.depth = depth; } }) },
    tweens: { add(tween) { walkTweens.push(tween); } }
  }
};
const walkerA = actor('enemy');
const walkerB = actor('enemy');
walkerA.init(walkContext, 1, 1);
assert.equal(walkerA.sprite.originY, 0, 'actors are grounded rather than lifted above corridor center');
walkerB.init(walkContext, 3, 1);
const floorLoot = actor('item');
floorLoot.init(walkContext, 2, 1);
walkContext.entities = [walkerA, walkerB, floorLoot];
assert.ok(walkerA.sprite.depth > floorLoot.sprite.depth, 'monsters render above later-created loot');
assert.ok(walkerA.sprite.depth < 100, 'monsters stay beneath fog');
walkTweens.length = 0;
realDungeon.moveEntityTo(walkContext, walkerA, 2, 1);
assert.equal(walkerA.x, 2, 'destination is reserved before the tween completes');
assert.equal(walkerA.moving, true);
realDungeon.moveEntityTo(walkContext, walkerB, 2, 1);
assert.equal(walkerB.x, 3, 'another monster cannot enter a reserved tile');
assert.equal(walkTweens.length, 1, 'blocked movement does not animate');
walkTweens[0].onComplete();
realDungeon.moveEntityTo(walkContext, walkerB, 2, 1);
assert.equal(walkerB.x, 3, 'occupied tile remains blocked after animation');
assert.equal(floorLoot.x, 2, 'floor loot can share the monster tile');
// Offscreen movement obeys the same occupancy rule without a tween.
walkContext.visibleTiles.clear();
realDungeon.moveEntityTo(walkContext, walkerB, 2, 1);
assert.equal(walkerB.x, 3);

// Projectiles stop at the nearest living actor, regardless of list order.
const shooter = Object.assign(actor('player'), { x: 0, y: 0 });
const rear = Object.assign(actor('enemy'), { x: 4, y: 0 });
const front = Object.assign(actor('enemy'), { x: 2, y: 0 });
const loot = Object.assign(actor('item'), { x: 1, y: 0 });
const shotContext = { entities: [rear, loot, shooter, front], player: shooter };
assert.equal(realDungeon.firstActorInPath(shotContext, shooter, 4, 0), front);
assert.equal(realDungeon.firstActorInPath(shotContext, rear, 0, 0), front);
front.healthPoints = 0;
assert.equal(realDungeon.firstActorInPath(shotContext, shooter, 4, 0), rear);
front.healthPoints = 10;
front.y = 1;
assert.equal(realDungeon.firstActorInPath(shotContext, shooter, 4, 0), rear);
front.y = 2; rear.y = 4;
assert.equal(realDungeon.firstActorInPath(shotContext, shooter, 4, 4), front);
front.y = rear.y = 0;
let shotTween;
let hitVictim;
const projectile = { setOrigin() { return this; }, setDepth() { return this; }, destroy() {} };
shotContext.scene = { add: { sprite: () => projectile }, tweens: { add(t) { shotTween = t; } } };
shotContext.map = { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 };
shooter.currentWeapon = () => undefined;
const originalResolve = realDungeon.resolveAndApplyAttack;
realDungeon.resolveAndApplyAttack = (ctx, attacker, victim) => { hitVictim = victim; };
realDungeon.attackEntity(shotContext, shooter, rear, 1);
assert.equal(shotTween.x, 32, 'animation stops at the blocking monster');
shotTween.onComplete();
assert.equal(hitVictim, front, 'damage targets the blocking monster');
realDungeon.resolveAndApplyAttack = originalResolve;

let rangedShots = 0;
const rangedAI = load('src/games/rogue0/ai.ts', {
  canSee: () => true, hasEffect, fleeStep: () => false,
  dungeon: { getCurrentLevel: () => arena,
    firstActorInPath: realDungeon.firstActorInPath.bind(realDungeon),
    attackEntity() { rangedShots++; } }
});
Object.assign(rear, { context: shotContext, range: () => 8, effects: [{ id: 'rooted' }] });
rangedAI.enemyTurn(rear);
assert.equal(rangedShots, 0, 'monsters do not shoot through allies');
front.y = 1;
rangedAI.enemyTurn(rear);
assert.equal(rangedShots, 1, 'monsters shoot when the path clears');

realDungeon.pathGrid = new PF.Grid(Array.from({ length: 7 }, () => Array(9).fill(0)));
realDungeon.diagonalFinder = new PF.AStarFinder({ diagonalMovement: PF.DiagonalMovement.OnlyWhenNoObstacles });
let path = realDungeon.findPath(1, 1, 7, 5);
assert.equal(path.length, 7, 'rectangle crossing uses six steps, not ten cardinal steps');
assert.equal(path.slice(1).filter((p, i) => p[0] !== path[i][0] && p[1] !== path[i][1]).length, 4);
assert.deepEqual(realDungeon.findPath(1, 1, 3, 3), [[1, 1], [2, 2], [3, 3]]);
assert.deepEqual(realDungeon.findPath(1, 1, -1, 3), [], 'off-map taps are safe');
realDungeon.pathGrid.setWalkableAt(2, 1, false);
assert.equal(realDungeon.canStepBetween(1, 1, 2, 2), true, 'diagonal can round a single wall corner');
assert.deepEqual(realDungeon.findPath(1, 1, 2, 2), [[1, 1], [2, 2]]);
features.set('1,2', { feature: 'trap', trap: 'visible' });
assert.deepEqual(realDungeon.findPath(1, 1, 2, 2, true, true), [[1, 1], [2, 2]], 'wall plus trap beside the hero allows one safe diagonal step');
features.clear();
realDungeon.pathGrid.setWalkableAt(1, 2, false);
assert.equal(realDungeon.canStepBetween(1, 1, 2, 2), false, 'two solid corners still block diagonal squeezing');
assert.notDeepEqual(realDungeon.findPath(1, 1, 3, 3)[1], [2, 2]);
realDungeon.pathGrid.setWalkableAt(1, 2, true);
realDungeon.pathGrid.setWalkableAt(2, 1, true);
features.set('2,2', { feature: 'trap', trap: 'visible' });
assert.ok(!realDungeon.findPath(1, 1, 3, 3, true, true).some(([x, y]) => x === 2 && y === 2));
assert.deepEqual(realDungeon.findPath(1, 1, 2, 2, true, true), [[1, 1], [2, 2]], 'explicit trap target remains reachable');
features.clear();
features.set('2,2', { feature: 'door', door: 'closed' });
realDungeon.pathGrid.setWalkableAt(2, 2, false);
assert.deepEqual(realDungeon.findPath(1, 1, 2, 2, true), [[1, 1], [2, 2]], 'diagonal entry can open a door');
features.clear();
realDungeon.pathGrid.setWalkableAt(2, 2, true);
const diagonalAI = load('src/games/rogue0/ai.ts', { dungeon: realDungeon });
assert.deepEqual(diagonalAI.nextStepToward({ x: 1, y: 1 }, 3, 3), { x: 2, y: 2 });

// All four keyboard diagonals move and bump-attack, without extra time cost.
hero.effects = [];
hero.x = 3; hero.y = 3;
for (const [key, dx, dy] of [['Home', -1, -1], ['PageUp', 1, -1], ['End', -1, 1], ['PageDown', 1, 1]]) {
  hero.actionReady = true;
  dungeon.isWalkableTile = () => true;
  dungeon.moveEntityTo = (ctx, e, x, y) => assert.deepEqual([x, y], [3 + dx, 3 + dy]);
  hero.processInput(key);
  assert.equal(hero.canAct(), false);
  hero.actionReady = true;
  dungeon.isWalkableTile = () => false;
  dungeon.entityAtTile = () => item;
  item.type = 'enemy';
  let hit = false;
  dungeon.attackEntity = () => { hit = true; };
  hero.processInput(key);
  assert.equal(hit, true, `${key} attacks diagonally`);
}
// Click/touch targets run the real hero route planning and auto-walk attack.
dungeon.findPath = realDungeon.findPath.bind(realDungeon);
delete hero.nextStepToward;
hero.x = 1; hero.y = 1;
hero.actionReady = true;
dungeon.entityAtTile = () => undefined;
dungeon.isWalkableTile = () => true;
dungeon.moveEntityTo = (ctx, e, x, y) => { e.x = x; e.y = y; };
hero.context.map = { worldToTileX: x => x, worldToTileY: y => y };
hero.processTouchInput(hero.context, { worldX: 3, worldY: 3 });
assert.deepEqual(hero.walkPath, [{ x: 2, y: 2 }, { x: 3, y: 3 }]);
hero.stepAutoWalk();
assert.deepEqual([hero.x, hero.y], [2, 2]);
hero.actionReady = true;
dungeon.entityAtTile = () => item;
let touchAttack = false;
dungeon.attackEntity = () => { touchAttack = true; };
hero.stepAutoWalk();
assert.equal(touchAttack, true, 'auto-walk attacks a diagonally adjacent enemy');
assert.deepEqual([hero.x, hero.y], [2, 2], 'attack does not overlap the enemy');

monster.effects = [];
monster.x = 1; monster.y = 1;
enemyTurn(monster);
assert.equal(attacks, 2, 'monster melee hits a diagonally adjacent player');

// Unknown backpack curses must not leak through action availability, while
// equipped curses block every player-facing removal path without spending time.
const { InventoryWindow } = load('src/games/rogue0/inventoryWindow.ts', {
  Gem: class {}, Wand: class {}
});
const inventory = Object.create(InventoryWindow.prototype);
const curseHero = new Entity();
Object.setPrototypeOf(curseHero, Hero.prototype);
Object.assign(curseHero, {
  context: { messages: [], entities: [], simulationTime: 0 },
  type: 'player', healthPoints: 10, actionReady: true, backpack: [],
  capacity: 20, refreshUI() {}, x: 1, y: 1
});
const cursedGear = Object.assign(new Entity(), {
  type: 'item', name: 'Secret Blade', equipSlot: 'weapon',
  identified: false, cursed: true, level: 3, equip() {}
});
const replacement = Object.assign(new Entity(), { type: 'item', equipSlot: 'weapon' });
curseHero.backpack = [cursedGear, replacement];
assert.equal(cursedGear.displayName, 'Secret Blade +3 (Tier 1)');
assert.doesNotMatch(cursedGear.displayName, /cursed/i, 'unknown gear hides its curse, not its physical identity');
const unknownActions = inventory.buildActions(curseHero, cursedGear);
cursedGear.cursed = false;
assert.deepEqual(inventory.buildActions(curseHero, cursedGear), unknownActions,
  'backpack action availability must not reveal an unknown curse');
cursedGear.cursed = true;
curseHero.beginThrow(cursedGear);
assert.equal(curseHero.context.throwItem, cursedGear, 'unequipped cursed gear can be thrown');
curseHero.cancelThrow();
assert.equal(curseHero.nextActionTime, 0, 'throw targeting and cancellation are free');
curseHero.equipItem(cursedGear);
assert.equal(cursedGear.identified, true, 'equipping a weapon reveals its curse status');
assert.equal(curseHero.weapon, cursedGear);
for (const reject of [
  () => curseHero.unequipItem(cursedGear),
  () => curseHero.equipItem(replacement),
  () => curseHero.dropItem(cursedGear),
  () => curseHero.beginThrow(cursedGear),
  () => curseHero.useOrEquipBackpackSlot(0)
]) {
  reject();
  assert.equal(curseHero.weapon, cursedGear, 'equipped curse cannot be bypassed');
  assert.deepEqual(curseHero.backpack, [replacement]);
  assert.equal(curseHero.context.throwItem, undefined);
  assert.equal(curseHero.nextActionTime, 0, 'rejected curse actions are free');
}
for (const action of inventory.buildActions(curseHero, cursedGear)) {
  if (['throw', 'drop', 'unequip'].includes(action.action)) assert.equal(action.enabled, false);
}
curseHero.removeCurse();
assert.equal(cursedGear.cursed, false);
curseHero.unequipItem(cursedGear);
assert.equal(curseHero.weapon, undefined);
assert.ok(curseHero.backpack.includes(cursedGear));
assert.equal(cursedGear.level, 3, 'uncursing and unequipping preserve upgrades');
assert.equal(curseHero.nextActionTime, 1);

// Both safe and cursed weapons/armor reveal their status on actual equip.
for (const equipSlot of ['weapon', 'armor']) {
  for (const cursed of [false, true]) {
    const tester = Object.assign(new Entity(), {
      context: { messages: [], entities: [], simulationTime: 0 },
      type: 'player', healthPoints: 10, actionReady: true,
      capacity: 20, refreshUI() {}
    });
    Object.setPrototypeOf(tester, Hero.prototype);
    const gear = Object.assign(new Entity(), {
      type: 'item', name: 'Test Gear', equipSlot, identified: false, cursed, equip() {}
    });
    tester.backpack = [gear];
    tester.equipItem(gear);
    assert.equal(gear.identified, true);
    assert.equal(tester[equipSlot], gear);
    tester.unequipItem(gear);
    assert.equal(tester[equipSlot], cursed ? gear : undefined,
      'only cursed equipment is locked after revealing its status');
  }
}

// Capacity blocks unequipping, but swapping uses the incoming item's slot.
const fullHero = Object.assign(new Entity(), {
  context: { messages: [], entities: [], simulationTime: 0 },
  type: 'player', healthPoints: 10, actionReady: true, capacity: 1,
  refreshUI() {}, sprite: {}, x: 1, y: 1
});
Object.setPrototypeOf(fullHero, Hero.prototype);
let equips = 0, unequips = 0, equipmentTurns = 0;
const oldGear = Object.assign(new Entity(), {
  type: 'item', equipSlot: 'weapon', identified: false, level: 2,
  unequip() { unequips++; }
});
const newGear = Object.assign(new Entity(), {
  type: 'item', equipSlot: 'weapon', identified: false, level: 4,
  equip() { equips++; }
});
fullHero.weapon = oldGear;
fullHero.backpack = [newGear];
fullHero.spendTurn = action => { assert.equal(action, 'equip'); equipmentTurns++; };
fullHero.unequipItem(oldGear);
assert.equal(fullHero.weapon, oldGear);
assert.deepEqual(fullHero.backpack, [newGear]);
assert.equal(unequips, 0);
assert.equal(equipmentTurns, 0, 'full-backpack rejection costs no time');
fullHero.equipItem(newGear);
assert.equal(fullHero.weapon, newGear);
assert.deepEqual(fullHero.backpack, [oldGear]);
assert.equal(equips, 1);
assert.equal(unequips, 1);
assert.equal(equipmentTurns, 1);
assert.equal(oldGear.level, 2);
assert.equal(newGear.level, 4);
assert.equal(oldGear.identified, false);
assert.equal(newGear.identified, true, 'swapping in equipment reveals its curse status');

// Recheck ownership/curse at confirmation, not only when targeting opens.
for (const invalidate of ['removed', 'equipped-curse']) {
  fullHero.backpack = [oldGear];
  fullHero.weapon = newGear;
  oldGear.cursed = false;
  fullHero.beginThrow(oldGear);
  assert.equal(fullHero.context.throwItem, oldGear);
  fullHero.backpack = [];
  if (invalidate === 'equipped-curse') {
    fullHero.weapon = oldGear;
    oldGear.cursed = true;
  }
  fullHero.throwAt(2, 1);
  assert.equal(fullHero.context.throwItem, undefined);
  assert.equal(fullHero.context.throwMode, false);
  assert.equal(equipmentTurns, 1, 'invalidated throws cost no time');
  assert.equal(oldGear.x, undefined);
  if (invalidate === 'equipped-curse') assert.equal(fullHero.weapon, oldGear);
}

// A fall interrupts the old floor's scheduler before any later actor/effect
// can run. The scene, not an effect callback, performs the floor transition.
const fallingPlayer = actor('player');
const oldFloorEnemy = actor('enemy');
oldFloorEnemy.context = fallingPlayer.context;
fallingPlayer.tickEffects = () => { fallingPlayer.context.pendingFall = true; };
oldFloorEnemy.tickEffects = () => { assert.fail('old-floor effects ran after fall'); };
manager.reset([fallingPlayer, oldFloorEnemy]);
fallingPlayer.nextActionTime = oldFloorEnemy.nextActionTime = 2;
manager.update([fallingPlayer, oldFloorEnemy]);
assert.equal(manager.time, 1);
assert.equal(oldFloorEnemy.turns, 0);
manager.update([fallingPlayer, oldFloorEnemy]);
assert.equal(manager.time, 1, 'pending transition freezes the old-floor timeline');

// Jump targeting is explicit, cancellable and never offers a shove action.
{
  let jumps = 0;
  const actions = [];
  const jumpDungeon = {
    log() {}, entityAtTile: () => undefined,
    getCurrentLevel: () => Array.from({ length: 5 }, () => Array(5).fill(0)),
    jumpIntoChasm(_ctx, _hero, x, y) { jumps++; return x === 3 && y === 2; }
  };
  const JumpHero = load('src/games/rogue0/classes/basicHero.ts', {
    Entity, dungeon: jumpDungeon, isModalOpen: () => false,
    isGrassConcealed: () => false, hasEffect
  }).default;
  const jumper = Object.assign(Object.create(JumpHero.prototype), {
    x: 2, y: 2, actionReady: true, moving: false, effects: [],
    walkPath: [{ x: 3, y: 2 }], inputBuffer: ['ArrowRight'],
    context: { entities: [], messages: [], inspectMode: false, throwMode: false,
      map: { worldToTileX: x => x, worldToTileY: y => y } },
    spendTurn(action) { actions.push(action); }
  });
  jumper.processInput('v');
  assert.equal(jumper.context.terrainActionMode, true);
  assert.deepEqual(jumper.walkPath, []);
  assert.deepEqual(jumper.inputBuffer, []);
  jumper.processInput('Enter');
  assert.equal(jumps, 1);
  assert.deepEqual(actions, [], 'invalid destination is free');
  jumper.processInput('Escape');
  assert.equal(jumper.context.terrainActionMode, false);
  assert.deepEqual(actions, [], 'cancellation is free');
  jumper.beginJump();
  jumper.processInput('ArrowRight');
  jumper.processInput('Enter');
  assert.deepEqual(actions, ['move'], 'jump charges movement time once');
  assert.equal(jumper.context.terrainActionMode, false);
  jumper.beginJump();
  jumper.actionReady = false;
  jumper.jumpAt(3, 2);
  assert.equal(actions.length, 1, 'cannot jump outside your action');
  jumper.actionReady = true;
  jumper.processTouchInput(jumper.context, { worldX: 3, worldY: 2 });
  assert.deepEqual(actions, ['move', 'move'], 'tap uses the same jump action');
  assert.equal(jumpDungeon.shove, undefined);
}

console.log('Rogue0 timeline, input, jump targeting, death, sight, pursuit, diagonal movement, surprise and curse regression tests passed');
