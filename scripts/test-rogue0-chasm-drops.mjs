import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('chasm-drops');
import assert from 'node:assert/strict';
import { createGameContext } from '../src/games/rogue0/context.ts';
import { terrainFor } from '../src/games/rogue0/terrain.ts';
import { stashChasmFallen, placeChasmFallen } from '../src/games/rogue0/chasmDrops.ts';
import { createInventoryActions } from '../src/games/rogue0/inventory.ts';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';

// The run decoder validates its saved chasm floor with these.
const mapgen = load('src/games/rogue0/mapgen.ts', { isBlocking: () => false });

function item(name = 'Gem') {
  const sprite = { destroyed: false, destroy() { this.destroyed = true; } };
  return { type: 'item', name, displayName: name, count: 1, effects: [], sprite };
}
const openMap = (w = 4, h = 2) => Array.from({ length: h }, () => Array(w).fill(0));

// A chasm is a chute: the item leaves its current floor's sprite behind and is
// queued for the floor below, never destroyed.
{
  const ctx = createGameContext();
  ctx.floor = 3;
  const gem = item();
  assert.equal(stashChasmFallen(ctx, gem), true);
  assert.equal(gem.sprite, undefined, 'sprite is dropped with the floor');
  assert.equal(ctx.chasmFallenItems.get(4)[0], gem, 'queued for the floor below');
}

// The abyss under the final floor has no landing spot; nothing is queued.
{
  const ctx = createGameContext();
  ctx.floor = ctx.maxFloor;
  const gem = item();
  assert.equal(stashChasmFallen(ctx, gem), false);
  assert.equal(ctx.chasmFallenItems, undefined);
}

// Landing is random, walkable, never on a reserved tile, and spreads items out.
{
  const map = openMap();
  const ctx = createGameContext();
  ctx.floor = 3;
  ctx.currentLevel = map;
  const axe = item('Axe');
  const ration = item('Ration');
  stashChasmFallen(ctx, axe);
  stashChasmFallen(ctx, ration);
  ctx.floor = 4;
  const terrain = terrainFor(ctx);
  terrain.setFeature(0, 0, 'chasm');
  terrain.setFeature(3, 1, 'chasm');
  const reserved = new Set(['2,0', '1,1']);
  const placed = placeChasmFallen(ctx, map, reserved, 4);
  assert.deepEqual(placed, [axe, ration]);
  for (const placedItem of placed) {
    assert.ok(ctx.entities.includes(placedItem), 'landed item joins the floor');
    assert.notEqual(terrain.getFeature(placedItem.x, placedItem.y), 'chasm');
    assert.ok(!reserved.has(`${placedItem.x},${placedItem.y}`), 'stairs/reserved tiles stay clear');
  }
  assert.notEqual(`${axe.x},${axe.y}`, `${ration.x},${ration.y}`, 'two items do not stack');
  assert.equal(ctx.chasmFallenItems.has(4), false, 'queue drains once the floor is built');
  assert.deepEqual(placeChasmFallen(ctx, map, reserved, 4), [], 're-entering an empty queue is a no-op');
}

// A stuffed floor only falls back to shared walkable tiles, and a fixture map
// with no floor at all keeps the item queued instead of deleting it.
{
  const crowded = [[0, 1], [1, 1]];
  const ctx = createGameContext();
  ctx.floor = 2;
  const scroll = item('Scroll');
  stashChasmFallen(ctx, scroll);
  ctx.floor = 3;
  const placed = placeChasmFallen(ctx, crowded, new Set(['0,0']), 2);
  assert.deepEqual(placed, [scroll], 'an occupied but walkable tile still receives the item');
  assert.deepEqual([scroll.x, scroll.y], [0, 0]);

  const walled = [[1, 1], [1, 1]];
  const stuck = item('Hammer');
  const blocked = createGameContext();
  blocked.floor = 2;
  stashChasmFallen(blocked, stuck);
  blocked.floor = 3;
  assert.deepEqual(placeChasmFallen(blocked, walled, new Set(), 2), []);
  assert.equal(blocked.chasmFallenItems.get(3)[0], stuck, 'nowhere to land means still falling');
}

