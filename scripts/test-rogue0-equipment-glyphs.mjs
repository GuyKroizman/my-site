import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('equipment-glyphs');
import assert from 'node:assert/strict';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
import * as glyphs from '../src/games/rogue0/equipmentGlyphs.ts';
import { encodeGraph, decodeGraph } from '../src/games/rogue0/saveCodec.ts';

const { Entity } = load('src/games/rogue0/entity.ts');
Entity.prototype.init = function (context, x, y) {
  this.context = context;
  this.x = x;
  this.y = y;
};

const seq = values => {
  let index = 0;
  return () => values[index++] ?? 0.99;
};

// --- Pure generation tables ------------------------------------------------
assert.deepEqual([...glyphs.WEAPON_GLYPHS], ['fire', 'frost', 'luck', 'range', 'push']);
assert.deepEqual([...glyphs.ARMOR_GLYPHS], ['thorns', 'push']);
assert.equal(glyphs.EQUIPMENT_GLYPH_CHANCE, 0.25);

const weaponLike = { type: 'item', equipSlot: 'weapon', name: 'Broadsword', glyph: '' };
const armorLike = { type: 'item', equipSlot: 'armor', name: 'Mail Armor', glyph: '' };
const scrollLike = { type: 'item', equipSlot: 'weapon', name: 'Scroll of Fireball', glyph: '' };
const ringLike = { type: 'item', equipSlot: 'ring', name: 'Ring', glyph: '' };
assert.equal(glyphs.glyphSlotOf(weaponLike), 'weapon');
assert.equal(glyphs.glyphSlotOf(armorLike), 'armor');
assert.equal(glyphs.glyphSlotOf(scrollLike), null, 'wizard scroll weapons are not physical gear');
assert.equal(glyphs.glyphSlotOf(ringLike), null);
assert.equal(glyphs.glyphEligible(weaponLike), true);
assert.equal(glyphs.glyphEligible(armorLike), true);
assert.equal(glyphs.glyphEligible(scrollLike), false);
assert.equal(glyphs.glyphEligible(ringLike), false);

assert.equal(glyphs.equipmentGlyphName('fire'), 'Fire');
assert.equal(glyphs.equipmentGlyphName('thorns'), 'Thorns');
assert.equal(glyphs.equipmentGlyphName(''), '');
assert.match(glyphs.equipmentGlyphDescription('range', 'weapon'), /2 tiles away/);
assert.match(glyphs.equipmentGlyphDescription('push', 'armor'), /knocked back/);
assert.match(glyphs.equipmentGlyphDescription('thorns', 'armor'), /quarter of the damage/);

// --- Random glyph assignment ----------------------------------------------
{
  const item = { type: 'item', equipSlot: 'weapon', name: 'Broadsword', glyph: '' };
  assert.equal(glyphs.rollEquipmentGlyph(item, 0.25, seq([0.99])), false);
  assert.equal(item.glyph, '', 'an over-chance roll leaves the item plain');
}
{
  const item = { type: 'item', equipSlot: 'weapon', name: 'Broadsword', glyph: '' };
  assert.equal(glyphs.rollEquipmentGlyph(item, 0.25, seq([0, 0])), true);
  assert.equal(item.glyph, 'fire', 'weapon glyph index zero is fire');
}
{
  const item = { type: 'item', equipSlot: 'weapon', name: 'Broadsword', glyph: '' };
  assert.equal(glyphs.rollEquipmentGlyph(item, 0.25, seq([0, 0.999])), true);
  assert.equal(item.glyph, 'push', 'the last weapon glyph is push');
}
{
  const item = { type: 'item', equipSlot: 'armor', name: 'Mail Armor', glyph: '' };
  assert.equal(glyphs.rollEquipmentGlyph(item, 0.25, seq([0, 0])), true);
  assert.equal(item.glyph, 'thorns', 'armor glyph index zero is thorns');
}
{
  const item = { type: 'item', equipSlot: 'armor', name: 'Mail Armor', glyph: 'thorns' };
  assert.equal(glyphs.rollEquipmentGlyph(item, 0.25, seq([0, 0])), false,
    'existing glyphs are never overwritten by generation');
}
assert.equal(glyphs.rollRandomGlyph(weaponLike, seq([0])), 'fire');
assert.equal(glyphs.rollRandomGlyph(weaponLike, seq([0.999])), 'push');
assert.equal(glyphs.rollRandomGlyph(armorLike, seq([0])), 'thorns');
assert.equal(glyphs.rollRandomGlyph(armorLike, seq([0.999])), 'push');

