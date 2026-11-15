import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('blink-timing');
import assert from 'node:assert/strict';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';
import { TurnManager } from '../src/games/rogue0/turnManager.ts';
import { createGameContext } from '../src/games/rogue0/context.ts';
import { createTerrain } from '../src/games/rogue0/terrain.ts';
import { actionCost } from '../src/games/rogue0/timing.ts';
import { bresenhamLine, canSee, hasLineOfSight } from '../src/games/rogue0/fov.ts';
import { GLYPH_STONE_TEXTURES } from '../src/games/rogue0/glyphStoneTextures.ts';

// Exercise the real throw, stone, inventory and scheduler together. Rendering
// is a manual completion queue, not the synchronous tweens used by older
// throw fixtures: update() must not release enemies between flight and impact.
const load = (name, bindings) => loadLogic(`src/games/rogue0/${name}.ts`, bindings);
const { Entity, removeEntity } = load('entity', { actionCost });
const GlyphStone = load('items/glyphStone', { Entity }).default;
function sprite() {
  return {
    x: 0, y: 0,
    setOrigin() { return this; }, setDepth() { return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    destroy() { this.destroyed = true; },
  };
}
function fixture(count, chasm = false) {
  const context = createGameContext();
  const terrain = createTerrain();
  const flights = [];
  const enemyPositions = [];
  const moves = [];
  context.currentLevel = Array.from({ length: 5 }, () => Array(14).fill(0));
  context.floor = 1;
  context.maxFloor = 25;
  context.map = { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 };
  context.scene = {
    add: { sprite },
    tweens: { add(tween) { flights.push(tween); }, killTweensOf() {} },
  };
  const dungeon = {
    log(ctx, message) { ctx.messages.unshift(message); },
    getCurrentLevel: () => context.currentLevel,
    firstActorInPath: () => undefined, // The escape line is clear of the flies.
    triggerArrowTrap() {},
    findPath: (x, y, tx, ty) => bresenhamLine(x, y, tx, ty),
    isWalkableTile: (ctx, x, y) => context.currentLevel[y]?.[x] === 0 &&
      !ctx.entities.some(e => e.type !== 'item' && e.healthPoints > 0 && e.x === x && e.y === y),
    canStepBetween: (x, y, tx, ty) => Math.max(Math.abs(x - tx), Math.abs(y - ty)) === 1,
    moveEntityTo(_ctx, enemy, x, y) {
      moves.push([enemy, x, y]);
      enemy.x = x; enemy.y = y;
      enemy.moving = true;
      flights.push({ onComplete() { enemy.moving = false; } });
    },
    attackEntity(_ctx, _enemy, victim) { victim.healthPoints--; },
    openDoor: () => false,
    confusedMove: () => false,
  };
  const { swarmTurn } = load('ai', {
    dungeon, canSee, hasEffect: () => false, terrainFor: () => terrain,
  });
  const Hero = load('classes/basicHero', {
    Entity, dungeon, removeEntity, hasEffect: () => false, hasLineOfSight,
    terrainFor: () => terrain,
  }).default;
  const Stone = load('items/stoneOfBlink', {
    GlyphStone, dungeon, bresenhamLine, GLYPH_STONE_TEXTURES,
    terrainFor: () => terrain,
  }).default;
  const hero = Object.assign(new Entity(), {
    context, type: 'player', x: 2, y: 2, healthPoints: 1,
    sprite: sprite().setPosition(32, 32), backpack: [],
    walkPath: [], inputBuffer: [],
    // Input and upkeep are unrelated boundaries, not replacements for the
    // production canAct/spendTurn/spendTime/throwAt methods under test.
    turn() {}, refresh() {}, tickEffects() {},
  });
  Object.setPrototypeOf(hero, Hero.prototype);
  context.player = hero;
  // Use the real flies' decision-making and action costs, not a stand-in that
  // always spends a turn. Blink stays inside their sight radius so they chase
  // the hero rather than wandering; any resulting hit is deterministically lethal.
  const enemies = [1, 3].map(y => Object.assign(new Entity(), {
    context, type: 'enemy', name: 'Swarm of Flies', x: 1, y,
    healthPoints: 10, visionRadius: 6, flying: true,
    turn() {
      enemyPositions.push([hero.x, hero.y]);
      swarmTurn(this);
    },
    refresh() {}, tickEffects() {},
  }));
  const stone = Object.assign(new Entity(), {
    context, type: 'item', name: 'Stone of Blink', consumable: true,
    count, textureKey: GLYPH_STONE_TEXTURES.blink,
  });
  Object.setPrototypeOf(stone, Stone.prototype);
  hero.backpack = [stone];
  context.entities = [hero, ...enemies, stone];
  context.throwItem = stone;
  context.throwMode = true;
  if (chasm) terrain.setFeature(6, 2, 'chasm');
  const manager = new TurnManager({ hasEffect: () => false, removeEffect() {}, log() {} });
  manager.reset(context.entities);
  const update = () => manager.update(context.entities);
  return { context, hero, stone, manager, flights, enemyPositions, enemies, moves, update };
}

// Sanity-check the threat: the same enemies kill the low-health hero if the
// hero waits rather than blinking, so the escape assertions are meaningful.
{
  const f = fixture(1);
  f.hero.spendTurn('wait');
  f.update();
  assert.equal(f.hero.healthPoints, 0);
  assert.deepEqual(f.enemyPositions, [[2, 2]]);
}

for (const count of [1, 3]) {
  for (const chasm of [false, true]) {
    const f = fixture(count, chasm);
    f.hero.throwAt(6, 2);
    assert.equal(f.flights.length, 1);
    assert.equal(f.hero.canAct(), false);
    assert.equal(f.hero.moving, true);
    assert.equal(f.hero.nextActionTime, 1, 'throw spends exactly one normal action');
    assert.equal(f.context.throwMode, false);
    assert.equal(f.hero.backpack.includes(f.stone), count > 1);
    if (count > 1) assert.equal(f.stone.count, count - 1);

    const assertPaused = () => {
      for (let frame = 0; frame < 10; frame++) f.update();
      assert.deepEqual(f.enemyPositions, [], 'enemies cannot act during the throw');
      assert.equal(f.manager.time, 0, 'animation time is not simulation time');
      assert.equal(f.hero.healthPoints, 1);
      assert.deepEqual([f.hero.x, f.hero.y], [2, 2]);
    };
    assertPaused();
    f.flights.shift().onComplete();
    if (chasm) {
      assert.equal(f.flights.length, 1, 'chasm fall is the second animation');
      assertPaused();
      f.flights.shift().onComplete();
      assert.equal(f.context.pendingBlinkFall, true);
      assert.equal(f.context.pendingFall, true);
      f.update();
      assert.deepEqual(f.enemyPositions, [], 'old-floor enemies cannot act before descent');
    } else {
      // No extra scheduler/render frame is needed for the teleport itself.
      assert.deepEqual([f.hero.x, f.hero.y], [6, 2]);
      assert.deepEqual([f.hero.sprite.x, f.hero.sprite.y], [96, 32]);
      assert.equal(f.hero.moving, false);
      // Pump actual scheduler decisions and queued movement completions until
      // input is ready again. A single update misses repeated free AI moves.
      for (let frame = 0; frame < 30 && !f.hero.canAct() && f.hero.healthPoints > 0; frame++) {
        f.update();
        f.flights.shift()?.onComplete();
      }
      assert.equal(f.hero.healthPoints, 1, 'flies cannot chase across several tiles and hit during one blink action');
      assert.deepEqual(f.enemyPositions, [[6, 2], [6, 2]],
        'both flies get exactly one response, at the new position');
      assert.equal(f.moves.length, 2, 'each fly moves only one tile before the next player turn');
      assert.ok(f.enemies.every(enemy => enemy.nextActionTime === 1), 'chasing spends movement time');
      assert.equal(f.hero.canAct(), true, 'normal scheduling resumes after the landing');
    }
    assert.equal(f.hero.healthPoints, 1, 'escaping does not allow a hit at the launch tile');
    assert.equal(f.context.entities.filter(e => e instanceof GlyphStone).length, count > 1 ? 1 : 0,
      'exactly one stone is consumed');
  }
}
console.log('Rogue0 blink timing: low-health escape, queued flight/fall, enemy response ordering and stack consumption passed');