// Dropping a carried item while levitating over a chasm sends it down instead
// of leaving it hovering on the void tile.
{
  const placedOnFloor = [];
  const inventory = createInventoryActions({
    log: (context, message) => context.messages.unshift(message),
    equipSound() {},
    removeEntity() {},
    removeEffect() {},
    clearFloorSprite() {},
    clearItemUI() {},
    placeFloorItem: placedItem => placedOnFloor.push(placedItem),
  });
  const owner = {
    context: createGameContext(), x: 1, y: 1, backpack: [], capacity: 2, gold: 0,
    actions: [], canAct: () => true, spendTurn(action) { this.actions.push(action); },
  };
  owner.context.player = owner;
  owner.context.floor = 2;
  owner.context.entities = [owner];
  terrainFor(owner.context).setFeature(1, 1, 'chasm');

  const potion = item('Potion');
  potion.equipSlot = 'consumable';
  owner.backpack.push(potion);
  inventory.dropItem(owner, potion);
  assert.equal(owner.context.entities.includes(potion), false, 'no item rests over the chasm');
  assert.equal(owner.context.chasmFallenItems.get(3)[0], potion);
  assert.deepEqual(owner.actions, ['drop'], 'dropping still costs the turn');
  assert.match(owner.context.messages[0], /drops into the chasm/);
  assert.deepEqual(placedOnFloor, [], 'the chasm item is not placed on this floor');

  // An ordinary drop is unchanged.
  owner.x = 3;
  const ration = item('Ration');
  ration.equipSlot = 'consumable';
  owner.backpack.push(ration);
  inventory.dropItem(owner, ration);
  assert.ok(owner.context.entities.includes(ration));
  assert.deepEqual(placedOnFloor, [ration]);
  assert.equal(owner.context.messages[0], 'You drop Ration.');
}

// Throwing into a chasm hands the projectile to the floor below.
{
  const ctx = createGameContext();
  ctx.floor = 2;
  const thrown = item('Axe');
  ctx.entities = [thrown];
  const Hero = load('src/games/rogue0/classes/basicHero.ts', {
    Entity: class { init() {} },
    dungeon: { log: (context, message) => context.messages.unshift(message), triggerArrowTrap() {} },
    removeEntity: (context, entity) => {
      context.entities = context.entities.filter(candidate => candidate !== entity);
    },
    terrainFor: () => ({ getFeature: (x, y) => (x === 3 && y === 3 ? 'chasm' : undefined) }),
  }).default;
  const hero = Object.create(Hero.prototype);
  hero.context = ctx;
  hero.resolveThrowLanding(thrown, 3, 3);
  assert.equal(ctx.entities.includes(thrown), false);
  assert.equal(ctx.chasmFallenItems.get(3)[0], thrown);
  assert.match(ctx.messages[0], /falls into the chasm and drops toward the floor below/);

  // On the final floor the same fall is permanent.
  const bottom = createGameContext();
  bottom.floor = bottom.maxFloor;
  const lost = item('Axe');
  bottom.entities = [lost];
  hero.context = bottom;
  hero.resolveThrowLanding(lost, 3, 3);
  assert.equal(bottom.chasmFallenItems, undefined);
  assert.match(bottom.messages[0], /falls into the chasm and is lost/);
}

