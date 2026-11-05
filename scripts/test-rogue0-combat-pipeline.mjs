import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('combat-pipeline');
import assert from 'node:assert/strict';
// Real module imports: these boundaries have no runtime renderer dependencies.
import { applyAttackResult } from '../src/games/rogue0/combatApplication.ts';
import { encodeGraph, decodeGraph } from '../src/games/rogue0/saveCodec.ts';
import { loadLogic } from './lib/rogue0-logic-loader.mjs';

function fixture() {
  const events = [];
  const attacker = { type: 'player', effects: [{ id: 'invisible' }] };
  const victim = {
    healthPoints: 10, effects: [],
    takeDamage(n) { events.push('damage'); this.healthPoints -= n; },
    onHitBy() { events.push('reaction'); }
  };
  const context = { onShockWater: () => events.push('water') };
  const hooks = {
    applyEffect(target, effect) { events.push('effect'); target.effects.push(effect); },
    removeEffect(target, id) {
      events.push('reveal'); target.effects = target.effects.filter(effect => effect.id !== id);
    },
    removeEntity() { events.push('death'); },
    onHit() { events.push('hit'); },
    afterEffects() { events.push('visual'); }
  };
  return { events, attacker, victim, context, hooks };
}
const hit = { hit: true, damage: 3, damageType: 'shock', appliedEffects: [{ id: 'chilled' }] };
{
  const f = fixture();
  applyAttackResult(f.context, f.attacker, f.victim, hit, f.hooks);
  assert.deepEqual(f.events, ['damage', 'reveal', 'water', 'hit', 'effect', 'visual', 'reaction']);
  assert.equal(f.victim.healthPoints, 7);
  assert.deepEqual(f.attacker.effects, []);
}
{
  const f = fixture();
  applyAttackResult(f.context, f.attacker, f.victim, { ...hit, hit: false }, f.hooks);
  assert.deepEqual(f.events, [], 'misses do not mutate the target or fire successful-hit hooks');
}
{
  const f = fixture();
  applyAttackResult(f.context, f.attacker, f.victim, { ...hit, damage: 0 }, f.hooks);
  assert.deepEqual(f.events, ['hit', 'effect', 'visual', 'reaction']);
  assert.equal(f.attacker.effects[0].id, 'invisible', 'absorbed hits retain invisibility');
}
{
  const f = fixture();
  f.attacker.type = 'enemy';
  applyAttackResult(f.context, f.attacker, f.victim, { ...hit, damageType: 'fire' }, f.hooks);
  assert.deepEqual(f.events, ['damage', 'hit', 'effect', 'visual', 'reaction']);
}
{
  const f = fixture();
  applyAttackResult(f.context, f.attacker, f.victim, { ...hit, damage: 10 }, f.hooks);
  assert.deepEqual(f.events, ['damage', 'reveal', 'water', 'hit', 'visual', 'reaction', 'death']);
  assert.deepEqual(f.victim.effects, [], 'lethal hits never apply statuses to a corpse');
}
{
  const f = fixture();
  f.hooks.onHit = () => { f.events.push('curse'); f.victim.healthPoints = 0; };
  applyAttackResult(f.context, f.attacker, f.victim, hit, f.hooks);
  assert.deepEqual(f.events, ['damage', 'reveal', 'water', 'curse', 'visual', 'reaction', 'death']);
}
{
  const f = fixture();
  f.hooks.applyEffect = target => { f.events.push('effect'); target.healthPoints = 0; };
  applyAttackResult(f.context, f.attacker, f.victim,
    { ...hit, appliedEffects: [{ id: 'first' }, { id: 'second' }] }, f.hooks);
  assert.equal(f.events.filter(e => e === 'effect').length, 1, 'stop applying statuses after an effect kills');
  assert.equal(f.events.at(-1), 'death');
}
{
  const f = fixture();
  applyAttackResult(f.context, f.attacker, f.victim, { ...hit, damage: 0 },
    { ...f.hooks, notifyVictim: false, applyZeroDamage: true });
  assert.deepEqual(f.events, ['damage', 'hit', 'effect', 'visual'], 'explicit wand policy preserves zero-damage impact and omits physical reactions');
}

