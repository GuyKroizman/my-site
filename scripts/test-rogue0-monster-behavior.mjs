import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('monster-behavior');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

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
const map = Array.from({ length: 20 }, () => Array(20).fill(0));
const doors = new Map();
const tiles = { getDoorState: (x, y) => doors.get(`${x},${y}`), getTileState: () => undefined };
const sight = load('src/games/rogue0/fov.ts', { ...tiles, isGrassConcealed: () => false });
let attacks = 0;
const dungeon = {
  getCurrentLevel: () => map,
  log() {},
  canStepBetween: (x, y, nx, ny) => map[ny]?.[nx] === 0 &&
    (x === nx || y === ny || (map[y]?.[nx] === 0 && map[ny]?.[x] === 0)),
  isWalkableTile: (context, x, y) => map[y]?.[x] === 0 && !context.entities.some(e =>
    e.healthPoints > 0 && e.x === x && e.y === y && e.type !== 'item'),
  moveEntityTo(_context, e, x, y) { e.x = x; e.y = y; },
  findPath: (x, y, tx, ty) => x === tx && y === ty ? [[x, y]] : [[x, y], [x + Math.sign(tx - x), y + Math.sign(ty - y)]],
  attackEntity() { attacks++; },
};
const ai = load('src/games/rogue0/ai.ts', { dungeon, tiles, ...sight, hasEffect, fleeStep: () => false });
const manager = load('src/games/rogue0/turnManager.ts', { dungeon, hasEffect, removeEffect }).default;
function sprite(x = 32, y = 32) {
  return { x, y, visible: true, displayWidth: 16, depth: 2,
    setScale(scale) { this.scale = scale; return this; } };
}
// Replace only actual display creation; retain real Entity timing/damage methods.
Entity.prototype.init = function(context, x, y) {
  Object.assign(this, { context, x, y, sprite: sprite(x * 16, y * 16) });
};
let roll = 4;
const Monster = load('src/games/rogue0/monsters/monster.ts', {
  Entity, ...ai, dungeon, Gold: class {}, Phaser: { Math: { Between(min, max) {
    assert.equal(min, 4); assert.equal(max, 12); return roll;
  } } },
}).default;
const config = { name: 'Sleeper', description: '', tile: 0, healthPoints: 10,
  movementSpeed: 1, attackDelay: 1, visionRadius: 7, attackDamage: 1, protection: 0, range: 0 };
function setup() {
  const context = { entities: [], simulationTime: 0, messages: [], visibleTiles: new Set(),
    map: { worldToTileX: x => Math.floor(x / 16), worldToTileY: y => Math.floor(y / 16) } };
  const player = new Entity();
  Object.assign(player, { context, type: 'player', x: 19, y: 19, healthPoints: 10,
    refresh() {}, tickEffects() {}, turn() {} });
  context.player = player;
  const monster = new Monster(context, config, 2, 2);
  monster.tickEffects = () => {};
  context.entities = [player, monster];
  manager.reset(context.entities);
  return { context, player, monster };
}
// Alarm-style noise wakes sleepers but only supplies a fixed investigation target.
{
  const { player, monster } = setup();
  player.effects = [{ id: 'invisible' }];
  monster.hearNoise(4, 2);
  assert.equal(monster.sleeping, false);
  assert.equal(monster.awareOfPlayer, false);
  assert.deepEqual([monster.lastSeenX, monster.lastSeenY], [4, 2]);
  monster.turn();
  assert.deepEqual([monster.x, monster.y], [3, 2], 'investigates noise without seeing the player');
  assert.deepEqual([monster.lastSeenX, monster.lastSeenY], [4, 2], 'does not track invisible player');
}
let { context, player, monster } = setup();
assert.equal(monster.sleeping, true);
roll = 12;
assert.equal(new Monster(context, config, 3, 2).sleepTurnsRemaining, 12, 'construction uses variable sleep roll');
roll = 4;
for (let i = 0; i < 200; i++) manager.update(context.entities);
assert.equal(monster.sleepTurnsRemaining, 4, 'idle rendering never advances sleep');
player.spendTime('wait'); manager.update(context.entities);
assert.equal(monster.sleepTurnsRemaining, 3);
assert.deepEqual([monster.x, monster.y], [2, 2], 'sleeping actors spend actions without moving');
for (const speed of [0.5, 2]) {
  ({ context, player, monster } = setup());
  monster.movementSpeed = speed;
  player.spendTime('wait'); manager.update(context.entities);
  assert.equal(monster.sleepTurnsRemaining, 3, 'sleep counts world ticks, not speed-dependent actions');
}
// Revisits retain entity state, with no timestamp rebasing or reroll.
monster.sleepTurnsRemaining = 2;
context.simulationTime += 100;
monster.init(context, 3, 3);
manager.reset(context.entities, true);
assert.equal(monster.sleepTurnsRemaining, 2);
monster.wakeUp(); monster.init(context, 3, 3);
assert.equal(monster.sleeping, false, 'awake revisited monsters never go back to sleep');