// A monster killed by the fall drops its loot into the chasm, and that loot is
// delivered to the floor below.
{
  class FakeEntity {
    init(context, x, y) { Object.assign(this, { context, x, y }); }
  }
  class FakeLoot {
    constructor(context, x, y) {
      Object.assign(this, { context, x, y, type: 'item', name: 'Gem', displayName: 'Gem' });
    }
  }
  class FakeGold {
    constructor(context, x, y, amount) {
      Object.assign(this, { context, x, y, type: 'item', name: `${amount} gold` });
    }
  }
  const Monster = load('src/games/rogue0/monsters/monster.ts', {
    Entity: FakeEntity,
    enemyTurn() {},
    enemyCanSeePlayer: () => false,
    dungeon: { log: (context, message) => context.messages.unshift(message) },
    Gold: FakeGold,
    Phaser: { Math: { Between: min => min } },
  }).default;
  const config = { name: 'Skeleton', description: '', tile: 0, healthPoints: 10,
    movementSpeed: 1, attackDelay: 1, visionRadius: 8, attackDamage: 1, protection: 0,
    range: 0, loot: [FakeLoot], gold: 4, initiallyAwake: true };

  const ctx = createGameContext();
  ctx.floor = 5;
  ctx.player = { gainXp() {}, artifact: undefined };
  ctx.entities = [];
  ctx.visibleTiles.add('2,2');
  const faller = new Monster(ctx, config, 2, 2);
  faller.fellIntoChasm = true;
  ctx.entities.push(faller);
  faller.onDestroy();
  const dropped = ctx.chasmFallenItems.get(6)?.[0];
  assert.ok(dropped, 'loot is queued for the floor below');
  assert.equal(dropped.name, 'Gem');
  assert.equal(ctx.entities.some(entity => entity.name === 'Gem'), false,
    'loot never rests on the chasm tile');
  assert.match(ctx.messages[0], /dropping Gem into the chasm/);

  const map = openMap(3, 3);
  ctx.floor = 6;
  const placed = placeChasmFallen(ctx, map, new Set(['0,0']), 3);
  assert.deepEqual(placed, [dropped]);
  assert.ok(ctx.entities.includes(dropped), 'recoverable on the floor below');

  // Gold follows the same path when the loot roll produces nothing.
  const goldCtx = createGameContext();
  goldCtx.floor = 5;
  goldCtx.player = { gainXp() {}, artifact: undefined };
  goldCtx.entities = [];
  goldCtx.visibleTiles.add('2,2');
  const goldFaller = new Monster(goldCtx, { ...config, loot: [] }, 2, 2);
  goldFaller.fellIntoChasm = true;
  goldCtx.entities.push(goldFaller);
  goldFaller.onDestroy();
  assert.equal(goldCtx.chasmFallenItems.get(6)[0].name, '4 gold');
  assert.match(goldCtx.messages[0], /dropping 4 gold into the chasm/);

  // A normal death still drops loot on the exact death tile.
  const normalCtx = createGameContext();
  normalCtx.floor = 5;
  normalCtx.player = { gainXp() {}, artifact: undefined };
  normalCtx.entities = [];
  const normal = new Monster(normalCtx, config, 4, 1);
  normalCtx.entities.push(normal);
  normal.onDestroy();
  const groundLoot = normalCtx.entities.find(entity => entity.name === 'Gem');
  assert.ok(groundLoot, 'untouched deaths keep floor loot');
  assert.deepEqual([groundLoot.x, groundLoot.y], [4, 1]);
  assert.equal(normalCtx.chasmFallenItems, undefined);

  // On the final floor the chasm swallows the drop for good.
  const lastCtx = createGameContext();
  lastCtx.floor = lastCtx.maxFloor;
  lastCtx.player = { gainXp() {}, artifact: undefined };
  lastCtx.entities = [];
  lastCtx.visibleTiles.add('2,2');
  const abyss = new Monster(lastCtx, config, 2, 2);
  abyss.fellIntoChasm = true;
  lastCtx.entities.push(abyss);
  abyss.onDestroy();
  assert.equal(lastCtx.chasmFallenItems, undefined);
  assert.match(lastCtx.messages[0], /lost in the abyss/);
}

