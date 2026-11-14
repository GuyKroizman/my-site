import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('equipment-identification');
import assert from 'node:assert/strict';

import { loadLogic } from './lib/rogue0-logic-loader.mjs';
const load = (name, bindings) => loadLogic(`src/games/rogue0/${name}.ts`, bindings);

const tiles = load('tiles');
const { Entity, EQUIPMENT_IDENTIFY_USES } = load('entity');
const hasEffect = (e, id) => (e.effects ?? []).some(effect => effect.id === id);
const removeEffect = (e, id) => { e.effects = (e.effects ?? []).filter(effect => effect.id !== id); };

let result = { hit: true, damage: 3, crit: false, surprise: false, damageType: 'physical', appliedEffects: [] };
const resolveAttack = () => result;
const removeEntity = () => {};
const fov = load('fov', tiles);

const dungeon = load('dungeon', {
  tiles, ...fov, hasEffect, removeEffect, resolveAttack, removeEntity,
  spawnEntityFloatingText() {}, applyEffect() {},
}).default;
dungeon.applyHitEffects = () => {};
dungeon.procArmorCurse = () => {};
dungeon.procWeaponCurse = () => {};

function setup() {
  tiles.clearAllFeatures();
  dungeon.currentLevel = Array.from({ length: 8 }, () => Array(10).fill(0));
  return { entities: [], messages: [], visibleTiles: new Set(), simulationTime: 1 };
}

function actor(ctx, type, x, y, hp = 20) {
  const e = Object.assign(new Entity(), {
    context: ctx, x, y, type, name: type, healthPoints: hp, effects: [],
    onHitEffects: () => [],
    takeDamage(n) { this.healthPoints -= n; },
  });
  ctx.entities.push(e);
  return e;
}

function gear(ctx, equipSlot, level = 2) {
  return Object.assign(new Entity(), {
    context: ctx, type: 'item', equipSlot,
    name: equipSlot === 'weapon' ? 'Shortsword' : 'Mail Armor',
    tier: 2, level, identified: false,
  });
}

// Unknown gear shows level-zero stats, never the hidden upgrade's damage or
// reduced strength requirement. Armor currently absorbs a fixed amount.
const { TieredWeapon, TieredArmor } = load('items/tieredEquipment', { Entity });
for (let tier = 1; tier <= 5; tier++) {
  for (const Gear of [TieredWeapon, TieredArmor]) {
    const item = new Gear({ messages: [] }, undefined, undefined, tier);
    const stats = Gear === TieredWeapon
      ? `melee weapon deals ${tier}-${5 * tier} damage`
      : `armor absorbs ${2 * tier} physical damage`;
    const expected = `This tier-${tier} ${stats} and requires ${8 + 2 * tier} strength to use properly.`;
    for (const level of [0, 1, 2, 3, 6, 10]) {
      item.level = level;
      assert.equal(item.displayDescription, expected);
      assert.equal(item.level, level, 'describing an item must not change its upgrade');
      assert.equal(item.identified, false, 'describing an item must not identify it');
    }
    assert.ok(item.requiredStrength < item.baseRequiredStrength,
      'actual upgraded strength requirement remains lower than the displayed base requirement');
    item.cursed = true;
    assert.equal(item.displayDescription, expected, 'unknown curses stay hidden');
    item.curseScanned = true;
    assert.equal(item.displayDescription, expected, 'scanned curses add no description text');
    item.cursed = false;
    item.curseScanned = false;
    item.identified = true;
    assert.equal(item.displayDescription, item.baseDescription, 'identification reveals upgraded stats');
  }
}

