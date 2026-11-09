import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('shop-transactions');
import assert from 'node:assert/strict';
import { createInventoryActions } from '../src/games/rogue0/inventory.ts';
import { clearFloorSprite, clearItemUI } from '../src/games/rogue0/itemPresentation.ts';
import { createShopState, sellableItems, purchaseFailure, buyShopItem, sellShopItem } from '../src/games/rogue0/store/shopModel.ts';
import { planShopStock } from '../src/games/rogue0/store/shopStock.ts';
import { encodeGraph, decodeGraph } from '../src/games/rogue0/saveCodec.ts';

let constructions = 0;
class Item {
  constructor(overrides = {}) {
    constructions++;
    Object.assign(this, { type: 'item', name: 'Potion of Healing', equipSlot: 'consumable', count: 1,
      identified: false, cursed: false, curseScanned: false, curseId: '', tier: 1, level: 0,
      charges: 0, goldAmount: 0, blessed: false, effects: [], ...overrides });
  }
  get displayName() { return this.identified ? this.name : 'Potion “secret”'; }
  equip() { assert.fail('Trading must not equip/use an item'); }
  onDestroy() { assert.fail('Selling must not invoke destruction/loot hooks'); }
}
const inventory = createInventoryActions({
  log() {}, clearFloorSprite, clearItemUI,
  equipSound() { assert.fail(); }, removeEntity() { assert.fail(); },
  removeEffect() { assert.fail(); }, placeFloorItem() { assert.fail(); },
});
class Owner {
  constructor() {
    this.context = { entities: [this], simulationTime: 12.5, messages: [], knowledge: { known: ['existing'] } };
    Object.assign(this, { backpack: [], capacity: 2, gold: 1000, quickslots: [],
      healthPoints: 7, hunger: 14, effects: [{ id: 'burning', duration: 5, nextTick: 13 }], nextActionTime: 12.5 });
  }
  addItem(item) { return inventory.addItem(this, item); }
  spendTurn() { assert.fail('Trading must not spend time'); }
  takeDamage() { assert.fail('Trading must not damage the hero'); }
}
function fixture() {
  const owner = new Owner();
  const shop = createShopState(planShopStock(6, () => 0), spec => {
    const item = new Item({ context: owner.context, tier: spec.tier, level: spec.level });
    return item;
  });
  return { owner, shop };
}
const frozen = owner => JSON.stringify([owner.healthPoints, owner.hunger, owner.effects,
  owner.nextActionTime, owner.context.simulationTime, owner.context.knowledge]);

// Each stock item is local, distinct, identified without teaching global types.
{
  const { owner, shop } = fixture();
  assert.equal(shop.stock.length, 15);
  assert.equal(new Set(shop.stock.map(slot => slot.item)).size, 15);
  assert.deepEqual(owner.context.entities, [owner]);
  assert.deepEqual(owner.context.knowledge, { known: ['existing'] });
  assert.ok(shop.stock.every(slot => slot.item.identified && !slot.item.cursed));
  assert.throws(() => createShopState([], () => new Item()));
  const shared = new Item();
  assert.throws(() => createShopState(planShopStock(), () => shared), /distinct/);
}

// Buy whole/split stock, stack into a full backpack, reject repeat clicks.
{
  const { owner, shop } = fixture();
  owner.capacity = 1;
  const before = frozen(owner);
  const slot = shop.stock[0], item = slot.item;
  item.count = 2;
  const count = constructions;
  assert.equal(buyShopItem(owner, shop, 0, item).ok, true);
  assert.equal(constructions, count, 'splitting cannot reroll constructors');
  assert.equal(item.count, 1);
  assert.notEqual(owner.backpack[0], item);
  assert.ok(owner.backpack[0] instanceof Item);
  owner.quickslots[0] = owner.backpack[0];
  assert.equal(purchaseFailure(owner, shop, 0, item), undefined);
  assert.equal(buyShopItem(owner, shop, 0, item).ok, true);
  assert.equal(owner.backpack[0].count, 2);
  assert.equal(owner.quickslots[0], owner.backpack[0]);
  assert.equal(slot.sold, true);
  assert.equal(slot.item, undefined);
  assert.equal(buyShopItem(owner, shop, 0, item).reason, 'sold-out');
  assert.equal(owner.gold, 1000 - slot.price * 2);
  assert.equal(frozen(owner), before);
}

