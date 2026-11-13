import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('rings');
import assert from 'node:assert/strict';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
const { Entity, identify, upgrade, removeEntity, saveConsumableKnowledge, restoreConsumableKnowledge,
  RING_APPEARANCES } = load('src/games/rogue0/entity.ts');
Entity.prototype.init = function(context) { this.context = context; };
const Ring = load('src/games/rogue0/items/ring.ts', { Entity, identify }).default;
const classes = Object.fromEntries(['Accuracy', 'Evasion', 'Elements', 'Haste', 'Might'].map(name =>
  [name, load(`src/games/rogue0/items/RingOf${name}.ts`, { Ring }).default]));
const { RING_GEM_COLORS, generateRingTextures } = load('src/games/rogue0/ringTextures.ts');
const Scroll = load('src/games/rogue0/items/ScrollOfUpgrade.ts', { Entity, identify, upgrade, removeEntity, Wand: class {} }).default;
const { actionCost } = load('src/games/rogue0/timing.ts');
const { encodeGraph, decodeGraph } = load('src/games/rogue0/saveCodec.ts');
const Hero = load('src/games/rogue0/classes/basicHero.ts', { Entity }).default;
function setup() {
  const context = { messages: [], entities: [] };
  const player = { accuracy: 95, evasion: 10, movementSpeed: 1, attackDelay: 1, effects: [],
    resistance: { fire: 1, ice: 2, shock: 3 }, baseAttack: 1, strength: 10,
    items: [], canAct: () => true, getAllItems() { return this.items; },
    spendTurn(action) { assert.equal(action, 'use'); this.turns = (this.turns ?? 0) + 1; },
    removeItem(item) { this.items.splice(this.items.indexOf(item), 1); }, refreshUI() {},
  };
  context.player = player;
  return { context, player };
}
function check(name, p, level) {
  assert.equal(p.accuracy, name === 'Accuracy' ? 95 + 5 * (level + 1) : 95);
  assert.equal(p.evasion, name === 'Evasion' ? 10 + 5 * (level + 1) : 10);
  assert.deepEqual(p.resistance, name === 'Elements' ? { fire: 3 + level, ice: 4 + level, shock: 5 + level } : { fire: 1, ice: 2, shock: 3 });
  assert.equal(p.movementSpeed, name === 'Haste' ? 2 + level * 0.5 : 1);
  assert.equal(p.strength, name === 'Might' ? 11 + level : 10);
  assert.equal(Hero.prototype.attack.call(p), 1, 'rings do not grant direct damage');
  assert.equal(actionCost(p, 'attack'), 1, 'Haste rings do not speed attacks');
}
// Every ring kind gets a different gem colour; the colour assignment is shared
// by copies of the kind within a run and restored from the save.
{
  const context = { messages: [] };
  const appearances = Object.fromEntries(Object.entries(classes).map(([name, Type]) =>
    [name, new Type(context).spriteTextureKey]));
  const keys = Object.values(appearances);
  assert.equal(new Set(keys).size, keys.length, 'each ring kind has a different gem');
  for (const key of keys) {
    assert.ok(RING_APPEARANCES.includes(key), `${key} is a generated ring appearance`);
    assert.match(key, /^ring-\d+$/);
  }
  const might = new classes.Might(context);
  assert.equal(might.unidentifiedTextureKey, might.spriteTextureKey,
    'the gem colour is visible before identification');
  assert.match(might.displayName, /^Ring “.+” \?$/, 'the name and upgrade level stay hidden');
  assert.equal(new classes.Might(context).spriteTextureKey, appearances.Might,
    'copies of the same ring kind share the colour');
  assert.equal(new classes.Might(context).unidentifiedName, might.unidentifiedName,
    'copies of the same ring kind share the alias');
  assert.equal(new Set(Object.entries(classes).map(([name, Type]) => new Type(context).unidentifiedName)).size,
    keys.length, 'gem colours give each ring kind a distinct alias');

  const knowledge = saveConsumableKnowledge(context);
  const resumed = { messages: [] };
  restoreConsumableKnowledge(resumed, knowledge);
  for (const [name, Type] of Object.entries(classes)) {
    assert.equal(new Type(resumed).spriteTextureKey, appearances[name],
      `${name} keeps its gem colour after resume`);
  }
}
// The generated textures and the appearance keys must describe the same set.
{
  const textures = new Map();
  const scene = {
    textures: { exists: key => textures.has(key), remove: key => textures.delete(key) },
    make: { graphics: () => {
      const g = {
        fillStyle: () => g, fillCircle: () => g, fillRect: () => g,
        generateTexture: (key, width, height) => { textures.set(key, { width, height }); },
        destroy: () => {},
      };
      return g;
    } },
  };
  generateRingTextures(scene);
  assert.deepEqual([...textures.keys()], [...RING_APPEARANCES],
    'one generated texture per assignable ring appearance');
  assert.equal(RING_GEM_COLORS.length, RING_APPEARANCES.length,
    'ringTextures.ts and entity.ts list the same number of appearances');
  assert.equal(new Set(RING_GEM_COLORS).size, RING_GEM_COLORS.length, 'gem colours are unique');
  for (const { width, height } of textures.values()) assert.deepEqual([width, height], [16, 16]);
}
// Custom artwork on ring-slot items is never replaced by a generated colour.
{
  const custom = Object.assign(new Entity(), {
    context: { messages: [] }, equipSlot: 'ring', textureKey: 'custom-ring', identified: false,
  });
  assert.equal(custom.spriteTextureKey, 'custom-ring');
  assert.equal(custom.unidentifiedTextureKey, 'custom-ring');
}
for (const [name, Type] of Object.entries(classes)) {
  const { context, player } = setup();
  const ring = new Type(context);
  player.items.push(ring); player.ring1 = ring;
  ring.equip(); ring.equip();
  check(name, player, 0);
  for (let level = 1; level <= 3; level++) {
    const beforeDescription = ring.baseDescription;
    const scroll = new Scroll(context); player.items.push(scroll); context.entities.push(scroll);
    assert.equal(scroll.useOnItem(ring), true);
    assert.equal(ring.level, level); check(name, player, level);
    assert.notEqual(ring.baseDescription, beforeDescription, 'description reflects new bonus');
    assert.equal(player.turns, level, 'one action per upgrade');
  }
  const restored = decodeGraph(JSON.parse(JSON.stringify(encodeGraph({ ring, player }, { Ring: Type }))), { Ring: Type });
  restored.ring.context = { player: restored.player, messages: [] };
  restored.ring.onUpgrade(); restored.ring.onUpgrade();
  check(name, restored.player, 3);
  restored.ring.unequip(); restored.player.ring1 = undefined;
  check('none', restored.player, 0);
  ring.unequip(); ring.unequip(); player.ring1 = undefined;
  check('none', player, 0);
  upgrade(ring); check('none', player, 0); // Backpack upgrade must not grant stats.
  player.ring1 = ring; ring.equip(); check(name, player, 4);
  const second = new Type(context); player.ring2 = second; second.equip();
  upgrade(second);
  second.unequip(); player.ring2 = undefined;
  check(name, player, 4, 'removing a second ring retains the first bonus');
  ring.unequip(); player.ring1 = undefined;
  check('none', player, 0);
}
// Reconcile old saves: their level could be high while the installed bonus was fixed.
for (const [name, Type] of Object.entries(classes)) {
  const { context, player } = setup();
  const ring = new Type(context); player.ring1 = ring;
  ring.equip();
  if (name === 'Haste') {
    player.movementSpeed = 1;
    player.effects = [{ id: 'haste', duration: Infinity, manualExpiry: true }];
  }
  delete ring.passiveLevel;
  ring.level = 2;
  ring.onUpgrade(); check(name, player, 2);
  ring.onUpgrade(); check(name, player, 2);
  if (name === 'Haste') assert.equal(player.effects.length, 0, 'legacy permanent Haste is replaced, not double-counted');
}
// Might helps meet equipment requirements, stacks, and preserves potion gains.
{
  const { context, player } = setup();
  player.strengthDeficit = Hero.prototype.strengthDeficit;
  player.weapon = { requiredStrength: 12 };
  player.armor = { requiredStrength: 12 };
  const first = new classes.Might(context);
  const second = new classes.Might(context);
  first.equip();
  assert.equal(player.strengthDeficit(player.weapon), 1);
  assert.equal(Hero.prototype.attackCostMultiplier.call(player), 1.2);
  second.equip();
  assert.equal(player.strength, 12);
  assert.equal(player.strengthDeficit(player.armor), 0);
  assert.equal(Hero.prototype.attackCostMultiplier.call(player), 1);
  assert.equal(Hero.prototype.movementCostMultiplier.call(player), 1);
  player.strength += 1; // Potion of Strength's permanent gain.
  first.unequip(); second.unequip();
  assert.equal(player.strength, 11, 'removal preserves permanent Strength gains');
}
// Pre-change saves have an equipped Might ring but no installed Strength bonus.
for (const cursed of [false, true]) {
  const { context, player } = setup();
  const ring = new classes.Might(context);
  ring.level = 3; ring.cursed = cursed; player.ring1 = ring;
  ring.equip();
  player.strength = 10;
  delete ring.appliedStrength;
  const restored = decodeGraph(JSON.parse(JSON.stringify(encodeGraph({ ring, player }, { Ring: classes.Might }))), { Ring: classes.Might });
  restored.ring.context = { player: restored.player };
  restored.ring.onUpgrade();
  restored.ring.onUpgrade();
  assert.equal(restored.player.strength, cursed ? 6 : 14, 'legacy reconciliation applies Strength exactly once');
  restored.ring.unequip();
  assert.equal(restored.player.strength, 10, 'legacy removal does not subtract an uninstalled bonus');
}
// Ring changes during blindness must survive the effect wearing off.
{
  const { context, player } = setup();
  const ring = new classes.Accuracy(context); ring.equip();
  player.effects = [{ id: 'blinded', originalAccuracy: 100 }]; player.accuracy = 75;
  upgrade(ring);
  assert.equal(player.accuracy, 80);
  assert.equal(player.effects[0].originalAccuracy, 105);
  ring.unequip();
  assert.equal(player.accuracy, 70);
  assert.equal(player.effects[0].originalAccuracy, 95);
}
{
  const { context, player } = setup();
  player.effects = [{ id: 'haste', duration: 5 }];
  const ring = new classes.Haste(context); ring.equip(); upgrade(ring);
  assert.equal(actionCost(player, 'move'), 1 / 5);
  ring.unequip();
  assert.equal(actionCost(player, 'move'), 1 / 2);
  assert.equal(player.effects[0].duration, 5, 'unequipping does not cancel temporary Haste');
}
console.log('Rogue0 rings: all five upgrade curves, live passives, scroll costs, descriptions, removal, stacking, saves, legacy repair, blindness and Haste passed');
