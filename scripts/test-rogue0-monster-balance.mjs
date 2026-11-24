import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('monster-balance');
import assert from 'node:assert/strict';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
import { encodeGraph, decodeGraph } from '../src/games/rogue0/saveCodec.ts';
import {
  floorMonsterRoster, elementalKindsForFloor, expectedHeroAtFloor, monsterStats,
  MONSTER_XP, MONSTER_FIRST_FLOOR,
} from '../src/games/rogue0/monsterBalance.ts';
import { pickReinforcementKind } from '../src/games/rogue0/monsterReinforcements.ts';
import { xpForHeroLevel } from '../src/games/rogue0/progression.ts';

const unlocks = { skeleton: 1, frog: 1, swarm: 2, mimic: 2, goblin: 3,
  quloptsh: 6, ghoul: 8, brute: 11, cultist: 13, wraith: 16, elemental: 18, boss: 5,
  firePotionThrower: 10 };
assert.deepEqual(MONSTER_FIRST_FLOOR, unlocks);
assert.deepEqual([1, 2, 3, 4].map(f => Object.values(floorMonsterRoster(f)).reduce((a, b) => a + b, 0)),
  [4, 7, 9, 11], 'opening floors build up gradually instead of spawning 15 enemies by floor 3');
// Independent exact weighted boundaries, including the frog's retirement.
for (const [floor, weighted] of [
  [1, [['skeleton', 4], ['frog', 1]]],
  [3, [['skeleton', 4], ['goblin', 2], ['swarm', 1], ['frog', 1]]],
  [6, [['skeleton', 4], ['goblin', 2], ['swarm', 1], ['quloptsh', 2]]],
  [18, [['skeleton', 4], ['goblin', 2], ['swarm', 1], ['quloptsh', 2],
    ['ghoul', 1], ['brute', 1], ['cultist', 1], ['wraith', 1], ['elemental', 2]]],
]) {
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  let start = 0;
  for (const [kind, weight] of weighted) {
    assert.equal(pickReinforcementKind(floor, () => (start + 1e-8) / total), kind);
    assert.equal(pickReinforcementKind(floor, () => (start + weight - 1e-8) / total), kind);
    start += weight;
  }
}
let cumulativeXp = 0;
for (let floor = 1; floor <= 25; floor++) {
  const boss = floor % 5 === 0;
  const factory = floor === 10;
  const roster = floorMonsterRoster(floor);
  const pool = new Set(Array.from({ length: 1000 }, (_, i) => pickReinforcementKind(floor, () => i / 1000)));
  for (const [kind, first] of Object.entries(unlocks)) {
    const available = floor >= first && (kind !== 'frog' || floor <= 4);
    const expectedPresence = factory
      ? ['firePotionThrower', 'skeleton', 'goblin'].includes(kind)
      : kind === 'boss' ? boss : !boss && available;
    assert.equal(roster[kind] > 0, expectedPresence,
      `${kind} initial unlock on floor ${floor}`);
    assert.equal(pool.has(kind),
      !['mimic', 'boss', 'firePotionThrower'].includes(kind) && available,
      `${kind} reinforcement unlock on floor ${floor}`);
  }
  assert.equal(roster.skeleton, factory ? 2 : boss ? 0 : 2 + Math.min(floor, 5),
    'skeleton counts unchanged outside the factory guard roster');
  assert.equal(roster.mimic, !boss && floor >= 2 ? 1 : 0, 'mimic counts unchanged');
  assert.equal(expectedHeroAtFloor(floor).totalXp, cumulativeXp, 'only preceding floors contribute XP');
  cumulativeXp += Object.entries(roster).reduce((sum, [kind, count]) =>
    sum + (kind === 'mimic' ? 0 : count * MONSTER_XP[kind]), 0);
}
assert.deepEqual(elementalKindsForFloor(17), []);
assert.deepEqual(elementalKindsForFloor(18), ['fire']);
assert.deepEqual(elementalKindsForFloor(20), ['fire']);
assert.deepEqual(elementalKindsForFloor(21), ['fire', 'ice']);
assert.deepEqual(elementalKindsForFloor(22), ['fire', 'ice']);
assert.deepEqual(elementalKindsForFloor(23), ['fire', 'ice', 'shock']);
assert.deepEqual([1, 5, 10, 15, 20, 25].map(f => expectedHeroAtFloor(f).level), [1, 5, 9, 13, 16, 19],
  'the factory guard roster adds enough XP for one more level by floor 15');
assert.equal(expectedHeroAtFloor(2).totalXp, 12, 'three skeletons and one frog on floor 1');
assert.equal(expectedHeroAtFloor(3).totalXp, 31, 'optional Mimic is not assumed killed');
assert.equal(expectedHeroAtFloor(7).tier, 2, 'region-two weapon picked up on floor 6');
assert.equal(expectedHeroAtFloor(7).armorTier, 1, 'region-two armor is not available yet');
assert.equal(expectedHeroAtFloor(9).armorTier, 2, 'region-two armor picked up on floor 8');

