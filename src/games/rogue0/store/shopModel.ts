import type { Entity } from '../entity';
import { canStackItems, slotOf, splitStackItem, type InventoryOwner } from '../inventory.ts';
import { clearItemUI } from '../itemPresentation.ts';
import { buyPrice, sellPrice } from './shopPricing.ts';
import { SHOP_FLOOR, type StockSlot } from './shopStock.ts';
import { STORE_SLOTS } from './storeLayout.ts';

export type ShopStock = { item?: Entity; price: number; sold: boolean };
export type ShopState = { version: 1; floor: number; stock: ShopStock[] };
export type ShopOwner = InventoryOwner & {
  quickslots: (Entity | undefined)[];
  addItem(item: Entity): boolean;
};
export type ShopFailure = 'sold-out' | 'stale-item' | 'invalid-item' | 'invalid-price' |
  'not-enough-gold' | 'backpack-full' | 'inventory-rejected' | 'not-carried' |
  'equipped' | 'invalid-quantity' | 'invalid-gold';
export type ShopResult = { ok: false; reason: ShopFailure } |
  { ok: true; quantity: number; gold: number; message: string };

const positiveInteger = (value: number) => Number.isSafeInteger(value) && value > 0;
const validGold = (value: number) => Number.isSafeInteger(value) && value >= 0;
const tradable = (item: Entity) => item.type === 'item' && !item.isContainer &&
  !(item.goldAmount > 0) && positiveInteger(item.count);

// Construction is a runtime boundary: makeItem must return a fresh, unplaced
// item with its context attached (never push shelf items into world entities).
// Local identification deliberately does not teach the player all stock types.
export function createShopState(plan: readonly StockSlot[], makeItem: (slot: StockSlot) => Entity): ShopState {
  if (plan.length !== STORE_SLOTS) throw new RangeError('A store needs exactly 15 slots');
  const seen = new Set<Entity>();
  const stock = plan.map(spec => {
    if (!positiveInteger(spec.count)) throw new RangeError('Invalid stock count');
    const item = makeItem(spec);
    if (seen.has(item) || item.x !== undefined || item.y !== undefined || item.sprite || !tradable(item)) {
      throw new Error('Stock factory must return distinct, unplaced trade items');
    }
    seen.add(item);
    item.count = spec.count;
    item.identified = true;
    item.cursed = false;
    item.curseId = '';
    return { item, price: buyPrice(item), sold: false };
  });
  return { version: 1, floor: SHOP_FLOOR, stock };
}

export function sellableItems(owner: ShopOwner): Entity[] {
  return owner.backpack.filter(item => !slotOf(owner, item) && tradable(item));
}

// UI calls the same validation for its disabled reason and again at commit.
// Expected identity prevents an old modal buying a different item/slot.
export function purchaseFailure(owner: ShopOwner, shop: ShopState, index: number,
  expected: Entity): ShopFailure | undefined {
  const slot = Number.isInteger(index) ? shop.stock[index] : undefined;
  if (!slot || slot.sold || !slot.item) return 'sold-out';
  if (slot.item !== expected) return 'stale-item';
  if (!tradable(expected) || owner.backpack.includes(expected) || slotOf(owner, expected)) return 'invalid-item';
  if (!positiveInteger(slot.price)) return 'invalid-price';
  if (!validGold(owner.gold)) return 'invalid-gold';
  if (owner.gold < slot.price) return 'not-enough-gold';
  if (owner.backpack.length >= owner.capacity && !owner.backpack.some(item => canStackItems(item, expected))) {
    return 'backpack-full';
  }
  return undefined;
}

// No turn/equip/use/heal/damage or identify hooks. The StoreScene must own the
// pause/entry guard and save after a successful result. These synchronous
// operations also work headlessly with the real inventory core.
export function buyShopItem(owner: ShopOwner, shop: ShopState, index: number, expected: Entity): ShopResult {
  const reason = purchaseFailure(owner, shop, index, expected);
  if (reason) return { ok: false, reason };
  const slot = shop.stock[index];
  const name = expected.displayName;
  const incoming = expected.count > 1 ? splitStackItem(expected) : expected;
  // addItem rejects without mutation. Charge/remove stock only after acceptance,
  // so a full bag or rejected item never needs a gold/stock refund.
  if (!owner.addItem(incoming)) return { ok: false, reason: 'inventory-rejected' };
  owner.gold -= slot.price;
  if (expected.count > 1) expected.count--;
  else { slot.item = undefined; slot.sold = true; }
  return { ok: true, quantity: 1, gold: slot.price, message: `You buy ${name} for ${slot.price}g.` };
}

export function sellShopItem(owner: ShopOwner, item: Entity, quantity = 1): ShopResult {
  if (slotOf(owner, item)) return { ok: false, reason: 'equipped' };
  if (!owner.backpack.includes(item)) return { ok: false, reason: 'not-carried' };
  if (!tradable(item)) return { ok: false, reason: 'invalid-item' };
  if (!positiveInteger(quantity) || quantity > item.count) return { ok: false, reason: 'invalid-quantity' };
  const gold = sellPrice(item) * quantity;
  if (!validGold(owner.gold) || !validGold(gold) || !validGold(owner.gold + gold)) return { ok: false, reason: 'invalid-gold' };
  // Use only the public name, before removal. Neither the log nor the modal
  // should reveal true names/descriptions/curse state of unknown possessions.
  const name = item.displayName;
  if (quantity < item.count) item.count -= quantity;
  else {
    owner.backpack = owner.backpack.filter(candidate => candidate !== item);
    owner.context.entities = owner.context.entities.filter(candidate => candidate !== item);
    owner.quickslots = owner.quickslots.map(candidate => candidate === item ? undefined : candidate);
    clearItemUI(item);
  }
  owner.gold += gold;
  return { ok: true, quantity, gold, message: `You sell ${quantity > 1 ? `${quantity} × ` : ''}${name} for ${gold}g.` };
}