// --- Reach glyph extends a weapon's strike range --------------------------
{
  const gear = load('src/games/rogue0/items/tieredEquipment.ts', { Entity, Phaser: { Math: { Between: min => min } } });
  const weapon = new gear.TieredWeapon(undefined, undefined, undefined, 2);
  assert.equal(weapon.range(), 0, 'ordinary melee weapons stay adjacent');
  weapon.glyph = 'range';
  assert.equal(weapon.range(), 2, 'a Reach glyph lets the weapon strike two tiles away');
}

// --- Weapon glyph combat procs --------------------------------------------
{
  const applied = [];
  const floating = [];
  const effects = {
    applyEffect: (target, effect) => applied.push({ target, effect }),
    createBurningEffect: () => ({ id: 'burning' }),
    createFrozenEffect: () => ({ id: 'frozen' }),
    createChilledEffect: () => ({ id: 'chilled' }),
    spawnEntityFloatingText: (...args) => floating.push(args),
    removeEntity: (ctx, entity) => {
      ctx.entities = ctx.entities.filter(candidate => candidate !== entity);
    },
  };
  const dungeonLogic = load('src/games/rogue0/dungeon.ts', effects);
  const dungeon = dungeonLogic.default;
  const logs = [];
  const pushed = [];
  const fakeDungeon = {
    log(_context, text) { logs.push(text); },
    knockback(_context, target, dx, dy) { pushed.push([target, dx, dy]); return true; },
  };
  const ctx = { entities: [], messages: [] };

  const weapon = { displayName: 'Broadsword [Fire]', glyph: 'fire' };
  const attacker = { type: 'player', weapon, x: 1, y: 1 };
  const victim = { type: 'enemy', name: 'Goblin', x: 2, y: 1, healthPoints: 10 };

  dungeon.procWeaponGlyph.call(fakeDungeon, ctx, attacker, victim, 5);
  assert.deepEqual(applied.map(entry => entry.effect.id), ['burning'],
    'a fire weapon ignites the target on a successful hit');
  assert.match(logs.at(-1), /sets Goblin on fire/);

  applied.length = 0;
  weapon.glyph = 'frost';
  dungeon.procWeaponGlyph.call(fakeDungeon, ctx, attacker, victim, 5);
  assert.deepEqual(applied.map(entry => entry.effect.id), ['frozen', 'chilled'],
    'a frost weapon freezes and chills the target');

  applied.length = 0;
  weapon.glyph = 'push';
  dungeon.procWeaponGlyph.call(fakeDungeon, ctx, attacker, victim, 5);
  assert.deepEqual(pushed, [[victim, 1, 0]],
    'a push weapon knocks the target directly away');
  victim.y = 2;
  dungeon.procWeaponGlyph.call(fakeDungeon, ctx, attacker, victim, 5);
  assert.deepEqual(pushed.at(-1), [victim, 1, 0], 'diagonal contact pushes horizontally');

  applied.length = 0;
  pushed.length = 0;
  victim.healthPoints = 0;
  weapon.glyph = 'fire';
  dungeon.procWeaponGlyph.call(fakeDungeon, ctx, attacker, victim, 5);
  assert.equal(applied.length, 0, 'glyphs never proc on an already-dead victim');
}

