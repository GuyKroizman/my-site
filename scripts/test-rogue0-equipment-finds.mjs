import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('equipment-finds');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';

const { Entity } = load('src/games/rogue0/entity.ts');
Entity.prototype.init = function(context, x, y) { Object.assign(this, { context, x, y }); };
const Phaser = { Math: { Between: min => min } };
const gear = load('src/games/rogue0/items/tieredEquipment.ts', { Entity, Phaser });
const progression = load('src/games/rogue0/progression.ts');
const upgrades = load('src/games/rogue0/foundUpgrades.ts', { Entity });
const curseData = load('src/games/rogue0/curseData.ts');
const curses = load('src/games/rogue0/curses.ts', curseData);
const finds = load('src/games/rogue0/equipmentFinds.ts', { ...gear, ...progression, ...upgrades, ...curses });
let passable = true;
const dungeon = {
  canStepBetween: () => passable,
  log: (ctx, text) => ctx.messages.push(text),
  entityAtTile: (ctx, x, y) => ctx.entities.find(e => e.x === x && e.y === y),
  isWalkableTile: () => false, canEnterChasm: () => false, openDoor() {},
  getCurrentLevel: () => Array.from({ length: 5 }, () => Array(5).fill(0)),
};
// Keep actual Wraith configuration; only the base actor's renderer is stubbed.
class Monster extends Entity {
  constructor(context, config, x, y) { super(); Object.assign(this, config); this.type = 'enemy'; this.init(context, x, y); }
}
const Wraith = load('src/games/rogue0/monsters/wraith.ts', { Monster, WRAITH_TEXTURE: 'monster-wraith' }).default;
const SkeletalRemains = load('src/games/rogue0/items/skeletalRemains.ts', { Entity, dungeon, Wraith, ...finds }).default;
const Hero = load('src/games/rogue0/classes/basicHero.ts', {
  Entity, dungeon, hasEffect: () => false, isModalOpen: () => false,
  getTrapState: () => undefined, isGrassConcealed: () => false,
}).default;
const originalRandom = Math.random;
function sequence(values) {
  Math.random = () => {
    assert.ok(values.length, 'no unexpected randomness');
    return values.shift();
  };
}
function setup({ armor = false, cursed = false } = {}) {
  // Kind, tier, upgrade, curse chance, (when cursed) curse ID, then glyph
  // chance. 0.99 on the glyph roll keeps the find plain so existing gear
  // assertions stay deterministic.
  sequence([armor ? 0.5 : 0, 0.5, 0.99, cursed ? 0 : 0.99, ...(cursed ? [0] : []), 0.99]);
  const context = { floor: 11, messages: [], entities: [], visibleTiles: new Set() };
  let turns = 0, ready = true;
  const player = Object.assign(Object.create(Hero.prototype), {
    context, x: 1, y: 1, nextActionTime: 42, hunger: 100, healthPoints: 30, backpack: [], capacity: 0,
    walkPath: [], inputBuffer: [], acknowledgedWalkEnemies: new Set(),
    canAct: () => ready,
    spendTurn(action) { assert.equal(action, 'use'); turns++; ready = false; },
    refreshUI() {}, nextStepToward: () => ({ x: 2, y: 1 }),
  });
  context.player = player;
  const remains = new SkeletalRemains(context, 2, 1);
  context.entities.push(remains);
  return { context, player, remains, turns: () => turns, ready: value => { ready = value; } };
}