// Exercise real combat math with controlled visibility/status boundaries. This
// legacy isolated fixture complements the real-module application tests above.
const { resolveAttack } = loadLogic('src/games/rogue0/combat.ts', {
  canSee: () => true,
  tiles: { getFeature: () => undefined, isGrassConcealed: () => false },
  hasEffect: (actor, id) => actor.effects.some(effect => effect.id === id),
  createBleedingEffect: () => ({ id: 'bleeding' })
});
const attacker = { type: 'player', x: 1, y: 1, baseAttack: 4, effects: [], accuracy: 100,
  attack() { return this.baseAttack; }, meleeAttack() { return this.attack(); } };
const originalAttack = attacker.attack;
const target = { type: 'enemy', x: 2, y: 1, awareOfPlayer: true, visionRadius: 5,
  evasion: 0, resistance: {}, vulnerability: {}, protection: () => 0,
  onAttacked() {
    assert.equal(attacker.attack, originalAttack);
    assert.equal(attacker.baseAttack, 4, 'attack attempts never see temporary bonuses');
  }
};
const context = { currentLevel: [[0]], messages: [], visibleTiles: new Set() };
const random = Math.random;
try {
  Math.random = () => 0.5;
  assert.equal(resolveAttack(context, attacker, target, { bonusDamage: 3 }).damage, 7);
  assert.equal(resolveAttack(context, attacker, target, { baseDamage: 12 }).damage, 12);
  let rolls = 0;
  const roll = () => { rolls++; return 8; };
  assert.equal(resolveAttack(context, attacker, target, { baseDamage: roll }).damage, 8);
  assert.equal(rolls, 1);
  attacker.accuracy = 0;
  assert.equal(resolveAttack(context, attacker, target, { baseDamage: roll }).hit, false);
  assert.equal(rolls, 1, 'missed throws do not consume another random damage roll');
  attacker.accuracy = 100;
  attacker.effects = [{ id: 'weakened' }];
  assert.equal(resolveAttack(context, attacker, target, { bonusDamage: 3 }).damage, 6);
  target.resistance.fire = 2;
  assert.equal(resolveAttack(context, attacker, target, { baseDamage: 12, damageType: 'fire' }).damage, 9);
  Math.random = () => 0.05;
  assert.equal(resolveAttack(context, attacker, target, { bonusDamage: 3 }).damage, 9,
    'explicit bonus damage precedes weakened and critical multipliers');
} finally { Math.random = random; }

// Permanent IDs survive constructor renames; both entity and loot-constructor
// references retain aliases and shared identity through the real codec module.
class RenamedItem {}
const registry = { 'old-wire-id': RenamedItem, 'alias-wire-id': RenamedItem };
for (const id of Object.keys(registry)) {
  const legacy = { root: { ref: 0 }, nodes: [{ kind: 'entity', type: id,
    data: [['loot', { constructorId: id }], ['count', 3]] }] };
  const restored = decodeGraph(legacy, registry);
  assert.ok(restored instanceof RenamedItem);
  assert.equal(restored.loot, RenamedItem);
  const state = decodeGraph(JSON.parse(JSON.stringify(encodeGraph([restored, restored], registry))), registry);
  assert.equal(state[0], state[1]);
  assert.equal(state[0].count, 3);
}
// Impact audio: a landed hit that damages the player sounds like a wound,
// while a fully absorbed hit sounds like armour turning the blow.
{
  const calls = [];
  const sfx = {
    hurt: () => calls.push('hurt'), deflect: () => calls.push('deflect'),
    hit: () => calls.push('hit'), surpriseHit: () => calls.push('surpriseHit'),
  };
  const dungeon = loadLogic('src/games/rogue0/dungeon.ts', { sfx }).default;
  const context = { scene: {} };
  const player = { type: 'player' };
  dungeon.applyHitEffects(context, player);
  assert.deepEqual(calls, ['hurt'], 'damaging player hits play the hurt sound');
  dungeon.applyHitEffects(context, player, false, false);
  assert.deepEqual(calls, ['hurt', 'deflect'], 'absorbed player hits play the deflect sound instead');
  dungeon.applyHitEffects(context, { type: 'enemy' });
  assert.deepEqual(calls, ['hurt', 'deflect', 'hit'], 'monster hits keep their existing impact sound');
}

console.log('Rogue0 combat pipeline: hook order, misses, absorption, invisibility, death, explicit wand policy, damage overrides, bonus damage, hit audio and stable save aliases passed');
