import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('backpack-recovery');
import assert from 'node:assert/strict';
import { createInventoryActions } from '../src/games/rogue0/inventory.ts';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';

// --- Pure recovery core: stow contents with the normal pickup rules ---
class Item {
  constructor(overrides = {}) {
    Object.assign(this, {
      type: 'item', name: 'Potion', displayName: 'Potion', equipSlot: 'consumable',
      count: 1, goldAmount: 0, effects: [], identified: true, level: 0, tier: 1,
      cursed: false, blessed: false, charges: 0, isPhysicalEquipment: false,
      x: undefined, y: undefined, sprite: undefined,
    }, overrides);
  }
  equip() {}
  unequip() {}
  onUncursed() {}
}
class Owner {
  constructor(capacity = 20) {
    this.context = { entities: [], messages: [], player: this, events: [] };
    Object.assign(this, {
      backpack: [], capacity, gold: 0, x: 2, y: 2, quickslots: [],
      sprite: {}, actionReady: true, actions: [], nextActionTime: 0, effects: [],
    });
  }
  canAct() { return this.actionReady; }
  spendTurn(action) { this.actions.push(action); this.nextActionTime++; this.actionReady = false; }
}
const placed = [];
const inventory = createInventoryActions({
  log: (context, message) => context.messages.unshift(message),
  equipSound() {},
  removeEntity(context, item) { context.entities = context.entities.filter(e => e !== item); },
  removeEffect() {},
  clearFloorSprite(context, item) {
    if (item.sprite) { item.sprite.destroy(); item.sprite = undefined; }
  },
  clearItemUI() {},
  placeFloorItem(item) { placed.push(item); },
});

{
  const owner = new Owner();
  const potion = new Item({ name: 'Potion of Healing' });
  const sword = new Item({ name: 'Sword', equipSlot: 'weapon', isPhysicalEquipment: true });
  const overflow = inventory.recoverItems(owner, [potion, sword]);
  assert.deepEqual(overflow, [], 'everything fits in an empty backpack');
  assert.deepEqual(owner.backpack, [potion, sword], 'recovered items enter the backpack, not auto-equipped');
  assert.equal(owner.weapon, undefined);
  assert.deepEqual([potion.x, potion.y, potion.sprite], [undefined, undefined, undefined]);
  assert.ok(owner.context.entities.includes(potion) && owner.context.entities.includes(sword));
}

// Stackable contents merge; gold is credited without taking a slot.
{
  const owner = new Owner(1);
  const carried = new Item({ count: 2 });
  inventory.addItem(owner, carried);
  const more = new Item({ count: 3 });
  const gold = new Item({ goldAmount: 25 });
  owner.context.entities.push(gold);
  const overflow = inventory.recoverItems(owner, [more, gold]);
  assert.deepEqual(overflow, []);
  assert.equal(carried.count, 5, 'recovered stack merges with carried stack');
  assert.equal(owner.gold, 25, 'recovered gold is credited');
  assert.equal(owner.backpack.length, 1);
  assert.ok(!owner.context.entities.includes(gold));
}

// Contents that no longer fit are returned for floor placement, not lost.
{
  const owner = new Owner(1);
  const first = new Item({ name: 'First' });
  const second = new Item({ name: 'Second' });
  const overflow = inventory.recoverItems(owner, [first, second]);
  assert.deepEqual(overflow, [second]);
  assert.deepEqual(owner.backpack, [first]);
}

// --- Container behavior: picking the backpack stows contents and opens the UI ---
class EntityStub {
  init(context, x, y) { Object.assign(this, { context, x, y }); }
  get displayName() { return this.name ?? 'Item'; }
}
const dungeon = {
  log: (context, message) => context.messages.push(message),
  canStepBetween: () => true,
};
const { default: DroppedBackpack } = load('src/games/rogue0/items/droppedBackpack.ts', {
  Entity: EntityStub, dungeon, placeFloorItem: item => placed.push(item),
});

