import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('save');
import assert from 'node:assert/strict';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
import { encodeGraph, decodeGraph } from '../src/games/rogue0/saveCodec.ts';
import { isShopFloor, planShopStock } from '../src/games/rogue0/store/shopStock.ts';
import { createShopState } from '../src/games/rogue0/store/shopModel.ts';
const { Entity, identify, removeEntity, saveConsumableKnowledge, restoreConsumableKnowledge } = load('src/games/rogue0/entity.ts');
Entity.prototype.init = function(context, x, y) { Object.assign(this, { context, x, y }); };
const { TieredWeapon, TieredArmor, WEAPON_TEXTURES } = load('src/games/rogue0/items/tieredEquipment.ts', {
  Entity, Phaser: { Math: { Between: (_min, max) => max } },
});
const effects = load('src/games/rogue0/effects.ts', { spawnEntityFloatingText() {}, dungeon: {} });
const ChaliceOfBlood = load('src/games/rogue0/items/ChaliceOfBlood.ts', { Entity }).default;
const { restoreEffects } = load('src/games/rogue0/saveEffects.ts', { effects, ChaliceOfBlood });
const registry = { weapon: TieredWeapon, armor: TieredArmor };
const context = { messages: [], visibleTiles: new Set(), simulationTime: 4.5 };
const weapon = new TieredWeapon(context, undefined, undefined, 5);
weapon.level = 3;
weapon.effects = [effects.createBlindedEffect(2), effects.createCursedEffect()];
weapon.effects[0].apply(weapon, context);
weapon.effects[0].nextTick = 5.5;
weapon.sprite = { circular: context };
context.entities = [weapon];
const armor = new TieredArmor(context, 5, 7, 4);
const sparseSeen = []; sparseSeen[4] = [true, false, true];
const state = { weapon, backpack: [weapon, armor], quickslots: [weapon, undefined],
  floors: new Map([[1, { entities: [armor], seen: sparseSeen }]]),
  visited: new Set([1, 2]), loot: [false, TieredWeapon], time: 4.5, nextTick: 5,
};
const encoded = JSON.parse(JSON.stringify(encodeGraph(state, registry)));
const restored = decodeGraph(encoded, registry, entity => {
  entity.context = context;
  entity.effects = restoreEffects(entity.effects);
});
assert.ok(restored.weapon instanceof TieredWeapon);
assert.equal(restored.weapon.damage(), 43);
assert.equal(restored.backpack[1].protection(), 8);
assert.equal(restored.weapon, restored.quickslots[0]);
assert.equal(restored.weapon, restored.backpack[0]);
assert.equal(restored.backpack[1], restored.floors.get(1).entities[0]);
assert.equal(restored.quickslots[1], undefined);
assert.equal(restored.weapon.maxLevel, Infinity);
assert.equal(restored.loot[1], TieredWeapon, 'monster loot constructors remain callable');
assert.deepEqual([...restored.visited], [1, 2]);
assert.equal(restored.weapon.sprite, undefined, 'Phaser objects never enter saves');
assert.equal(restored.time, 4.5);
assert.equal(restored.weapon.effects[0].nextTick, 5.5);
assert.equal(restored.weapon.accuracy, 70, 'restoration does not apply blindness twice');
restored.weapon.effects[0].remove(restored.weapon, context);
assert.equal(restored.weapon.accuracy, 95, 'blindness retains its original accuracy after reload');
assert.equal(restored.weapon.effects[1].duration, Infinity);
restored.weapon.healthPoints = 10;
restored.weapon.effects[1].tick(restored.weapon, context);
assert.equal(restored.weapon.healthPoints, 9, 'restored cursed effect retains its ticking behavior');
assert.deepEqual(restored.floors.get(1).seen[4], [true, false, true]);
// A sparse fog row becomes explicit undefined after JSON: snapshotting it again
// must not throw (browser resume regression).
assert.doesNotThrow(() => restored.floors.get(1).seen.map(row => [...(row ?? [])]));
const chalice = new ChaliceOfBlood(context);
chalice.level = 5;
chalice.healingTurns = 5;
chalice.bloodProgress = 7;
const artifactSave = encodeGraph({ artifact: chalice, effects: [chalice.regenEffect()] }, { chalice: ChaliceOfBlood });
const artifactRun = decodeGraph(JSON.parse(JSON.stringify(artifactSave)), { chalice: ChaliceOfBlood });
const artifactEffects = restoreEffects(artifactRun.effects, artifactRun.artifact);
const wounded = { healthPoints: 5, maxHealthPoints: 10 };
artifactEffects[0].tick(wounded);
assert.equal(wounded.healthPoints, 6, 'artifact resumes healing counter and callback against restored instance');
assert.equal(artifactRun.artifact.healingTurns, 0);
assert.equal(artifactRun.artifact.bloodProgress, 7);
assert.equal(chalice.healingTurns, 5, 'restored callback never touches original artifact');
const knowledge = { appearances: [['potion:Healing', 'potion-3']], known: ['potion:Healing'] };
restoreConsumableKnowledge(context, knowledge);
assert.deepEqual(saveConsumableKnowledge(context), knowledge);
assert.throws(() => decodeGraph({ root: { ref: 99 }, nodes: [] }, registry));
assert.throws(() => decodeGraph({ root: { ref: 0 }, nodes: [{ kind: 'entity', type: 'missing', data: [] }] }, registry));
assert.throws(() => decodeGraph({ root: { ref: 0 }, nodes: [{ kind: 'object', data: [['__proto__', {}]] }] }, registry));
assert.throws(() => restoreEffects([{ id: 'unknown', duration: 1 }]));

