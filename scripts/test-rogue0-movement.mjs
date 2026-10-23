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
const { Entity } = load('src/games/rogue0/entity.ts', { actionCost });
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
  Entity, dungeon, isModalOpen: () => false, hasEffect,
  getTrapState: () => undefined, sfx: { potion() {} },
  spawnEntityFloatingText() {}
}).default;
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

// A buff applied between integer time boundaries keeps its full lifetime.
const effects = load('src/games/rogue0/effects.ts', { spawnEntityFloatingText() {} });
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
const sight = load('src/games/rogue0/fov.ts', terrain);
const arena = Array.from({ length: 7 }, () => Array(7).fill(0));
const combat = load('src/games/rogue0/combat.ts', {
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
  PF, bresenhamLine: sight.bresenhamLine, tiles: { forEachFeature(fn) { for (const [key, state] of features) fn(...key.split(',').map(Number), state); } }
}).default;
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
assert.equal(realDungeon.canStepBetween(1, 1, 2, 2), false, 'no diagonal wall cutting');
assert.notDeepEqual(realDungeon.findPath(1, 1, 3, 3)[1], [2, 2]);
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

console.log('Rogue0 timeline, input, death, sight, pursuit, diagonal movement and surprise regression tests passed');