// Real scheduler travel: only the active floor is in the actor list. Time and
// effect deadlines advance elsewhere, but the saved sleeper remains frozen.
({ context, player, monster } = setup());
player.spendTime('wait'); manager.update(context.entities);
const savedSleep = monster.sleepTurnsRemaining;
const savedTime = context.simulationTime;
context.entities = [player];
manager.reset(context.entities, true);
for (let i = 0; i < 25; i++) { player.spendTime('wait'); manager.update(context.entities); }
assert.ok(context.simulationTime >= savedTime + 25);
assert.equal(monster.sleepTurnsRemaining, savedSleep, 'off-floor world ticks never age a saved sleeper');
monster.init(context, monster.x, monster.y);
context.entities.push(monster);
manager.reset(context.entities, true);
manager.update(context.entities);
assert.equal(monster.sleepTurnsRemaining, savedSleep, 'restore does not catch up off-floor sleep');
player.spendTime('wait'); manager.update(context.entities);
assert.equal(monster.sleepTurnsRemaining, savedSleep - 1, 'sleep resumes only on a new active-floor tick');

({ context, player, monster } = setup());
monster.takeDamage(0);
assert.equal(monster.sleeping, true, 'zero passive damage does not wake a sleeper');
monster.takeDamage(1);
assert.equal(monster.healthPoints, 9);
assert.equal(monster.sleeping, false, 'positive damage wakes immediately');
({ context, player, monster } = setup());
monster.awareOfPlayer = true;
assert.equal(monster.sleeping, false, 'combat awareness wakes even after a miss');
monster.turn();
assert.equal(monster.sleepTurnsRemaining, 0);
assert.equal(monster.sleeping, false, 'losing sight after combat does not restore old sleep');

({ context, player, monster } = setup());
Object.assign(player, { x: 4, y: 2 });
map[2][3] = 1;
monster.turn();
assert.equal(monster.sleeping, true, 'walls block proximity wake');
map[2][3] = 0;
doors.set('3,2', 'closed');
monster.turn();
assert.equal(monster.sleeping, true, 'closed doors block proximity wake');
doors.clear();
player.effects = [{ id: 'invisible' }];
monster.turn();
assert.equal(monster.sleeping, true, 'invisible hero does not trigger visual proximity wake');
player.effects = [];
monster.turn();
assert.equal(monster.sleeping, false, 'nearby visible hero wakes sleeper');
assert.equal(monster.x, 3, 'waking creature can react normally');
monster.turn();
assert.equal(attacks, 1, 'awake adjacent creature attacks');

// Deterministic RNG: sleepers expire, then wander without seeing the hero.
const savedRandom = Math.random;
try {
  Math.random = () => 0;
  ({ context, player, monster } = setup());
  for (let i = 0; i < 4; i++) { player.spendTime('wait'); manager.update(context.entities); }
  assert.equal(monster.sleeping, false, 'sleep expires in world time');
  player.spendTime('wait'); manager.update(context.entities);
  assert.notDeepEqual([monster.x, monster.y], [2, 2], 'awake monster roams offscreen');
  const before = [monster.x, monster.y];
  player.spendTime('wait'); manager.update(context.entities);
  assert.notDeepEqual([monster.x, monster.y], before, 'patrol heading persists on subsequent turns');
  monster.effects = [{ id: 'rooted' }];
  const rooted = [monster.x, monster.y];
  monster.turn();
  assert.deepEqual([monster.x, monster.y], rooted, 'rooted roamers wait instead of moving');
  monster.effects = [];
  // Occupied/walled surroundings cannot be entered by roaming.
  const origin = [monster.x, monster.y];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx || dy) map[monster.y + dy][monster.x + dx] = 1;
  }
  const nextTime = monster.nextActionTime;
  monster.turn();
  assert.deepEqual([monster.x, monster.y], origin);
  assert.ok(monster.nextActionTime > nextTime, 'blocked roamer still spends time');
} finally {
  Math.random = savedRandom;
  for (const row of map) row.fill(0);
}

// Special abilities cannot bypass sleep; combat-created reinforcements are awake.
let buffs = 0;
const bindings = { Monster, dungeon, Gem: class {}, HolyPotion: class {}, BerserkPotion: class {},
  hasEffect, applyEffect() { buffs++; }, createStrengthenedEffect() {}, createRegenerationEffect() {} };
