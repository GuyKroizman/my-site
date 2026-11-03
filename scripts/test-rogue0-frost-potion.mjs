import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('frost-potion');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function load(name, bindings = {}) {
  const source = fs.readFileSync(`src/games/rogue0/${name}.ts`, 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
  const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
  const exports = {};
  new Function('exports', ...Object.keys(bindings), js)(exports, ...Object.values(bindings));
  return exports;
}

// --- Potion of Frost carries the ice damage type and advertises the matchup ---
const EntityStub = class Entity {
  init() {}
};
const PotionOfFrost = load('items/PotionOfFrost', {
  Entity: EntityStub,
  removeEntity: () => {},
  applyEffect: () => {},
  createFrozenEffect: () => ({ id: 'frozen' })
}).default;
const potion = new PotionOfFrost({});
assert.equal(potion.damageType, 'ice', 'Potion of Frost is typed as ice damage');
assert.match(potion.description, /fire elementals/, 'description reveals the fire-elemental matchup');

// --- Thrown frost potions hit fire elementals for direct ice damage ---
const logs = [];
const removed = [];
const applied = [];
const dungeon = {
  log(_context, text) { logs.push(text); }
};
const removeEntity = (_context, entity) => { removed.push(entity); };
const applyEffect = (entity, effect) => { applied.push({ entity, effect }); };
const createFrozenEffect = (duration = 1) => ({ id: 'frozen', duration });
const Hero = load('classes/basicHero', {
  Entity: EntityStub,
  dungeon,
  removeEntity,
  applyEffect,
  createFrozenEffect,
  resolveAttack: () => { throw new Error('potion splash must not roll a combat attack'); },
  Wand: class Wand {},
  hasLineOfSight: () => true,
  getFeature: () => undefined,
  getTrapState: () => undefined,
  isGrassConcealed: () => false,
}).default;

function makeHero() {
  return Object.assign(Object.create(Hero.prototype), { context: { messages: [] } });
}

function fireElemental(healthPoints = 8) {
  return {
    name: 'Fire Elemental',
    damageType: 'fire',
    healthPoints,
    resistance: { fire: 2 },
    vulnerability: { ice: 1 },
    damageCalls: 0,
    lastDamage: 0,
    takeDamage(amount) {
      this.damageCalls += 1;
      this.lastDamage = amount;
      this.healthPoints -= amount;
    }
  };
}

{
  applied.length = 0; logs.length = 0; removed.length = 0;
  const hero = makeHero();
  const enemy = fireElemental(8);
  hero.applyThrownPotion({ name: 'Potion of Frost' }, enemy);
  assert.equal(enemy.healthPoints, 3, '4 base damage + 1 ice vulnerability');
  assert.equal(enemy.lastDamage, 5);
  assert.equal(enemy.damageCalls, 1);
  assert.equal(applied.length, 1, 'survivors are still frozen');
  assert.equal(applied[0].effect.id, 'frozen');
  assert.ok(logs.some(line => line.includes('Fire Elemental for 5 ice damage')),
    'damage is reported as ice damage');
  assert.equal(removed.length, 0);
}

{
  applied.length = 0; logs.length = 0; removed.length = 0;
  const hero = makeHero();
  const enemy = fireElemental(2);
  hero.applyThrownPotion({ name: 'Potion of Frost' }, enemy);
  assert.equal(enemy.healthPoints, -3);
  assert.equal(applied.length, 0, 'a dead elemental is not frozen as an afterthought');
  assert.deepEqual(removed, [enemy], 'lethal cold splash removes the target');
}

{
  applied.length = 0; logs.length = 0; removed.length = 0;
  const hero = makeHero();
  const enemy = fireElemental(8);
  enemy.resistance.ice = 2; // 4 - 2 resistance + 1 vulnerability = 3
  hero.applyThrownPotion({ name: 'Potion of Frost' }, enemy);
  assert.equal(enemy.lastDamage, 3, 'ice resistance and vulnerability both apply');
  assert.equal(enemy.healthPoints, 5);
}

{
  applied.length = 0; logs.length = 0; removed.length = 0;
  const hero = makeHero();
  const enemy = {
    name: 'Ice Elemental',
    damageType: 'ice',
    healthPoints: 8,
    resistance: { ice: 2 },
    vulnerability: { fire: 1 },
    damageCalls: 0,
    takeDamage() { this.damageCalls += 1; }
  };
  hero.applyThrownPotion({ name: 'Potion of Frost' }, enemy);
  assert.equal(enemy.damageCalls, 0, 'non-fire targets take no direct damage');
  assert.equal(applied.length, 1, 'non-fire targets are only frozen');
  assert.equal(applied.at(-1).effect.id, 'frozen');
  assert.ok(!logs.some(line => line.includes('ice damage')), 'no ice damage log for a normal freeze');
}

console.log('Rogue0 frost potion: ice typing, fire-elemental cold damage, resistance/vulnerability, death and freeze behavior passed');