try {
  assert.equal(finds.FLOOR_EQUIPMENT_CHANCE, 0.1);
  assert.equal(finds.NON_REMAINS_EQUIPMENT_SCALE, 1 / 3);
  assert.equal(finds.REMAINS_EQUIPMENT_CHANCE, undefined, 'bone piles no longer roll for emptiness');
  assert.equal(finds.CURSED_REMAINS_WRAITH_CHANCE, undefined, 'cursed loot always summons');
  for (let floor = 1; floor <= 25; floor++) {
    assert.equal(finds.rollFloorEquipment(floor, () => 0.099999), !progression.isBossFloor(floor));
    assert.equal(finds.rollFloorEquipment(floor, () => 0.1), false);
  }
  for (const armor of [false, true]) {
    for (const cursed of [false, true]) {
      const { context, player, remains, turns, ready } = setup({ armor, cursed });
      const item = remains.contents[0];
      assert.equal(remains.contents.length, 1, 'every bone pile holds loot');
      assert.ok(item instanceof gear[armor ? 'TieredArmor' : 'TieredWeapon']);
      assert.equal(item.tier, 3);
      assert.equal(item.level, 3);
      assert.equal(item.identified, false);
      assert.equal(item.cursed, cursed);
      assert.equal(item.glyph, '', 'a plain glyph roll leaves the find uninfused');
      assert.equal(item.curseDescription, '');
      assert.equal(item.x, undefined);
      assert.equal(player.addItem(remains), false, 'bone piles cannot be picked up');
      ready(false); assert.equal(remains.openContainer(), false); ready(true);
      player.x = 0; assert.equal(remains.openContainer(), false); player.x = 1;
      passable = false; assert.equal(remains.openContainer(), false); passable = true;
      player.walkPath = [{ x: 2, y: 1 }]; player.inputBuffer = ['ArrowRight'];
      assert.equal(remains.openContainer(), true, 'full backpack still allows searching');
      assert.equal(turns(), 1);
      assert.deepEqual([player.x, player.y], [1, 1]);
      assert.equal(player.walkPath.length, 0);
      assert.equal(player.inputBuffer.length, 0);
      assert.ok(!context.entities.includes(remains));
      const wraiths = context.entities.filter(e => e instanceof Wraith);
      assert.equal(wraiths.length, Number(cursed), 'cursed bone-pile gear always summons a Wraith');
      if (cursed) {
        const wraith = wraiths[0];
        assert.equal(context.entities[0], wraith, 'enemy takes priority over loot on the tile');
        assert.deepEqual([wraith.x, wraith.y], [2, 1]);
        assert.equal(wraith.sleepTurnsRemaining, 0);
        assert.equal(wraith.awareOfPlayer, true);
        assert.equal(wraith.nextActionTime, 42);
        assert.equal(wraith.damageType, 'magic');
      }
      assert.ok(context.entities.includes(item));
      assert.deepEqual([item.x, item.y], [2, 1]);
      assert.equal(item.identified, false, 'search does not identify the reward');
      // Physical gear intentionally shows its type/tier/upgrade before identification;
      // only curse knowledge is hidden in Rogue0's existing equipment model.
      if (cursed) assert.ok(context.messages.every(text => !text.includes(item.curseId)),
        'search logs do not reveal the named curse');
      ready(true); assert.equal(remains.openContainer(), false);
      assert.equal(turns(), 1, 'search cannot be repeated');
    }
  }
  for (const mode of ['keyboard', 'auto-walk']) {
    const { context, player, remains, turns } = setup();
    if (mode === 'keyboard') player.processInput('ArrowRight');
    else { player.walkPath = [{ x: 2, y: 1 }]; player.stepAutoWalk(); }
    assert.equal(turns(), 1, mode);
    assert.ok(!context.entities.includes(remains));
    assert.equal(player.backpack.length, 0, 'search leaves loot on the ground');
  }
  const { encodeGraph, decodeGraph } = load('src/games/rogue0/saveCodec.ts');
  const registry = { 'item:skeletal-remains': SkeletalRemains, ...gear, Wraith };
  // Registry contains constructors only, not exported texture constants.
  delete registry.ARMOR_TEXTURES;
  for (const options of [{}, { armor: true }, { cursed: true }]) {
    const { context, remains } = setup(options);
    const encoded = JSON.parse(JSON.stringify(encodeGraph([remains], registry)));
    Math.random = () => { throw Error('save/load/search must not reroll contents or haunting'); };
    const restored = decodeGraph(encoded, registry, entity => { entity.context = context; });
    context.entities = restored;
    assert.ok(restored[0] instanceof SkeletalRemains);
    assert.equal(restored[0].contents.length, 1, 'saved bone piles keep their loot');
    assert.equal(restored[0].openContainer(), true);
    assert.equal(context.entities.filter(e => e instanceof Wraith).length, options.cursed ? 1 : 0);
    const afterSearch = decodeGraph(JSON.parse(JSON.stringify(encodeGraph(context.entities, registry))), registry);
    assert.ok(afterSearch.every(e => !(e instanceof SkeletalRemains)), 'searched piles stay gone after reload');
  }
  assert.match(fs.readFileSync('src/games/rogue0/saveRegistry.ts', 'utf8'), /'item:skeletal-remains': SkeletalRemains/);
  const sceneSource = fs.readFileSync('src/games/rogue0/scene0.ts', 'utf8');
  assert.match(sceneSource, /generateRemainsTexture\(this\)/);
  assert.match(sceneSource, /11 \* NON_REMAINS_EQUIPMENT_SCALE/,
    'random weapon loot uses the one-third scale');
  assert.match(sceneSource, /4 \* NON_REMAINS_EQUIPMENT_SCALE/,
    'random armor loot uses the one-third scale');
  assert.match(fs.readFileSync('src/games/rogue0/items/chest.ts', 'utf8'), /Math\.random\(\) \* 18/,
    'chest gear rolls use eighteen reward slots');
} finally { Math.random = originalRandom; }
console.log('Rogue0 equipment finds: lowered non-remains gear odds, always-full bone piles, guaranteed cursed Wraith, turn costs, controls and persistence passed');
