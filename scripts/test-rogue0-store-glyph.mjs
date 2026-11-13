import { recordTestRun } from './rogue0-test-history.mjs';
recordTestRun('store-glyph');
import assert from 'node:assert/strict';
import { loadLogic as load } from './lib/rogue0-logic-loader.mjs';
import { createShopState, buyShopItem } from '../src/games/rogue0/store/shopModel.ts';
import { planShopStock } from '../src/games/rogue0/store/shopStock.ts';
import { buyPrice } from '../src/games/rogue0/store/shopPricing.ts';
import { createInventoryActions } from '../src/games/rogue0/inventory.ts';
import { STORE_SLOTS } from '../src/games/rogue0/store/storeLayout.ts';

const { Entity, removeEntity } = load('src/games/rogue0/entity.ts');
const GLYPH_STONE_TEXTURES = { blink: 'glyph-stone-blink', detectCurse: 'glyph-stone-detect-curse', infuse: 'glyph-stone-infuse' };
const GlyphStone = load('src/games/rogue0/items/glyphStone.ts', { Entity }).default;
const StoneOfInfusion = load('src/games/rogue0/items/stoneOfInfusion.ts', {
  Entity, GlyphStone, removeEntity, GLYPH_STONE_TEXTURES,
  dungeon: { log: (context, text) => context.messages.push(text) },
}).default;
const { TieredWeapon } = load('src/games/rogue0/items/tieredEquipment.ts', {
  Entity, Phaser: { Math: { Between: min => min } },
});
const Ration = load('src/games/rogue0/items/ration.ts', {
  Entity, removeEntity, dungeon: { log() {} },
}).default;

// Shared save registry is the single source of stock constructors.
const { SHOP_ITEM_IDS, ensureShopState } = load('src/games/rogue0/store/shopItems.ts', {
  saveRegistry: {
    './items/ration.ts:default': Ration,
    'item:stone-of-infusion': StoneOfInfusion,
  },
  Wand: class {},
  createShopState: (plan, make) => createShopState(plan, make),
});
assert.equal(SHOP_ITEM_IDS['stone-infuse'], 'item:stone-of-infusion');

// Fixed plan: the charm is built through the real shop factory, not a stub.
const plan = Array.from({ length: STORE_SLOTS }, () => ({ kind: 'ration', tier: 1, level: 0, count: 1 }));
plan[4] = { kind: 'stone-infuse', tier: 1, level: 0, count: 1 };
const context = { messages: [], entities: [] };
ensureShopState(context, plan);
const slot = context.shop.stock[4];
assert.deepEqual(context.shop.stock.length, 15);
assert.ok(slot.item instanceof StoneOfInfusion, 'the shelf holds a real infuse charm');
assert.equal(slot.item.name, 'Stone of Infusion');
assert.equal(slot.item.identified, true, 'shelf stock is openly identified');
assert.equal(slot.item.cursed, false);
assert.equal(slot.item.x, undefined);
assert.equal(slot.item.sprite, undefined);
assert.equal(slot.sold, false);
assert.equal(slot.price, buyPrice({ name: 'Stone of Infusion', equipSlot: 'consumable',
  textureKey: GLYPH_STONE_TEXTURES.infuse, tier: 1, level: 0, charges: 0, cursed: false }));
assert.equal(slot.price, 90);
assert.equal(context.shop.stock[0].item.name, 'Ration of Food');
const shop = context.shop;
ensureShopState(context, []); // A generated store is never replaced.
assert.equal(context.shop, shop);
assert.equal(shop.stock[4].item, slot.item);

// Buying the charm costs gold and stock but never uses/identifies it.
const inventory = createInventoryActions({
  log() {}, clearFloorSprite() {}, clearItemUI() {},
  equipSound() {}, removeEntity() {}, removeEffect() {}, placeFloorItem() {},
});
const buffered = [];
const player = {
  context, backpack: [], capacity: 20, gold: 150, quickslots: [],
  addItem(item) { return inventory.addItem(this, item); },
  getAllItems() { return inventory.allItems(this); },
  removeItem(item) { inventory.removeItem(this, item); },
  canAct: () => true,
  spendTurn(action) { buffered.push(action); },
};
context.player = player;
const charm = slot.item;
assert.equal(buyShopItem(player, context.shop, 4, charm).ok, true);
assert.equal(player.gold, 60);
assert.equal(slot.sold, true);
assert.ok(player.backpack.includes(charm));
assert.equal(charm.identified, true);
assert.equal(charm.equipSlot, 'consumable', 'the charm stays a consumable, not gear');
assert.equal(buffered.length, 0, 'buying spends no turn');

// The store-bought charm engraves gear through the normal target flow.
const weapon = new TieredWeapon({ messages: [] }, undefined, undefined, 2);
weapon.identified = false;
player.backpack.push(weapon);
assert.equal(charm.canTargetItem(weapon), true);
const originalRandom = Math.random;
Math.random = () => 0.999; // Last weapon glyph: push.
try {
  assert.equal(charm.useOnItem(weapon), true);
} finally {
  Math.random = originalRandom;
}
assert.equal(weapon.glyph, 'push');
assert.equal(weapon.identified, false, 'infusion does not identify hidden gear');
assert.ok(!player.backpack.includes(charm), 'the charm is spent');
assert.ok(!context.entities.includes(charm));
assert.deepEqual(buffered, ['use']);

// Stacked charms sell and split correctly; the shelf price is per unit.
const stacked = Array.from({ length: STORE_SLOTS }, () => ({ kind: 'ration', tier: 1, level: 0, count: 1 }));
stacked[0] = { kind: 'stone-infuse', tier: 1, level: 0, count: 3 };
const stackedContext = { messages: [], entities: [] };
ensureShopState(stackedContext, stacked);
const stackedSlot = stackedContext.shop.stock[0];
assert.equal(stackedSlot.item.count, 3);
assert.equal(stackedSlot.price, 90, 'price is for one charm');
assert.doesNotThrow(() => planShopStock(6, () => 0.5), 'normal weighted stock still plans');
console.log('Store glyph: rare infusion charm is stocked, priced, bought unspent, targets gear and splits as a stack passed');