// A checkpoint taken while an item is still falling keeps it: the pending queue
// rides in the run save beside the floors, and the item is still recoverable
// after the round trip.
{
  class SavedHero {
    constructor() {
      Object.assign(this, { type: 'player', healthPoints: 30, x: 0, y: 0, backpack: [], maxLevel: Infinity });
    }
    getAllItems() { return [...this.backpack]; }
    resetTransientState() {}
  }
  class SavedGem {
    constructor() {
      Object.assign(this, { type: 'item', name: 'Gem', displayName: 'Gem', count: 1,
        level: 1, charges: 0, x: 2, y: 3, effects: [], sprite: { destroyed: false,
          destroy() { this.destroyed = true; } } });
    }
  }
  const registry = { hero: SavedHero, gem: SavedGem };
  const { encodeGraph, decodeGraph } = load('src/games/rogue0/saveCodec.ts');
  const { decodeRunSave, restoreRunState } = load('src/games/rogue0/runPersistence.ts', {
    decodeGraph, saveRegistry: registry,
    BasicHero: SavedHero, classes: { Warrior: SavedHero },
    ScrollOfUpgrade: SavedGem, Ring: class {}, Wand: class {},
    TieredWeapon: class {}, WEAPON_TEXTURES: [],
    Mimic: class {}, SwarmOfFlies: class {}, Chest: class {},
    CHEST_TEXTURE: 'chest-closed',
    IceElemental: class {}, ICE_ELEMENTAL_TEXTURE: 'monster-ice-elemental',
    restoreEffects: effects => effects,
    restoreConsumableKnowledge() {}, rememberIdentifiedWandTypes() {},
    isChasmRoomFloor: mapgen.isChasmRoomFloor,
    pickChasmRoomFloor: mapgen.pickChasmRoomFloor,
  });
  const floorData = { savedAt: 0, map: [[0]], seen: [[true]], features: [], entities: [],
    up: { x: 0, y: 0 }, down: { x: 0, y: 0 } };
  const buildSave = chasmFallen => ({
    version: 1, heroClass: 'Warrior', floor: 3,
    graph: JSON.parse(JSON.stringify(encodeGraph({
      player: new SavedHero(), floors: new Map([[3, floorData]]), floor: 3, kills: 0,
      messages: [], time: 1, nextTick: 2, knowledge: { appearances: [], known: [] },
      ...(chasmFallen === undefined ? {} : { chasmFallen }),
    }, registry))),
  });
  const pending = new SavedGem();
  const save = buildSave(new Map([[4, [pending]]]));
  const context = createGameContext();
  const run = decodeRunSave(save, context);
  assert.ok(run.chasmFallen instanceof Map, 'pending queue survives the save');
  const recovered = run.chasmFallen.get(4)[0];
  assert.ok(recovered instanceof SavedGem, 'the dropped item is restored, not dropped by the save');
  assert.equal(recovered.count, 1);
  assert.equal(recovered.sprite, undefined, 'sprite is rebuilt when it lands');
  restoreRunState(context, run);
  assert.equal(context.chasmFallenItems.get(4)[0], recovered, 'the scene resumes with the same queue');
  assert.ok(mapgen.isChasmRoomFloor(context.chasmRoomFloor),
    'a resumed run keeps a usable chasm floor for the floors it has not built yet');
  context.floor = 4;
  assert.deepEqual(placeChasmFallen(context, openMap(3, 3), new Set(), 3), [recovered],
    'a reloaded fall still lands on the floor below');

  // Older saves predate the queue and must keep loading.
  const legacy = decodeRunSave(buildSave(undefined), createGameContext());
  assert.equal(legacy.chasmFallen, undefined);

  // Corrupt queues are rejected instead of landing enemies or ground items.
  const enemy = Object.assign(new SavedGem(), { type: 'enemy' });
  assert.throws(() => decodeRunSave(buildSave('nope'), createGameContext()), /Invalid saved run/);
  assert.throws(() => decodeRunSave(buildSave(new Map([[1, [new SavedGem()]]])), createGameContext()),
    /Invalid saved chasm drop/);
  assert.throws(() => decodeRunSave(buildSave(new Map([[4, [enemy]]])), createGameContext()),
    /Invalid saved chasm drop/);
  assert.throws(() => decodeRunSave(buildSave(new Map([[26, []]])), createGameContext()),
    /Invalid saved chasm drop/);
}

console.log('Rogue0 chasm drops: thrown, dropped and monster loot falls onto the floor below');
