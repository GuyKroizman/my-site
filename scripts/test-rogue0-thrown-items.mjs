import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('thrown-items');
import assert from 'node:assert/strict';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';

// Thrown weapons, armour and tools are objects in flight, not attacks: they
// must never damage a monster (mimic or otherwise) and must simply land.
const logs = [];
const traps = [];
const removed = [];
const dungeon = {
  log(_context, text) { logs.push(text); },
  triggerArrowTrap(_context, x, y) { traps.push([x, y]); }
};
const Hero = loadLogic('src/games/rogue0/classes/basicHero.ts', {
  Entity: class Entity { init() {} },
  dungeon,
  removeEntity: (_context, entity) => { removed.push(entity); },
  resolveAttack: () => assert.fail('a thrown object must never roll combat math'),
  applyAttackResult: () => assert.fail('a thrown object must never apply an attack'),
  sfx: { potion() {} },
  applyEffect: () => assert.fail('a thrown weapon must not apply status effects'),
}).default;

function sprite() {
  return { tint: 0xffffff, setOrigin() { return this; }, setDepth() { return this; },
    setScale() { return this; }, destroy() {} };
}
function setup(enemy) {
  const context = {
    entities: [], messages: [], visibleTiles: new Set(), floor: 1,
    map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 },
    scene: { add: { sprite }, tweens: { add() {}, killTweensOf() {} } }
  };
  if (enemy) context.entities.push(enemy);
  const hero = Object.assign(Object.create(Hero.prototype), {
    context, x: 1, y: 2, name: 'Hero'
  });
  return { context, hero };
}
function monster(x = 3, y = 3) {
  return {
    type: 'enemy', name: 'Mimic', x, y, healthPoints: 12,
    resistance: {}, vulnerability: {},
    attackedBy: [], damageCalls: 0,
    onAttacked(attacker) { this.attackedBy.push(attacker); },
    takeDamage(amount) { this.damageCalls += 1; this.healthPoints -= amount; }
  };
}
function thrownWeapon(overrides = {}) {
  return Object.assign({
    type: 'item', name: 'Axe', displayName: 'Axe', equipSlot: 'weapon',
    consumable: false, count: 1, damageType: 'physical',
    damage() { return 9; }
  }, overrides);
}

// A thrown weapon at a monster: no damage, no combat roll, target notices the
// impact and the weapon lands on the floor under it.
{
  logs.length = 0; traps.length = 0; removed.length = 0;
  const mimic = monster();
  const { context, hero } = setup(mimic);
  const axe = thrownWeapon();
  hero.resolveThrowLanding(axe, 3, 3);
  assert.equal(mimic.healthPoints, 12, 'a thrown weapon cannot damage a mimic');
  assert.equal(mimic.damageCalls, 0, 'takeDamage is never called by a throw');
  assert.deepEqual(mimic.attackedBy, [hero], 'the target notices the impact');
  assert.ok(context.entities.includes(axe), 'the weapon is not destroyed');
  assert.equal(axe.x, 3);
  assert.equal(axe.y, 3);
  assert.equal(removed.length, 0, 'a thrown weapon is never removed as a hit');
  assert.deepEqual(traps, [[3, 3]], 'the landing still probes an arrow plate');
  assert.deepEqual(logs,
    ['You throw Axe at Mimic \u2014 it clatters to the ground.'],
    'one clear landing message replaces combat log lines');
}

// Any other monster behaves the same way, including a stack of thrown objects.
{
  const enemy = monster();
  enemy.name = 'Goblin';
  const { context, hero } = setup(enemy);
  hero.resolveThrowLanding(thrownWeapon({ name: 'Dagger', displayName: 'Dagger' }), 3, 3);
  assert.equal(enemy.healthPoints, 12, 'no monster takes throw damage');
  assert.equal(context.entities.filter(e => e === enemy).length, 1);
}

// An item with positive damage() but no weapon slot (the legacy scroll shape)
// also cannot sneak damage through the throw path.
{
  const enemy = monster();
  const { hero } = setup(enemy);
  hero.resolveThrowLanding(thrownWeapon({
    equipSlot: 'consumable', name: 'Scroll of Fireball', displayName: 'Scroll of Fireball'
  }), 3, 3);
  assert.equal(enemy.healthPoints, 12, 'damage() alone does not make a throw an attack');
}

// Consumables still reach the target and are used up by the impact.
{
  const enemy = monster();
  const { context, hero } = setup(enemy);
  const potion = { type: 'item', name: 'Potion of Healing', displayName: 'Potion of Healing',
    consumable: true, count: 1 };
  hero.resolveThrowLanding(potion, 3, 3);
  assert.equal(enemy.healthPoints, 12);
  assert.deepEqual(removed, [potion], 'a potion is consumed by its splash');
  assert.equal(context.entities.includes(potion), false);
  assert.equal(enemy.damageCalls, 0, 'an unknown potion does not hurt the target');
  assert.ok(logs.some(line => line === 'It splashes harmlessly.'));
}

console.log('Rogue0 thrown items: no throw damage, weapons land, consumables still splash');