// A landed swing teaches an unknown weapon; equipping alone never did.
{
  const ctx = setup();
  const player = actor(ctx, 'player', 1, 1, 40);
  const weapon = gear(ctx, 'weapon', 2);
  player.weapon = weapon;
  player.currentWeapon = () => weapon;
  ctx.player = player;
  const enemy = actor(ctx, 'enemy', 2, 1, 100);
  assert.equal(weapon.displayName, 'Shortsword ? (Tier 2)');
  for (let use = 1; use < EQUIPMENT_IDENTIFY_USES; use++) {
    dungeon.resolveAndApplyAttack(ctx, player, enemy, 0, 'physical');
    assert.equal(weapon.identified, false, `still unknown after ${use} swing(s)`);
    assert.equal(weapon.displayName, 'Shortsword ? (Tier 2)');
  }
  dungeon.resolveAndApplyAttack(ctx, player, enemy, 0, 'physical');
  assert.equal(weapon.identified, true, 'the final swing reveals the weapon');
  assert.equal(weapon.displayName, 'Shortsword +2 (Tier 2)');
  assert.ok(ctx.messages.some(message => message.startsWith('Identified: Shortsword')));
}

// A blow taken teaches unknown armor. Misses never reach the learning hook.
{
  const ctx = setup();
  const player = actor(ctx, 'player', 1, 1, 40);
  const armor = gear(ctx, 'armor', 1);
  player.armor = armor;
  ctx.player = player;
  const enemy = actor(ctx, 'enemy', 2, 1, 100);

  result = { hit: false, damage: 0, crit: false, surprise: false, damageType: 'physical', appliedEffects: [] };
  for (let i = 0; i < EQUIPMENT_IDENTIFY_USES + 2; i++) {
    dungeon.resolveAndApplyAttack(ctx, enemy, player, 0, 'physical');
  }
  assert.equal(armor.identified, false, 'missed attacks do not teach armor');
  assert.equal(armor.equipmentUses, 0);

  result = { hit: true, damage: 2, crit: false, surprise: false, damageType: 'physical', appliedEffects: [] };
  for (let use = 1; use <= EQUIPMENT_IDENTIFY_USES; use++) {
    dungeon.resolveAndApplyAttack(ctx, enemy, player, 0, 'physical');
    assert.equal(armor.identified, use === EQUIPMENT_IDENTIFY_USES,
      `armor learns on blow ${use} of ${EQUIPMENT_IDENTIFY_USES}`);
  }
  assert.equal(armor.displayName, 'Mail Armor +1 (Tier 2)');
}

// Only the currently wielded/worn slot learns; backpack gear stays unknown.
{
  const ctx = setup();
  const player = actor(ctx, 'player', 1, 1, 40);
  const weapon = gear(ctx, 'weapon', 2);
  const spare = gear(ctx, 'weapon', 2);
  player.weapon = weapon;
  player.currentWeapon = () => weapon;
  ctx.player = player;
  const enemy = actor(ctx, 'enemy', 2, 1, 100);
  for (let i = 0; i < EQUIPMENT_IDENTIFY_USES; i++) {
    dungeon.resolveAndApplyAttack(ctx, player, enemy, 0, 'physical');
  }
  assert.equal(weapon.identified, true);
  assert.equal(spare.identified, false, 'an unwielded weapon gains no familiarity');
  assert.equal(spare.equipmentUses, 0);
}

// Rings hide their type; recognizable artifacts still hide their upgrade.
{
  const ctx = { messages: [] };
  for (const [equipSlot, label] of [['ring', 'Ring'], ['artifact', 'Artifact']]) {
    const item = Object.assign(new Entity(), {
      context: ctx, type: 'item', equipSlot, name: equipSlot === 'ring' ? 'Ring of Haste' : 'Chalice of Blood',
      level: 2, identified: false,
    });
    assert.equal(item.isRecognizableEquipment, equipSlot === 'artifact');
    if (equipSlot === 'artifact') {
      assert.equal(item.displayName, `${item.name} ?`);
    } else {
      assert.match(item.displayName, new RegExp(`^${label} “.+” \\?$`));
      assert.doesNotMatch(item.displayName, new RegExp(item.name));
    }
    for (let use = 0; use < EQUIPMENT_IDENTIFY_USES; use++) item.learnEquipmentFromUse();
    assert.equal(item.identified, true, `${equipSlot} identifies through extended use`);
    assert.equal(item.displayName, `${item.name} +2`);
  }
}

console.log(`Rogue0 equipment identification: unknown gear hides upgrades, identifies after ${EQUIPMENT_IDENTIFY_USES} combat uses, and only the equipped/worn item learns passed`);