// Upgrade scrolls already in a browser save must acquire the new picker flags.
{
  class SavedHero extends Entity {
    getAllItems() { return this.backpack; }
    resetTransientState() { this.inputBuffer = []; this.walkPath = []; }
  }
  const ScrollOfUpgrade = load('src/games/rogue0/items/ScrollOfUpgrade.ts', { Entity, Wand: class {} }).default;
  const ScrollOfRemoveCurse = load('src/games/rogue0/items/ScrollOfRemoveCurse.ts', { Entity, identify, removeEntity }).default;
  const savedContext = { messages: [] };
  const hero = new SavedHero();
  Object.assign(hero, { type: 'player', healthPoints: 30, x: 0, y: 0 });
  const scroll = new ScrollOfUpgrade(savedContext);
  Object.assign(scroll, { requiresItemTarget: false, itemTargetTitle: 'CLEANSE: CHOOSE ITEM',
    description: 'Upgrades your equipped weapon.', count: 3, locallyIdentified: true });
  const legacyWeapons = [1, 2, 3, 4, 5].map(tier => {
    const item = new TieredWeapon(savedContext, undefined, undefined, tier);
    delete item.textureKey; // Saved before the dedicated weapon art existed.
    item.level = 2;
    return item;
  });
  const CursedGem = load('src/games/rogue0/items/cursedGem.ts', { Entity }).default;
  const legacyCursedGem = new CursedGem(savedContext);
  delete legacyCursedGem.textureKey;
  legacyCursedGem.tile = 218;
  legacyCursedGem.count = 3;
  hero.backpack = [scroll, ...legacyWeapons, legacyCursedGem];
  hero.quickslots = [legacyCursedGem];
  hero.weapon = legacyWeapons[4];
  Object.assign(hero.weapon, { cursed: true, curseId: 'friendly' });
  Object.assign(legacyWeapons[0], { cursed: true, curseId: 'friendly' });
  Object.assign(legacyWeapons[1], { cursed: true, curseId: 'wayward' });
  class IceElemental { constructor() { Object.assign(this, { type: 'enemy', tile: 6 * 49 + 9 }); } }
  // Use the real class prototypes, but never constructors: these represent
  // actors already wounded/asleep in an older checkpoint.
  const Ghoul = load('src/games/rogue0/monsters/ghoul.ts', { Monster: Entity }).default;
  const Brute = load('src/games/rogue0/monsters/brute.ts', { Monster: Entity }).default;
  const Quloptsh = load('src/games/rogue0/monsters/quloptsh.ts', { Monster: Entity }).default;
  const Skeleton = load('src/games/rogue0/monsters/skelaton.ts', { Monster: Entity }).default;
  // Real single-tier gear prototypes: art moved from atlas frames to generated
  // silhouettes, so legacy saves must be re-pointed.
  const Shield = load('src/games/rogue0/items/shield.ts', { Entity }).default;
  const Sword = load('src/games/rogue0/items/sword.ts', { Entity }).default;
  const Axe = load('src/games/rogue0/items/axe.ts', { Entity }).default;
  const oldGear = [Shield, Sword, Axe].map(Class => Object.assign(Object.create(Class.prototype), {
    type: 'item', tile: [776, 328, 382][[Shield, Sword, Axe].indexOf(Class)], identified: true,
  }));
  Object.assign(oldGear[1], { cursed: true, curseId: 'friendly' });
  const oldMonsters = [Ghoul, Brute, Quloptsh, Skeleton].map((Class, i) => Object.assign(Object.create(Class.prototype), {
    type: 'enemy', tile: [320, 322, 324, 323][i], healthPoints: 7, sleepTurnsRemaining: 11,
    x: 0, y: 0, effects: [], loot: [false], nextActionTime: 4.5,
  }));
  const legacyIce = new IceElemental();
  Object.assign(legacyIce, { x: 0, y: 0, healthPoints: 16 });
  // Saved while Remove Curse cleansed the whole pack: no target fields.
  const legacyRemoveCurse = new ScrollOfRemoveCurse(savedContext);
  Object.assign(legacyRemoveCurse, { requiresItemTarget: false,
    itemTargetTitle: 'CLEANSE: CHOOSE ITEM',
    noItemTargetsMessage: 'You have no cursed items to cleanse.',
    description: 'Lifts every curse on your equipment.', locallyIdentified: false });
  const registry = { hero: SavedHero, scroll: ScrollOfUpgrade, removeScroll: ScrollOfRemoveCurse,
    IceElemental, TieredWeapon, Ghoul, Brute, Quloptsh, CursedGem, Skeleton, Shield, Sword, Axe };
  const mapgen = load('src/games/rogue0/mapgen.ts', { isBlocking: () => false });
  const graph = encodeGraph({ player: hero, floor: 1, time: 0, nextTick: 1, messages: [],
    bossesSlain: new Set([5, 10]),
    knowledge: { appearances: [], known: [] }, floors: new Map([[1, {
      map: [[0]], seen: [[true]], features: [], entities: [legacyIce, legacyRemoveCurse, ...oldMonsters, ...oldGear], savedAt: 0,
      up: { x: 0, y: 0 }, down: { x: 0, y: 0 },
    }]]) }, registry);
  const { decodeRunSave, restoreRunState } = load('src/games/rogue0/runPersistence.ts', {
    decodeGraph, saveRegistry: registry, restoreEffects, ScrollOfUpgrade, ScrollOfRemoveCurse,
    isShopFloor, restoreConsumableKnowledge, rememberIdentifiedWandTypes() {},
    Ring: class {}, Wand: class {},
    TieredWeapon, WEAPON_TEXTURES,
    BasicHero: SavedHero, classes: { Warrior: SavedHero },
    Mimic: class {}, SwarmOfFlies: class {}, Chest: class {},
    CHEST_TEXTURE: 'chest-closed',
    IceElemental, Ghoul, Brute, Quloptsh, CursedGem, Skeleton,
    Shield, Sword, Axe, LongSword: class {}, Hammer: class {}, Shoe: class {},
    ICE_ELEMENTAL_TEXTURE: 'monster-ice-elemental',
    // The run decoder validates the saved chasm floor against the generator's
    // own candidate list, so it uses the real helpers.
    isChasmRoomFloor: mapgen.isChasmRoomFloor,
    pickChasmRoomFloor: mapgen.pickChasmRoomFloor,
  });
  const save = { version: 1, heroClass: 'Warrior', floor: 1, graph };
  const run = decodeRunSave(save, {});
  assert.deepEqual([...run.bossesSlain], [5, 10], 'slain boss floors survive the save graph');
  for (const item of run.player.backpack.filter(item => item instanceof TieredWeapon)) {
    assert.equal(item.textureKey, WEAPON_TEXTURES[item.tier - 1], 'legacy weapons acquire tier art');
    assert.equal(item.spriteFrame, 0, 'every tier now has generated art');
    assert.equal(item.level, 2, 'art migration preserves upgrades');
  }
  assert.equal(run.player.weapon, run.player.backpack[5], 'equipped weapon keeps the shared item reference');
  for (const item of [run.player.weapon, run.player.backpack[1],
    run.floors.get(1).entities.find(entity => entity instanceof Sword)]) {
    assert.equal(item.cursed, false, 'retired Friendly curse is cleansed on equipped, carried and floor gear');
    assert.equal(item.curseId, '', 'retired curse ID is cleared');
  }
  assert.equal(run.player.backpack[2].cursed, true, 'other curses remain intact');
  assert.equal(run.player.backpack[2].curseId, 'wayward');
  const savedCursedGem = run.player.backpack[6];
  assert.ok(savedCursedGem instanceof CursedGem);
  assert.equal(savedCursedGem.spriteTextureKey, 'cursed-gem');
  assert.equal(savedCursedGem.spriteFrame, 0);
  assert.equal(savedCursedGem.spriteFrame, 0, 'a stale saved tile no longer selects atlas art');
  assert.equal(savedCursedGem.count, 3, 'art migration preserves the stack');
  assert.equal(run.player.quickslots[0], savedCursedGem, 'quickslot retains migrated item identity');
  const restored = run.player.backpack[0];
  assert.deepEqual(run.player.inputBuffer, []);
  assert.throws(() => decodeRunSave({ ...save, heroClass: 'unknown' }, {}), /Invalid saved run/);
  assert.throws(() => decodeRunSave({ ...save, version: 999 }, {}), /Invalid saved run/);
  // The run's one chasm floor survives a reload, and only a floor the generator
  // would have rolled itself is accepted.
  assert.equal(run.chasmRoomFloor, undefined, 'saves that predate the roll simply omit it');
  for (const chasmRoomFloor of mapgen.CHASM_ROOM_FLOORS) {
    const roundTrip = encodeGraph({ player: hero, floor: 1, time: 0, nextTick: 1,
      messages: [], bossesSlain: new Set(), chasmRoomFloor,
      knowledge: { appearances: [], known: [] }, floors: new Map([[1, {
        map: [[0]], seen: [[true]], features: [], entities: [], savedAt: 0,
        up: { x: 0, y: 0 }, down: { x: 0, y: 0 },
      }]]) }, registry);
    const decoded = decodeRunSave({ ...save, graph: JSON.parse(JSON.stringify(roundTrip)) }, {});
    assert.equal(decoded.chasmRoomFloor, chasmRoomFloor, `floor ${chasmRoomFloor} survives the save graph`);
  }
  for (const bad of [5, 8, 0, 25]) {
    const corrupt = encodeGraph({ player: hero, floor: 1, time: 0, nextTick: 1,
      messages: [], bossesSlain: new Set(), chasmRoomFloor: bad,
      knowledge: { appearances: [], known: [] }, floors: new Map([[1, {
        map: [[0]], seen: [[true]], features: [], entities: [], savedAt: 0,
        up: { x: 0, y: 0 }, down: { x: 0, y: 0 },
      }]]) }, registry);
    assert.throws(() => decodeRunSave({ ...save, graph: JSON.parse(JSON.stringify(corrupt)) }, {}),
      /Invalid saved run/, `floor ${bad} cannot own the run's chasm room`);
  }
  // Store migration and all four independent inventories use the real run
  // decoder, not just the generic graph codec. Saves may be on floor 11 with
  // only the legacy floor-6 stock, or with no stores generated at all.
  const shops = new Map([6, 11, 16, 21].map(floor => [floor,
    createShopState(planShopStock(floor, () => 0), spec => {
      const item = new TieredWeapon(savedContext, undefined, undefined, spec.tier);
      return item;
    }, floor),
  ]));
  const bought = shops.get(6).stock[0].item;
  shops.get(6).stock[0].item = undefined;
  shops.get(6).stock[0].sold = true;
  const buildStoreSave = extra => {
    const base = decodeGraph(graph, registry);
    base.player.backpack.push(bought);
    return { ...save, floor: 11, graph: JSON.parse(JSON.stringify(encodeGraph({
      ...base, floor: 11, floors: new Map([[11, base.floors.get(1)]]), ...extra,
    }, registry))) };
  };
  const storeContext = {};
  const storeRun = decodeRunSave(buildStoreSave({ shops }), storeContext);
  restoreRunState(storeContext, storeRun);
  assert.equal(storeContext.shops.size, 4);
  assert.equal(storeContext.shop, storeContext.shops.get(11), 'resume selects the current floor store');
  for (const [floor, shop] of storeContext.shops) {
    assert.equal(shop.floor, floor);
    assert.equal(shop.stock.length, 15);
    assert.ok(shop.stock[11].item instanceof TieredWeapon);
    assert.equal(shop.stock[11].item.context, storeContext, 'inactive stock is rehydrated too');
    assert.equal(shop.stock[11].item.tier, Math.floor(floor / 5) + 1);
    assert.equal(shop.stock[11].price, shops.get(floor).stock[11].price);
  }
  assert.equal(storeContext.shops.get(6).stock[0].sold, true);
  assert.equal(storeContext.shops.get(6).stock[0].item, undefined);
  assert.equal(storeContext.shops.get(11).stock[0].sold, false);
  assert.ok(storeContext.player.backpack.at(-1) instanceof TieredWeapon, 'bought stock remains carried');
  const legacyRun = decodeRunSave(buildStoreSave({ shop: shops.get(6) }), {});
  assert.equal(legacyRun.shops.size, 1);
  assert.equal(legacyRun.shops.get(6).stock[0].sold, true, 'migration never replenishes floor 6');
  assert.equal(legacyRun.shop, undefined, 'legacy root is replaced by the map');
  restoreRunState(storeContext, legacyRun);
  assert.equal(storeContext.shop, undefined, 'floor 11 must not reuse the old floor-6 store');
  assert.equal(decodeRunSave(buildStoreSave({}), {}).shops.size, 0, 'pre-store saves still load');
  for (const extra of [
    { shops: [] }, { shops: null },
    { shops: new Map([[7, { ...shops.get(6), floor: 7 }]]) },
    { shops: new Map([['6', shops.get(6)]]) },
    { shops: new Map([[11, shops.get(6)]]) },
    { shops: new Map([[11, null]]) },
    { shops: new Map([[11, { ...shops.get(11), stock: [] }]]) },
    { shops: new Map([[11, { ...shops.get(11), version: 2 }]]) },
    { shops: new Map([[11, { ...shops.get(11), stock: shops.get(11).stock.map((slot, i) =>
      i ? slot : { ...slot, sold: true }) }]]) },
    { shop: { ...shops.get(6), floor: 11 } },
  ]) {
    assert.throws(() => decodeRunSave(buildStoreSave(extra), {}), /Invalid saved store/);
  }
  assert.equal(restored.requiresItemTarget, true);
  assert.equal(restored.itemTargetTitle, 'UPGRADE: CHOOSE ITEM');
  assert.equal(restored.description, new ScrollOfUpgrade(savedContext).description,
    'legacy help text is migrated to the current item description');
  assert.equal(restored.count, 3);
  assert.equal(restored.identified, true);
  const savedRemoveCurse = run.floors.get(1).entities.find(item => item instanceof ScrollOfRemoveCurse);
  assert.ok(savedRemoveCurse, 'a legacy remove-curse scroll survives the save graph');
  assert.equal(savedRemoveCurse.requiresItemTarget, true,
    'legacy scrolls gain single-item targeting on load');
  assert.equal(savedRemoveCurse.itemTargetTitle, 'REMOVE CURSE: CHOOSE ITEM');
  assert.equal(savedRemoveCurse.description, new ScrollOfRemoveCurse(savedContext).description,
    'legacy scroll help text is migrated to the current description');
  assert.equal(savedRemoveCurse.identified, false, 'migration does not identify the scroll');
  const savedIce = run.floors.get(1).entities[0];
  assert.ok(savedIce instanceof IceElemental);
  assert.equal(savedIce.textureKey, 'monster-ice-elemental',
    'legacy ice elementals drop the chest atlas frame when rebuilt');
  const upgradedMonsters = run.floors.get(1).entities.slice(2, 6);
  for (const [i, monster] of upgradedMonsters.entries()) {
    assert.ok(monster instanceof [Ghoul, Brute, Quloptsh, Skeleton][i]);
    assert.equal(monster.spriteTextureKey, ['ghoul', 'brute', 'quloptsh', 'skeleton'][i]);
    assert.equal(monster.spriteFrame, 0);
    // The old frame number rides along in the save but no longer selects art.
    assert.equal(monster.tile, [320, 322, 324, 323][i], 'stale atlas frame is carried, not used');
    assert.equal(monster.healthPoints, 7, 'art migration does not heal');
    assert.equal(monster.sleepTurnsRemaining, 11, 'art migration does not reroll sleep');
    assert.equal(monster.nextActionTime, 4.5);
    assert.deepEqual(monster.loot, [false]);
  }
  const upgradedGear = run.floors.get(1).entities.slice(-3);
  for (const [i, item] of upgradedGear.entries()) {
    assert.ok(item instanceof [Shield, Sword, Axe][i]);
    assert.equal(item.spriteTextureKey, ['armor-shield', 'weapon-sword', 'weapon-axe'][i]);
    assert.equal(item.spriteFrame, 0);
    assert.equal(item.tile, [776, 328, 382][i], 'stale atlas frame is carried, not used');
    assert.equal(item.identified, true, 'art migration does not hide gear');
  }
  // Regular Gems are retired: old checkpoints must not require the deleted class.
  {
    const { retireGemsFromSave } = load('src/games/rogue0/saveRetiredGems.ts');
    const graph = { root: { ref: 0 }, nodes: [
      { kind: 'object', data: [['backpack', { ref: 1 }], ['quickslots', { ref: 2 }],
        ['loot', { ref: 3 }], ['shop', { ref: 4 }]] },
      { kind: 'array', data: [{ ref: 5 }, { ref: 6 }] },
      { kind: 'array', data: [{ ref: 5 }, { ref: 6 }] },
      { kind: 'array', data: [{ ref: 5 }, { constructorId: './items/gem.ts:default' }, false] },
      { kind: 'object', data: [['stock', { ref: 7 }]] },
      { kind: 'entity', type: './items/gem.ts:default', data: [['count', 2]] },
      { kind: 'entity', type: 'kept', data: [] },
      { kind: 'array', data: [{ ref: 8 }] },
      { kind: 'object', data: [['price', 10], ['sold', false], ['item', { ref: 5 }]] },
    ] };
    const original = JSON.stringify(graph);
    const cleaned = retireGemsFromSave(graph);
    assert.equal(JSON.stringify(graph), original, 'migration never mutates the stored checkpoint');
    const entry = (node, key) => node.data.find(([k]) => k === key)?.[1];
    assert.deepEqual(entry(cleaned.nodes[0], 'backpack'), { ref: 1 });
    assert.deepEqual(cleaned.nodes[1].data, [{ ref: 6 }], 'carried gems are dropped');
    assert.deepEqual(cleaned.nodes[2].data.map(value => value?.ref), [undefined, 6],
      'quickslot positions are kept; only the gem slot empties');
    assert.deepEqual(cleaned.nodes[3].data, [false, false, false],
      'loot weight slots survive as no-drop outcomes');
    assert.equal(entry(cleaned.nodes[8], 'sold'), true,
      'a shop slot that stocked a gem is not replenished');
    assert.deepEqual(entry(cleaned.nodes[8], 'item'), { special: 'undefined' });
    assert.equal(cleaned.nodes[5].kind, 'object');
    assert.deepEqual(cleaned.nodes[5].data, [], 'retired entities become inert, not spawnable');
    assert.equal(cleaned.nodes[6].type, 'kept', 'other entities are untouched');
    assert.ok(!JSON.stringify(cleaned).includes('items/gem.ts'), 'no retired class survives the rewrite');
  }
}
const memory = new Map();
let blocked = false;
const localStorage = {
  getItem(key) { if (blocked) throw Error('blocked'); return memory.get(key) ?? null; },
  setItem(key, value) { if (blocked) throw Error('quota'); memory.set(key, value); },
  removeItem(key) { if (blocked) throw Error('blocked'); memory.delete(key); },
};
const { SAVE_KEY, readRunSave, writeRunSave, clearRunSave } = load('src/games/rogue0/saveStorage.ts', { localStorage });
assert.deepEqual(readRunSave(), {});
const save = { version: 1, heroClass: 'Warrior', floor: 1, savedAt: new Date().toISOString(), graph: encoded };
assert.equal(writeRunSave(save), true);
assert.deepEqual(readRunSave().save, save);
blocked = true;
assert.equal(writeRunSave({ ...save, floor: 2 }), false);
assert.ok(readRunSave().error);
assert.equal(clearRunSave(), false);
blocked = false;
assert.equal(readRunSave().save.floor, 1, 'failed write retains last complete save');
memory.set(SAVE_KEY, '{broken'); assert.ok(readRunSave().error);
memory.set(SAVE_KEY, JSON.stringify({ ...save, version: 999 })); assert.ok(readRunSave().error);
assert.equal(clearRunSave(), true);
assert.deepEqual(readRunSave(), {});
console.log('Rogue0 save graph, prototypes, shared inventory, floor state, sparse fog, effects, knowledge, clocks and storage errors passed');