// --- Armor glyph combat procs ---------------------------------------------
{
  const applied = [];
  const floating = [];
  const effects = {
    applyEffect: (target, effect) => applied.push({ target, effect }),
    createBurningEffect: () => ({ id: 'burning' }),
    createFrozenEffect: () => ({ id: 'frozen' }),
    createChilledEffect: () => ({ id: 'chilled' }),
    spawnEntityFloatingText: (...args) => floating.push(args),
    removeEntity: (ctx, entity) => {
      ctx.entities = ctx.entities.filter(candidate => candidate !== entity);
    },
  };
  const dungeonLogic = load('src/games/rogue0/dungeon.ts', effects);
  const dungeon = dungeonLogic.default;
  const logs = [];
  const pushed = [];
  const fakeDungeon = {
    log(_context, text) { logs.push(text); },
    knockback(_context, target, dx, dy) { pushed.push([target, dx, dy]); return true; },
  };
  const ctx = { entities: [], messages: [] };

  const armor = { displayName: 'Mail Armor [Thorns]', glyph: 'thorns' };
  const victim = { type: 'player', armor, x: 1, y: 1, healthPoints: 10 };
  let taken = 0;
  const attacker = {
    type: 'enemy', name: 'Goblin', x: 2, y: 1, healthPoints: 10,
    takeDamage(amount) { taken += amount; },
  };

  dungeon.procArmorGlyph.call(fakeDungeon, ctx, victim, attacker, 8, 0);
  assert.equal(taken, 2, 'thorns reflect a quarter of the blow, rounded');
  assert.equal(floating.length, 1, 'thorns show their reflected damage');
  assert.match(ctx.messages[0], /returns 2 damage to Goblin/);

  armor.glyph = 'push';
  dungeon.procArmorGlyph.call(fakeDungeon, ctx, victim, attacker, 5, 0);
  assert.deepEqual(pushed, [[attacker, 1, 0]],
    'armor push knocks the attacker directly away');

  armor.glyph = 'thorns';
  taken = 0;
  pushed.length = 0;
  dungeon.procArmorGlyph.call(fakeDungeon, ctx, victim, attacker, 8, 1);
  assert.equal(taken, 0, 'ranged attacks never trigger thorns');
  assert.equal(pushed.length, 0, 'ranged attacks never trigger armor push');
}

// --- Luck glyph improves monster drops ------------------------------------
{
  const Gold = load('src/games/rogue0/items/gold.ts', { Entity }).default;
  Gold.prototype.init = function (context, x, y) { Object.assign(this, { context, x, y }); };
  let between = [];
  const PhaserStub = { Math: { Between: (_min, _max) => between.shift() ?? 1 } };
  const Monster = load('src/games/rogue0/monsters/monster.ts', {
    Entity, Gold, Phaser: PhaserStub,
  }).default;
  const messages = [];
  const player = {
    weapon: { glyph: '' }, gold: 0, gainXp() {}, refreshUI() {},
    backpack: [], capacity: 0,
  };
  const context = { player, entities: [], messages, visibleTiles: new Set() };
  player.context = context;
  const makeMonster = (overrides = {}) => Object.assign(Object.create(Monster.prototype), {
    context, name: 'Rat', gold: 3, xpValue: 5, loot: [], x: 4, y: 5, ...overrides,
  });

  const LootClass = class { name = 'Potion'; };

  // Without luck: empty item roll, gold roll misses.
  between = [0, 2];
  makeMonster({ loot: [false, LootClass], gold: 3 }).onDestroy();
  assert.equal(context.entities.length, 0, 'a plain kill can drop nothing');

  // With luck: the empty item roll is rerolled into the real item.
  between = [0, 1];
  player.weapon.glyph = 'luck';
  makeMonster({ loot: [false, LootClass], gold: 3 }).onDestroy();
  assert.equal(context.entities.length, 1, 'luck rerolls an empty item result');
  assert.equal(context.entities[0].name, 'Potion');

  // With luck: all-empty item tables still double the gold fallback.
  context.entities.length = 0;
  messages.length = 0;
  between = [0, 0, 1];
  makeMonster({ loot: [false, false], gold: 3 }).onDestroy();
  assert.equal(context.entities.length, 1, 'luck improves the gold fallback');
  assert.equal(context.entities[0].goldAmount, 3);
}

// Glyphs survive graph saves without constructor rolls, including legacy gear.
{
  const weapon = Object.assign(new Entity(), { type: 'item', equipSlot: 'weapon', glyph: 'frost' });
  const registry = { gear: Entity };
  const restored = decodeGraph(encodeGraph({ weapon }, registry), registry);
  assert.equal(restored.weapon.glyph, 'frost');
  delete weapon.glyph;
  const legacy = decodeGraph(encodeGraph({ weapon }, registry), registry);
  assert.equal(legacy.weapon.glyphDescription, '', 'old saves without a glyph remain plain');
}
console.log('Rogue0 equipment glyphs: generation, reach, weapon/armor procs, saves and luck drops passed');