// Run the actual hero's XP progression, not a duplicate of the estimate's loop.
const { Entity } = load('src/games/rogue0/entity.ts');
Entity.prototype.init = function(context, x, y) { Object.assign(this, { context, x, y }); };
const dungeon = { log() {}, getCurrentLevel: () => [[0]] };
const Hero = load('src/games/rogue0/classes/basicHero.ts', { Entity, dungeon, sfx: { levelUp() {} } }).default;
Hero.prototype.bindInput = function() {};
const hero = new Hero({});
for (let floor = 1; floor <= 25; floor++) {
  const projected = expectedHeroAtFloor(floor);
  assert.equal(hero.level, projected.level);
  assert.equal(hero.xp, projected.xp);
  assert.equal(hero.maxHealthPoints, projected.health);
  assert.equal(hero.baseAttack, projected.level - 1);
  assert.equal(hero.xpForNextLevel(), xpForHeroLevel(hero.level));
  const roster = floorMonsterRoster(floor);
  for (const [kind, count] of Object.entries(roster)) {
    if (kind !== 'mimic') hero.gainXp(count * MONSTER_XP[kind]);
  }
}

// Real constructors and base actor, with display creation alone replaced.
const Monster = load('src/games/rogue0/monsters/monster.ts', {
  Entity, dungeon, Phaser: { Math: { Between: () => 8 } },
}).default;
class Loot {}
const bindings = { Monster, BerserkPotion: Loot, PotionOfHealing: Loot, Shoe: Loot,
  BOSS_TEXTURE: 'boss', WRAITH_TEXTURE: 'wraith', FLY_SWARM_TEXTURE: 'swarm',
  DEADLY_FROG_TEXTURE: 'frog', FIRE_ELEMENTAL_TEXTURE: 'fire', ICE_ELEMENTAL_TEXTURE: 'ice',
  LIGHTNING_ELEMENTAL_TEXTURE: 'shock', CHEST_TEXTURE: 'chest' };
const paths = { skeleton: 'skelaton', frog: 'deadlyFrog', swarm: 'swarmOfFlies',
  goblin: 'goblin', quloptsh: 'quloptsh', ghoul: 'ghoul', brute: 'brute',
  cultist: 'cultist', wraith: 'wraith', boss: 'boss', mimic: 'mimic' };
const classes = Object.fromEntries(Object.entries(paths).map(([kind, file]) =>
  [kind, load(`src/games/rogue0/monsters/${file}.ts`, bindings).default]));
const elementals = load('src/games/rogue0/monsters/elemental.ts', bindings);
Object.assign(classes, { fire: elementals.FireElemental, ice: elementals.IceElemental, shock: elementals.ShockElemental });
const registry = { ...classes, loot: Loot };
for (const [kind, Cls] of Object.entries(classes)) {
  let previousHp = 0, previousDamage = 0;
  for (let floor = 1; floor <= 25; floor++) {
    const context = { floor, entities: [], messages: [], visibleTiles: new Set(),
      player: { level: 99, xp: 99999, baseAttack: 9999 } };
    const actor = new Cls(context, 0, 0);
    assert.equal(actor.healthPoints, actor.maxHealthPoints);
    if (kind === 'skeleton') {
      assert.deepEqual([actor.healthPoints, actor.attack(), actor.xpValue], [8, 2, 2]);
    } else if (kind === 'mimic') {
      const tier = Math.ceil(floor / 5);
      assert.deepEqual([actor.healthPoints, actor.attack()], [24 + tier * 8, 10 + tier * 4]);
    } else if (kind === 'swarm') {
      assert.deepEqual([actor.healthPoints, actor.attack()], [28, 6]);
    } else {
      const balanceKind = ['fire', 'ice', 'shock'].includes(kind) ? 'elemental' : kind;
      const stats = monsterStats(balanceKind, floor);
      assert.equal(actor.healthPoints, stats.healthPoints);
      assert.equal(actor.attack(), stats.attackDamage);
      assert.equal(actor.xpValue, MONSTER_XP[balanceKind], 'XP projection agrees with real rewards');
      if (['goblin', 'cultist'].includes(kind)) {
        assert.equal(actor.meleeAttack(), stats.meleeDamage);
        assert.ok(actor.meleeAttack() < actor.attack());
        assert.ok(actor.meleeAttack() > expectedHeroAtFloor(floor).armor,
          'sidearms remain a threat through expected late armor');
      }
      assert.ok(actor.healthPoints >= previousHp && actor.attack() >= previousDamage,
        `${kind} never gets weaker with depth`);
    }
    previousHp = actor.healthPoints; previousDamage = actor.attack();
    // A stronger/weaker actual hero never changes the floor's spawn stats.
    context.player = { level: 1, xp: 0, baseAttack: 0 };
    const other = new Cls(context, 0, 0);
    assert.deepEqual([other.healthPoints, other.attack()], [actor.healthPoints, actor.attack()]);
    // Save/restore preserves wounded stats rather than re-scaling or healing.
    actor.healthPoints -= 3;
    const restored = decodeGraph(JSON.parse(JSON.stringify(encodeGraph(actor, registry))), registry);
    restored.init({ ...context, floor: 25 }, 0, 0);
    assert.deepEqual([restored.healthPoints, restored.maxHealthPoints, restored.attack()],
      [actor.healthPoints, actor.maxHealthPoints, actor.attack()]);
  }
}
assert.deepEqual(monsterStats('boss', 5), { healthPoints: 120, attackDamage: 15 });
assert.deepEqual(monsterStats('boss', 25), { healthPoints: 470, attackDamage: 60 });
assert.ok(monsterStats('boss', 25).healthPoints > monsterStats('boss', 5).healthPoints * 3);
console.log('Rogue0 monster balance: all-floor unlocks, XP/hero projection, real constructor stats, unchanged skeletons/mimics, no rubber-banding and save round trips passed');