// Rejected purchases don't touch wallet, stock or carried entities.
{
  const { owner, shop } = fixture();
  const item = shop.stock[0].item;
  owner.gold = 0;
  assert.equal(buyShopItem(owner, shop, 0, item).reason, 'not-enough-gold');
  owner.gold = 1000; owner.capacity = 0;
  assert.equal(buyShopItem(owner, shop, 0, item).reason, 'backpack-full');
  owner.capacity = 2;
  assert.equal(buyShopItem(owner, shop, 0, new Item()).reason, 'stale-item');
  assert.equal(buyShopItem(owner, shop, -1, item).reason, 'sold-out');
  owner.addItem = () => false;
  assert.equal(buyShopItem(owner, shop, 0, item).reason, 'inventory-rejected');
  assert.equal(shop.stock[0].item, item);
  assert.equal(item.count, 1);
  assert.equal(owner.gold, 1000);
  assert.deepEqual(owner.backpack, []);
  assert.deepEqual(owner.context.entities, [owner]);
}

// Sell partial/whole stacks without revealing identity or detaching remaining quickslots.
{
  const owner = new Owner();
  const item = new Item({ count: 3, cursed: true, context: owner.context });
  owner.addItem(item); owner.quickslots = [item, undefined, item];
  let cleared = 0;
  item.UISprite = { destroy() { cleared++; } };
  const before = frozen(owner), gold = owner.gold;
  assert.deepEqual(sellableItems(owner), [item]);
  const sold = sellShopItem(owner, item);
  assert.equal(sold.gold, 3); // normal healing quote 7g, cursed half rounded down
  assert.ok(!sold.message.includes('Healing'));
  assert.equal(item.count, 2);
  assert.equal(owner.quickslots[0], item);
  assert.equal(cleared, 0);
  assert.equal(sellShopItem(owner, item, 2).gold, 6);
  assert.equal(owner.gold, gold + 9);
  assert.deepEqual(owner.backpack, []);
  assert.ok(!owner.context.entities.includes(item));
  assert.deepEqual(owner.quickslots, [undefined, undefined, undefined]);
  assert.equal(cleared, 1);
  assert.equal(item.identified, false);
  assert.equal(item.curseScanned, false);
  assert.equal(item.cursed, true);
  assert.equal(frozen(owner), before);
  assert.equal(sellShopItem(owner, item).reason, 'not-carried');
}

// Equipped items, invalid amounts, containers and gold cannot be sold.
{
  const owner = new Owner();
  const item = new Item({ context: owner.context }); owner.addItem(item);
  for (const slot of ['weapon', 'armor', 'ring1', 'ring2', 'artifact']) {
    owner[slot] = item;
    assert.deepEqual(sellableItems(owner), []);
    assert.equal(sellShopItem(owner, item).reason, 'equipped');
    owner[slot] = undefined;
  }
  for (const quantity of [0, -1, 2, NaN, Infinity, 0.5]) {
    assert.equal(sellShopItem(owner, item, quantity).reason, 'invalid-quantity');
  }
  item.isContainer = true;
  assert.equal(sellShopItem(owner, item).reason, 'invalid-item');
  item.isContainer = false; item.goldAmount = 3;
  assert.equal(sellShopItem(owner, item).reason, 'invalid-item');
  assert.equal(owner.gold, 1000);
}

// Save codec preserves depleted stock and exact shared inventory references.
{
  const { owner, shop } = fixture();
  const item = shop.stock[0].item;
  buyShopItem(owner, shop, 0, item);
  owner.quickslots[0] = item;
  const before = constructions;
  const saved = JSON.parse(JSON.stringify(encodeGraph({ owner, shop }, { Item, Owner })));
  const restored = decodeGraph(saved, { Item, Owner });
  assert.equal(constructions, before, 'loading never rerolls stock');
  assert.equal(restored.shop.stock[0].sold, true);
  assert.equal(restored.shop.stock[0].item, undefined);
  assert.equal(restored.owner.backpack[0], restored.owner.quickslots[0]);
  assert.equal(restored.shop.stock[1].item instanceof Item, true);
  assert.equal(restored.shop.stock[1].price, shop.stock[1].price);
}
console.log('Shop transactions passed: atomic purchases, selling, no identification/time/HP changes and graph round-trip.');