function makeHero() {
  const hero = new Owner();
  hero.recoverItems = items => inventory.recoverItems(hero, items);
  return hero;
}

{
  placed.length = 0;
  const hero = makeHero();
  const potion = new Item({ name: 'Recovered Potion', displayName: 'Recovered Potion' });
  const sword = new Item({ name: 'Recovered Sword', displayName: 'Recovered Sword', equipSlot: 'weapon', isPhysicalEquipment: true });
  const looseRing = new Item({ name: 'Equipped Ring', equipSlot: 'ring' });
  const looseArtifact = new Item({ name: 'Equipped Artifact', equipSlot: 'artifact' });
  Object.assign(looseRing, { x: 3, y: 3 });
  Object.assign(looseArtifact, { x: 3, y: 3 });

  let opened = 0;
  const context = hero.context;
  context.scene = { tweens: { killTweensOf() {} } };
  context.onOpenInventory = () => { opened++; };
  context.entities.push(looseRing, looseArtifact);

  const pack = new DroppedBackpack(context, [potion, sword], 3, 3);
  let spriteDestroyed = 0;
  pack.sprite = { destroy() { spriteDestroyed++; } };
  context.entities.push(pack);

  assert.equal(pack.openContainer(), true);
  assert.equal(spriteDestroyed, 1, 'container sprite is removed');
  assert.ok(!context.entities.includes(pack), 'container leaves the floor');
  assert.deepEqual(hero.backpack, [potion, sword], 'all contents are now in the inventory');
  assert.deepEqual(hero.actions, ['use'], 'recovering costs a turn');
  assert.equal(opened, 1, 'picking the backpack opens the inventory window');
  assert.ok(context.messages.some(msg => msg.includes('Recovered Potion')), 'log names the contents');
  // The equipped ring/artifact stay loose on the floor, exactly where revival left them.
  assert.ok(context.entities.includes(looseRing) && context.entities.includes(looseArtifact));
  assert.deepEqual([looseRing.x, looseRing.y, looseArtifact.x, looseArtifact.y], [3, 3, 3, 3]);
  assert.deepEqual(placed, [], 'no recovered item is re-placed as a floor drop');
}

// Overflow stays on the tile instead of disappearing, and the inventory still opens.
{
  placed.length = 0;
  const hero = makeHero();
  hero.capacity = 1;
  const first = new Item({ name: 'Kept' });
  const second = new Item({ name: 'Overflow' });
  let opened = 0;
  const context = hero.context;
  context.scene = { tweens: { killTweensOf() {} } };
  context.onOpenInventory = () => { opened++; };

  const pack = new DroppedBackpack(context, [first, second], 2, 3);
  context.entities.push(pack);
  assert.equal(pack.openContainer(), true);
  assert.deepEqual(hero.backpack, [first]);
  assert.deepEqual([second.x, second.y], [2, 3]);
  assert.ok(context.entities.includes(second), 'overflow item remains on the floor');
  assert.ok(placed.includes(second), 'overflow item gets a floor sprite');
  assert.equal(opened, 1);
  assert.ok(context.messages.some(msg => msg.includes('left on the floor')));
}

// Guards: an inactive hero cannot recover (and the inventory stays closed).
{
  const hero = makeHero();
  hero.actionReady = false;
  let opened = 0;
  const context = hero.context;
  context.scene = { tweens: { killTweensOf() {} } };
  context.onOpenInventory = () => { opened++; };
  const item = new Item({ name: 'Guarded' });
  const pack = new DroppedBackpack(context, [item], 3, 3);
  context.entities.push(pack);
  assert.equal(pack.openContainer(), false);
  assert.equal(opened, 0);
  assert.ok(context.entities.includes(pack), 'container stays on the floor');
  assert.deepEqual(hero.backpack, []);
}

console.log('Rogue0 backpack recovery: inventory stow, stacking, gold, overflow, UI open and loose equipment passed');
