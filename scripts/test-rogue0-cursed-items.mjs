import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('cursed-items');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function load(path, bindings = {}) {
  const source = fs.readFileSync(path, 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
  const exports = {};
  new Function('exports', ...Object.keys(bindings), ts.transpile(source, {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }))(exports, ...Object.values(bindings));
  return exports;
}

const curseData = load('src/games/rogue0/curseData.ts');
const { curseEligible, maybeCurse, rollCurseId } = load('src/games/rogue0/curses.ts', {
  CURSE_GENERATION_CHANCE: curseData.CURSE_GENERATION_CHANCE,
  CURSE_TABLES: curseData.CURSE_TABLES,
});
const entityExports = load('src/games/rogue0/entity.ts', {
  ...curseData,
  actionCost: () => 1,
  sfx: { death() {} },
});
const { Entity, removeEntity } = entityExports;
Entity.prototype.init = function (context, x, y) { this.context = context; this.x = x; this.y = y; };

const item = (slot, extra = {}) => Object.assign(new Entity(), {
  type: 'item', equipSlot: slot, cursed: false, curseId: '', identified: true, ...extra,
});

// --- Generation: weapon/armor/ring eligible; every slot has a curse table.
assert.equal(curseEligible(item('weapon')), true);
assert.equal(curseEligible(item('armor')), true);
assert.equal(curseEligible(item('ring')), true);
assert.equal(curseEligible(item('artifact')), false);
assert.equal(curseEligible(item('consumable')), false);
assert.equal(maybeCurse(item('armor'), 0.25, () => 0.9), false);
assert.equal(rollCurseId(item('weapon'), () => 0), 'wayward');
assert.equal(rollCurseId(item('ring'), () => 0), 'inverted');
assert.equal(maybeCurse(item('weapon'), 1, () => 0), true);
assert.equal(maybeCurse(item('ring'), 1, () => 0), true);
const cursedArmor = item('armor');
assert.equal(maybeCurse(cursedArmor, 0.25, () => 0), true);
assert.ok(curseData.CURSE_TABLES.armor.includes(cursedArmor.curseId));
assert.equal(maybeCurse(item('armor', { cursed: true, curseId: 'multiplicity' }), 0.25, () => 0), false);

// --- Descriptions: named curses reveal only once identified.
const displacement = item('armor', { cursed: true, curseId: 'displacement' });
assert.match(displacement.displayDescription, /Displacement: When you are attacked/);
assert.match(displacement.displayDescription, /cannot be removed while equipped/);
const secret = item('armor', { cursed: true, curseId: 'multiplicity', identified: false });
assert.equal(secret.curseDescription, '');
assert.doesNotMatch(secret.displayDescription, /Multiplicity/);
secret.identified = true;
assert.match(secret.displayDescription, /Multiplicity: When you are attacked/);
const waywardDesc = item('weapon', { cursed: true, curseId: 'wayward' });
assert.match(waywardDesc.displayDescription, /Wayward: This weapon is wildly inaccurate/);

// --- Mirror image decoy: friendly, inert, ephemeral, no rewards.
const MirrorImage = load('src/games/rogue0/monsters/mirrorImage.ts', { Entity, removeEntity }).default;
const heroLike = Object.assign(new Entity(), { tile: 26, textureKey: 'hero-color', tint: 0xffeecc });
const imgCtx = { entities: [], messages: [], visibleTiles: new Set() };
const image = new MirrorImage(imgCtx, 2, 3, heroLike);
assert.equal(image.type, 'enemy');
assert.equal(image.isDecoy, true);
assert.equal(image.healthPoints, 1);
assert.equal(image.textureKey, 'hero-color');
image.turn();
assert.equal(image.nextActionTime, 1);
const before = image.nextActionTime;
for (let i = 0; i < 9 && imgCtx.entities.includes(image); i++) image.refresh();
assert.ok(!imgCtx.entities.includes(image), 'mirror images fade on their own');

// --- Passive curses: Wayward (accuracy), Bulk (movement), Metabolism (hunger).
const Hero = load('src/games/rogue0/classes/basicHero.ts', {
  Entity, dungeon: { log() {} }, isModalOpen: () => false, hasEffect: () => false,
  removeEffect() {}, isGrassConcealed: () => false, getTrapState: () => undefined,
  sfx: { equip() {}, levelUp() {}, potion() {} }, spawnEntityFloatingText() {},
  applyEffect() {}, createBurningEffect: () => ({}), createFrozenEffect: () => ({}),
  createPoisonedEffect: () => ({}), resolveAttack: () => ({ hit: false, damage: 0 }),
  hasLineOfSight: () => true, Gem: class {}, Wand: class {},
}).default;
function makeHero(over = {}) {
  return Object.assign(Object.create(Hero.prototype), {
    accuracy: 100, strength: 10, weapon: undefined, armor: undefined,
    hunger: 10, healthPoints: 30, maxHealthPoints: 30, effects: [],
    hungerWarned: true, regenerationTicks: 0, ...over,
  });
}
assert.equal(makeHero({ weapon: { cursed: true, curseId: 'wayward', requiredStrength: 0 } }).effectiveAccuracy, 50, 'Wayward halves accuracy');
assert.equal(makeHero({ armor: { cursed: true, curseId: 'bulk', requiredStrength: 0 } }).movementCostMultiplier(), 2, 'Bulk doubles movement cost');
assert.equal(makeHero({ armor: { cursed: true, curseId: 'metabolism', requiredStrength: 0 } }).effectiveAccuracy, 100, 'other armor curses leave accuracy intact');
const metab = makeHero({ armor: { cursed: true, curseId: 'metabolism', requiredStrength: 0 } });
metab.refresh();
assert.equal(metab.hunger, 9.5, 'Metabolism doubles hunger drain');
const normal = makeHero({});
normal.refresh();
assert.equal(normal.hunger, 9.75, 'normal hunger drain unchanged');

// --- Polarized weapon damage scales ×0.5–×1.5 on actual hits.
const PhaserMax = { Math: { Between: (_min, max) => max } };
const { TieredWeapon } = load('src/games/rogue0/items/tieredEquipment.ts', { Entity, Phaser: PhaserMax });
const cleanWep = new TieredWeapon({ messages: [] }, undefined, undefined, 1);
assert.equal(cleanWep.damage(), 5, 'clean weapon uses its normal max');
const polWep = new TieredWeapon({ messages: [] }, undefined, undefined, 1);
polWep.cursed = true;
polWep.curseId = 'polarized';
assert.equal(polWep.damage(), 8, 'polarized max roll scales ×1.5 (5 → 8)');

// --- Cursed rings invert their passive; uncursing re-applies the positive form.
const Ring = load('src/games/rogue0/items/ring.ts', { Entity, identify: (e) => { e.identified = true; } }).default;
const RingOfMight = load('src/games/rogue0/items/RingOfMight.ts', { Ring }).default;
const RingOfHaste = load('src/games/rogue0/items/RingOfHaste.ts', { Ring }).default;
const RingOfElements = load('src/games/rogue0/items/RingOfElements.ts', { Ring }).default;
const RingOfAccuracy = load('src/games/rogue0/items/RingOfAccuracy.ts', { Ring }).default;
const ringCtx = () => ({ messages: [], player: {
  movementSpeed: 1, accuracy: 95, evasion: 0, resistance: {}, vulnerability: {}, effects: [] } });
{
  const might = new RingOfMight(ringCtx());
  assert.equal(might.damage(), 2);
  might.cursed = true; might.curseId = 'inverted';
  assert.equal(might.damage(), -2);
  assert.match(might.baseDescription, /Reduces damage by 2/);
}
{
  const ctx = ringCtx();
  const haste = new RingOfHaste(ctx);
  haste.cursed = true; haste.curseId = 'inverted';
  haste.equip();
  assert.equal(ctx.player.movementSpeed, 0.5, 'cursed Haste slows movement');
  haste.cursed = false;
  haste.onUncursed();
  assert.equal(ctx.player.movementSpeed, 2, 'uncursing re-applies the positive haste');
}
{
  const ctx = ringCtx();
  const elems = new RingOfElements(ctx);
  elems.cursed = true; elems.curseId = 'inverted';
  elems.equip();
  assert.equal(ctx.player.vulnerability.fire, 2);
  assert.equal(ctx.player.vulnerability.shock, 2);
  assert.equal(ctx.player.resistance.fire, undefined);
  elems.cursed = false;
  elems.onUncursed();
  assert.equal(ctx.player.vulnerability.fire, 0);
  assert.equal(ctx.player.resistance.fire, 2);
}
{
  const ctx = ringCtx();
  const acc = new RingOfAccuracy(ctx);
  acc.cursed = true; acc.curseId = 'inverted';
  acc.equip();
  assert.equal(ctx.player.accuracy, 90, 'cursed Accuracy reduces accuracy');
  acc.unequip();
  assert.equal(ctx.player.accuracy, 95);
}

// --- Proc helpers: real dungeon.ts with effect/tiles stubs.
const grass = new Map();
const tiles = {
  isBlocking: () => false,
  getFeature: (x, y) => grass.get(`${x},${y}`),
  setFeature: (x, y, f) => { grass.set(`${x},${y}`, f); },
  getDoorState: () => undefined,
  getTileState: () => undefined,
  forEachFeature() {},
};
const effects = {
  applyEffect: (e, eff) => { (e.effects ??= []).push(eff); },
  hasEffect: () => false,
  removeEffect() {},
  createBurningEffect: () => ({ id: 'burning' }),
  createFrozenEffect: () => ({ id: 'frozen' }),
  createCrippledEffect: () => ({ id: 'crippled' }),
  createConfusedEffect: () => ({ id: 'confused' }),
  createPoisonedEffect: () => ({ id: 'poisoned' }),
  createCharmedEffect: () => ({ id: 'charmed' }),
};
const dungeon = load('src/games/rogue0/dungeon.ts', {
  PF: { Grid: class {}, DiagonalMovement: { Always: 0 }, AStarFinder: class {} },
  bresenhamLine: () => [],
  ...effects,
  tiles,
  MirrorImage,
  CURSE_PROC_CHANCE: curseData.CURSE_PROC_CHANCE,
  removeEntity,
  spawnEntityFloatingText: () => {},
}).default;

function procContext(player) {
  dungeon.currentLevel = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  return {
    entities: [], messages: [], player,
    map: { tileToWorldX: x => x * 16, tileToWorldY: y => y * 16 },
    visibleTiles: new Set(),
  };
}
function actor(over = {}) {
  return Object.assign(new Entity(), { type: 'player', x: 1, y: 1, healthPoints: 20, effects: [], ...over });
}
const originalRandom = Math.random;

// Armor procs: anti-entropy, corrosion, stench, overgrowth.
{
  const victim = actor({ armor: item('armor', { cursed: true, curseId: 'anti-entropy' }) });
  const enemy = actor({ type: 'enemy', x: 2, y: 1 });
  const ctx = procContext(victim); ctx.entities.push(enemy);
  Math.random = () => 0;
  dungeon.procArmorCurse(ctx, victim);
  assert.ok(victim.effects.some(e => e.id === 'burning'), 'anti-entropy ignites the wearer');
  assert.ok(enemy.effects.some(e => e.id === 'frozen'), 'anti-entropy freezes adjacent enemies');
}
{
  const victim = actor({ armor: item('armor', { cursed: true, curseId: 'corrosion' }) });
  Math.random = () => 0;
  dungeon.procArmorCurse(procContext(victim), victim);
  assert.ok(victim.effects.some(e => e.id === 'poisoned'), 'corrosion poisons the wearer');
}
{
  const victim = actor({ armor: item('armor', { cursed: true, curseId: 'stench' }) });
  let gas = 0;
  const ctx = procContext(victim); ctx.onCreatePoisonGas = () => ++gas;
  Math.random = () => 0;
  dungeon.procArmorCurse(ctx, victim);
  assert.equal(gas, 1, 'stench releases a gas cloud');
}
{
  const victim = actor({ armor: item('armor', { cursed: true, curseId: 'overgrowth' }) });
  grass.clear();
  Math.random = () => 0;
  dungeon.procArmorCurse(procContext(victim), victim);
  assert.ok([...grass.values()].some(f => f === 'grass'), 'overgrowth sprouts grass');
}

// Weapon procs: sacrificial, displacing, annoying, friendly, exhausting.
{
  const victim = actor({ type: 'enemy', x: 2, y: 1, healthPoints: 10 });
  const hero = actor({ weapon: item('weapon', { cursed: true, curseId: 'sacrificial' }), walkPath: [1] });
  const ctx = procContext(hero); ctx.entities.push(victim);
  dungeon.procWeaponCurse(ctx, hero, victim, 8);
  assert.equal(hero.healthPoints, 18, 'sacrificial drains 25% of dealt damage (ceil 2)');
}
{
  const victim = actor({ type: 'enemy', x: 2, y: 1 });
  const hero = actor({ weapon: item('weapon', { cursed: true, curseId: 'displacing' }) });
  Math.random = () => 0;
  dungeon.procWeaponCurse(procContext(hero), hero, victim, 5);
  assert.notDeepEqual([victim.x, victim.y], [2, 1], 'displacing teleports the victim');
}
{
  const far = actor({ type: 'enemy', x: 4, y: 1 });
  const near = actor({ type: 'enemy', x: 2, y: 1 });
  const hero = actor({ weapon: item('weapon', { cursed: true, curseId: 'annoying' }) });
  const ctx = procContext(hero); ctx.entities.push(far, near);
  Math.random = () => 0;
  dungeon.procWeaponCurse(ctx, hero, near, 5);
  assert.equal(far.lastSeenX, 1, 'annoying wakes enemies within 8 tiles');
  assert.equal(near.lastSeenY, 1);
}
{
  const victim = actor({ type: 'enemy', x: 2, y: 1 });
  const hero = actor({ weapon: item('weapon', { cursed: true, curseId: 'friendly' }) });
  Math.random = () => 0;
  dungeon.procWeaponCurse(procContext(hero), hero, victim, 5);
  assert.ok(victim.effects.some(e => e.id === 'charmed'), 'friendly charms the victim');
}
{
  const victim = actor({ type: 'enemy', x: 2, y: 1 });
  const hero = actor({ weapon: item('weapon', { cursed: true, curseId: 'exhausting' }) });
  Math.random = () => 0;
  dungeon.procWeaponCurse(procContext(hero), hero, victim, 5);
  assert.ok(hero.effects.some(e => e.id === 'crippled'), 'exhausting cripples the hero');
}

Math.random = originalRandom;

// --- Save/load preserves curseId and isDecoy through the object graph codec.
const { encodeGraph, decodeGraph } = load('src/games/rogue0/saveCodec.ts');
const roundTrip = decodeGraph(
  JSON.parse(JSON.stringify(encodeGraph({ armor: displacement, img: image }, { Entity, MirrorImage }))),
  { Entity, MirrorImage }
);
assert.equal(roundTrip.armor.curseId, 'displacement');
assert.equal(roundTrip.armor.cursed, true);
assert.equal(roundTrip.img.isDecoy, true);
assert.equal(roundTrip.img.name, 'Mirror Image');

console.log('Rogue0 cursed items: generation, named descriptions, secrecy, decoy, passive curses, weapon/armor/ring procs, and save round-trip passed');
