// Runtime-only item construction. Pure stock planning remains usable in Node.
import type { GameContext } from '../context';
import type { Entity } from '../entity';
import { saveRegistry } from '../saveRegistry';
import Wand from '../items/wand';
import { createShopState } from './shopModel';
import { planShopStock } from './shopStock';

export const SHOP_ITEM_IDS: Record<string, string> = {
  'potion-healing': './items/PotionOfHealing.ts:default',
  'potion-strength': './items/PotionOfStrength.ts:default',
  'potion-experience': './items/PotionOfExperience.ts:default',
  'potion-invisibility': './items/PotionOfInvisibility.ts:default',
  'potion-toxic-gas': './items/PotionOfToxicGas.ts:default',
  'potion-liquid-flame': './items/PotionOfLiquidFlame.ts:default',
  'potion-frost': './items/PotionOfFrost.ts:default',
  'potion-levitation': './items/PotionOfLevitation.ts:default',
  'potion-berserk': './items/berserkPotion.ts:default',
  'scroll-identify': './items/ScrollOfIdentify.ts:default',
  'scroll-upgrade': './items/ScrollOfUpgrade.ts:default',
  'scroll-remove-curse': './items/ScrollOfRemoveCurse.ts:default',
  'scroll-teleport': './items/ScrollOfTeleport.ts:default',
  'scroll-rage': './items/ScrollOfRage.ts:default',
  'scroll-terror': './items/ScrollOfTerror.ts:default',
  'scroll-recharging': './items/ScrollOfRecharging.ts:default',
  'scroll-fireball': './items/scrolloffireball.ts:default',
  'scroll-lightning': './items/scrolloflightning.ts:default',
  'wand-firebolt': './items/WandOfFirebolt.ts:default',
  'wand-frost': './items/WandOfFrost.ts:default',
  'wand-lightning': './items/WandOfLightning.ts:default',
  'wand-blast': './items/WandOfBlast.ts:default',
  'ring-accuracy': './items/RingOfAccuracy.ts:default',
  'ring-evasion': './items/RingOfEvasion.ts:default',
  'ring-elements': './items/RingOfElements.ts:default',
  'ring-haste': './items/RingOfHaste.ts:default',
  'ring-might': './items/RingOfMight.ts:default',
  'stone-blink': 'item:stone-of-blink',
  'stone-detect-curse': 'item:stone-of-detect-curse',
  'weapon': './items/tieredEquipment.ts:TieredWeapon',
  'armor': './items/tieredEquipment.ts:TieredArmor',
  'ration': './items/ration.ts:default',
  'chalice-of-blood': './items/ChaliceOfBlood.ts:default',
  'fang-of-the-beast': './items/FangOfTheBeast.ts:default',
};

export function ensureShopState(context: GameContext): void {
  if (context.shop) return; // including a completely sold-out store
  context.shop = createShopState(planShopStock(), spec => {
    const Ctor = saveRegistry[SHOP_ITEM_IDS[spec.kind]] as unknown as
      new (context: GameContext, x?: number, y?: number, tier?: number) => Entity;
    if (!Ctor) throw new Error(`Unknown shop item: ${spec.kind}`);
    const item = new Ctor(context, undefined, undefined, spec.tier);
    item.tier = spec.tier;
    item.level = spec.level;
    if (item instanceof Wand) { item.reconcileChargeScaling(); item.refill(); }
    return item;
  });
}