const Skeleton = load('src/games/rogue0/monsters/skelaton.ts', bindings).default;
const Cultist = load('src/games/rogue0/monsters/cultist.ts', { ...bindings, Skeleton }).default;
const Ghoul = load('src/games/rogue0/monsters/ghoul.ts', bindings).default;
const Brute = load('src/games/rogue0/monsters/brute.ts', bindings).default;
({ context, player } = setup());
for (const Kind of [Cultist, Ghoul, Brute]) {
  const special = new Kind(context, 5, 5);
  special.healthPoints = 1;
  const count = context.entities.length;
  special.turn();
  assert.equal(context.entities.length, count, 'sleeping cultist cannot summon');
  assert.equal(buffs, 0, 'sleeping ghoul/brute cannot use active abilities');
}
const cultist = new Cultist(context, 5, 5);
cultist.wakeUp(); cultist.turn();
assert.ok(context.entities.at(-1) instanceof Skeleton);
assert.equal(context.entities.at(-1).sleeping, false);

const flyTexture = load('src/games/rogue0/monsters/flySwarmTexture.ts');
let generated = 0;
const draws = [];
const textures = new Set();
const graphics = { fillStyle() {}, fillRect(...args) { draws.push(args); }, destroy() {},
  generateTexture(key, width, height) { generated++; textures.add(key); assert.deepEqual([width, height], [16, 16]); } };
const flyScene = { textures: { exists: key => textures.has(key) }, make: { graphics: () => graphics } };
flyTexture.generateFlySwarmTexture(flyScene);
flyTexture.generateFlySwarmTexture(flyScene);
assert.equal(generated, 1, 'fly texture generation is idempotent');
assert.ok(draws.length > 30 && draws.length < 180, 'multiple flies with substantial transparent gaps');
assert.ok(draws.every(([x, y]) => x >= 0 && x < 16 && y >= 0 && y < 16));
const Flies = load('src/games/rogue0/monsters/swarmOfFlies.ts', { Monster, dungeon, ...flyTexture }).default;
const swarm = new Flies(context, 5, 5);
const offspring = new Flies(context, 5, 5, true);
assert.equal(swarm.spriteTextureKey, flyTexture.FLY_SWARM_TEXTURE);
assert.equal(swarm.spriteFrame, 0);
assert.equal(swarm.sleeping, true);
assert.equal(offspring.sleeping, false);
offspring.init(context, 6, 6);
assert.equal(offspring.sprite.scale, 0.7, 'small swarm scale survives floor recreation');

// Cosmetic Zs rise/fade, but never reveal hidden monsters or advance sleep.
const { updateMonsterSleepVisuals, clearMonsterSleepVisuals } = load('src/games/rogue0/monsters/monsterSleepVisuals.ts');
const texts = [];
const visualScene = { add: { text(x, y, value) {
  const text = { x, y, value, visible: true, destroyed: false,
    setOrigin() { return this; }, setPosition(x, y) { Object.assign(this, { x, y }); return this; },
    setAlpha(alpha) { this.alpha = alpha; return this; }, setDepth(depth) { this.depth = depth; return this; },
    setVisible(visible) { this.visible = visible; return this; }, destroy() { this.destroyed = true; } };
  texts.push(text); return text;
} } };
({ context, player, monster } = setup());
context.visibleTiles = new Set(['2,2', '2,1']);
updateMonsterSleepVisuals(visualScene, context.entities, 0);
assert.equal(texts.length, 3);
assert.ok(texts.every(text => text.value === 'z' && text.depth < 100));
const first = texts[0], y = first.y, alpha = first.alpha;
updateMonsterSleepVisuals(visualScene, context.entities, 100);
assert.ok(first.y < y && first.alpha < alpha, 'Z rises and fades');
assert.equal(monster.sleepTurnsRemaining, 4, 'cosmetic clock does not affect sleep');
context.visibleTiles.delete('2,1');
updateMonsterSleepVisuals(visualScene, context.entities, 200);
assert.ok(texts.every(text => !text.visible), 'letters cannot spill into hidden tiles');
monster.sprite.visible = false;
updateMonsterSleepVisuals(visualScene, context.entities, 300);
assert.ok(texts.every(text => text.destroyed), 'hidden/occluded monsters lose all letters');
monster.sprite.visible = true;
context.visibleTiles.clear();
updateMonsterSleepVisuals(visualScene, context.entities, 400);
assert.equal(texts.length, 3, 'mind vision does not reveal sleep particles');
context.visibleTiles = new Set(['2,2', '2,1']);
updateMonsterSleepVisuals(visualScene, context.entities, 500);
monster.wakeUp();
updateMonsterSleepVisuals(visualScene, context.entities, 600);
assert.ok(texts.every(text => text.destroyed), 'wake clears letters');
monster.sleepTurnsRemaining = 4;
updateMonsterSleepVisuals(visualScene, context.entities, 700);
clearMonsterSleepVisuals(visualScene);
assert.ok(texts.every(text => text.destroyed), 'floor transition/shutdown destroys letters');
updateMonsterSleepVisuals(visualScene, context.entities, 800);
monster.healthPoints = 0;
updateMonsterSleepVisuals(visualScene, context.entities, 900);
assert.ok(texts.every(text => text.destroyed), 'death clears letters');
console.log('Rogue0 monster sleep, wake, patrols, fly texture, revisits and FOV-safe sleep visuals passed');
