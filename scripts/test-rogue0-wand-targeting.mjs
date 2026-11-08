import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('wand-targeting');
import assert from 'node:assert/strict';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';
import { createTerrain } from '../src/games/rogue0/terrain.ts';
import { blocksProjectile, hasClearProjectilePath } from '../src/games/rogue0/fov.ts';
import { UNSEEN_PAIN } from '../src/games/rogue0/combatFeedback.ts';

const load = (name, bindings) => loadLogic(`src/games/rogue0/${name}.ts`, bindings);

// ---- Projectile paths are physical, not optical ----
const corridor = Array.from({ length: 5 }, (_, y) =>
  Array.from({ length: 20 }, (_, x) => (y === 0 || y === 4 || x === 0 ? 1 : 0)));
const terrain = createTerrain();

assert.equal(hasClearProjectilePath(corridor, 1, 2, 18, 2), true,
  'a long straight corridor gives a clear shot even far beyond sight');
assert.equal(hasClearProjectilePath(corridor, 1, 2, 18, 2, terrain), true,
  'plain terrain does not block a bolt');
corridor[2][10] = 1;
assert.equal(hasClearProjectilePath(corridor, 1, 2, 18, 2), false,
  'a wall between caster and target blocks the bolt');
corridor[2][10] = 0;
assert.equal(hasClearProjectilePath(corridor, 1, 2, 18, 2, terrain), true);

terrain.setFeature(8, 2, 'door', { door: 'closed' });
assert.equal(blocksProjectile(corridor, 8, 2, terrain), true, 'closed doors are solid');
assert.equal(hasClearProjectilePath(corridor, 1, 2, 18, 2, terrain), false,
  'a closed door between caster and target blocks the bolt');
terrain.setDoorState(8, 2, 'open');
assert.equal(hasClearProjectilePath(corridor, 1, 2, 18, 2, terrain), true,
  'an open door does not block the bolt');

terrain.setFeature(8, 2, 'grass');
assert.equal(hasClearProjectilePath(corridor, 1, 2, 18, 2, terrain), true,
  'tall grass conceals but does not stop a projectile');
terrain.setFeature(8, 2, 'chasm');
assert.equal(hasClearProjectilePath(corridor, 1, 2, 18, 2, terrain), true,
  'a chasm does not stop a projectile');
terrain.setFeature(8, 2, 'secretDoor');
assert.equal(hasClearProjectilePath(corridor, 1, 2, 18, 2, terrain), false,
  'a disguised secret door is still solid');
terrain.clearAllFeatures();

// ---- Real throwAt: zaps ignore sight but stop at walls ----
const level = Array.from({ length: 8 }, () => Array(20).fill(0));
const messages = [];
const zaps = [];
const dungeon = {
  log: (_context, message) => messages.push(message),
  getCurrentLevel: () => level,
  firstActorInPath: () => undefined,
  entityAtTile: () => undefined,
  procWandCurse: () => false,
};
const { Entity } = load('entity');
const Wand = load('items/wand', { Entity, dungeon, identify: () => {} }).default;
const fov = load('fov');
let attackResult = { hit: false, damage: 0, damageType: 'fire', appliedEffects: [] };
const Hero = load('classes/basicHero', {
  Entity, Wand, Gem: class {}, dungeon, ...fov,
  // A zap must never consult optical sight.
  hasLineOfSight: () => { throw new Error('a wand zap must not require line of sight'); },
  isGrassConcealed: () => false,
  resolveAttack: () => attackResult,
  terrainFor: () => terrain,
}).default;

function fixture() {
  messages.length = 0;
  zaps.length = 0;
  for (const row of level) row.fill(0);
  const context = {
    entities: [], messages, visibleTiles: new Set(),
    onWandZap: (zap, onImpact) => { zaps.push(zap); onImpact?.(); },
  };
  const wand = Object.assign(Object.create(Wand.prototype), {
    name: 'Wand of Firebolt', type: 'item',
    identified: true, charges: 2, maxCharges: 2, level: 0, damageType: 'fire',
    damage() { this.charges -= 1; return 3; },
    wandEffects() { return []; },
  });
  wand.context = context;
  const hero = Object.assign(Object.create(Hero.prototype), {
    context, backpack: [wand], x: 1, y: 2, turns: 0, effects: [],
    canAct: () => true, spendTurn() { this.turns += 1; }, refreshUI() {},
  });
  context.entities.push(hero, wand);
  hero.zapping = true;
  context.throwMode = true;
  context.throwItem = wand;
  return { context, hero, wand };
}

// No visible tiles at all: the target lies in total darkness far down the map.
{
  const { context, hero, wand } = fixture();
  assert.equal(context.visibleTiles.size, 0);
  hero.throwAt(18, 2);
  assert.equal(wand.charges, 1, 'a beyond-sight zap spends one charge');
  assert.equal(hero.turns, 1, 'a beyond-sight zap spends one turn');
  assert.equal(zaps.length, 1, 'the beyond-sight bolt reaches its destination');
  assert.deepEqual([zaps[0].fromX, zaps[0].toX], [1, 18]);
  assert.equal(context.throwMode, false, 'firing ends targeting');
}

// A solid wall between the hero and the destination stops the bolt.
{
  const { context, hero, wand } = fixture();
  level[2][9] = 1;
  hero.throwAt(18, 2);
  assert.equal(wand.charges, 2, 'a wall-blocked zap spends no charge');
  assert.equal(hero.turns, 0, 'a wall-blocked zap spends no turn');
  assert.equal(zaps.length, 0);
  assert.equal(context.throwMode, false);
  assert.match(messages.at(-1), /can't zap there/);
}

// A closed door is a physical blocker even though it is not dark.
{
  terrain.setFeature(9, 2, 'door', { door: 'closed' });
  const { hero, wand } = fixture();
  hero.throwAt(18, 2);
  assert.equal(wand.charges, 2, 'a closed door stops the bolt');
  terrain.clearAllFeatures();
}

// A hit on an unseen monster reaches the target, but the log only reports a
// distant cry of pain instead of the monster's name or the damage number.
{
  const { context, hero, wand } = fixture();
  const skeleton = Object.assign(Object.create(Entity.prototype), {
    type: 'enemy', name: 'Skeleton', x: 18, y: 2, healthPoints: 10,
    effects: [], resistance: {}, vulnerability: {},
    takeDamage(amount) { this.healthPoints -= amount; },
  });
  context.entities.push(skeleton);
  const firstActorInPath = dungeon.firstActorInPath;
  dungeon.firstActorInPath = () => skeleton;
  attackResult = { hit: true, damage: 4, damageType: 'fire', appliedEffects: [] };
  try {
    hero.throwAt(18, 2);
    assert.equal(skeleton.healthPoints, 6, 'the unseen bolt still deals damage');
    assert.deepEqual(messages, [UNSEEN_PAIN], 'the unseen hit only reports a cry');
    assert.equal(messages.some(message => message.includes('Skeleton')), false,
      'the hidden monster name never appears in the log');
    assert.equal(messages.some(message => message.includes('4')), false,
      'the exact damage number does not leak');
  } finally {
    dungeon.firstActorInPath = firstActorInPath;
    attackResult = { hit: false, damage: 0, damageType: 'fire', appliedEffects: [] };
  }
}

console.log('Rogue0 wand targeting: zaps fire beyond sight along a wall-free path, but walls, closed doors and secret doors still stop the bolt');
