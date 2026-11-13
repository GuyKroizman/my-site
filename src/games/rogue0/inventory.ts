import type { Entity } from './entity';
import type { GameContext } from './context';
import type { ActionKind } from './timing';
import { terrainFor } from './terrain.ts';
import { stashChasmFallen } from './chasmDrops.ts';

export type EquipSlotKey = 'weapon' | 'armor' | 'ring1' | 'ring2' | 'artifact';

// Storage stays on the actor: v1 saves and quickslots retain the same object
// references. This module owns operations, not a second copy of inventory state.
export type InventoryOwner = Entity & {
  weapon?: Entity;
  armor?: Entity;
  ring1?: Entity;
  ring2?: Entity;
  artifact?: Entity;
  backpack: Entity[];
  capacity: number;
  gold: number;
  canAct(): boolean;
  spendTurn(action: ActionKind): void;
};

export type InventoryServices = {
  log(context: GameContext, message: string): void;
  equipSound(cursed: boolean): void;
  removeEntity(context: GameContext, entity: Entity): void;
  removeEffect(entity: Entity, id: string): void;
  clearFloorSprite(context: GameContext, item: Entity): void;
  clearItemUI(item: Entity): void;
  placeFloorItem(item: Entity): void;
};

export function slotFor(owner: InventoryOwner, item: Entity): EquipSlotKey | undefined {
  switch (item.equipSlot) {
    case 'weapon': return 'weapon';
    case 'armor': return 'armor';
    case 'ring':
      if (owner.ring1 === undefined) return 'ring1';
      if (owner.ring2 === undefined) return 'ring2';
      return undefined;
    case 'artifact': return 'artifact';
    default: return undefined;
  }
}

export function slotOf(owner: InventoryOwner, item: Entity): EquipSlotKey | undefined {
  for (const slot of ['weapon', 'armor', 'ring1', 'ring2', 'artifact'] as const) {
    if (owner[slot] === item) return slot;
  }
  return undefined;
}

export function equippedItems(owner: InventoryOwner): Entity[] {
  return [owner.weapon, owner.armor, owner.ring1, owner.ring2, owner.artifact]
    .filter((item): item is Entity => item !== undefined);
}

export function allItems(owner: InventoryOwner): Entity[] {
  return [...equippedItems(owner), ...owner.backpack];
}

export function canStackItems(existing: Entity, item: Entity): boolean {
  return existing.equipSlot === 'consumable' && item.equipSlot === 'consumable' &&
    existing.name === item.name && existing.constructor === item.constructor &&
    existing.identified === item.identified && existing.level === item.level &&
    existing.tier === item.tier && existing.cursed === item.cursed &&
    existing.blessed === item.blessed && existing.charges === item.charges &&
    existing.glyph === item.glyph &&
    existing.effects.length === 0 && item.effects.length === 0;
}

// Never construct a new item to split a stack: constructors can reroll state.
export function splitStackItem(item: Entity): Entity {
  return Object.assign(Object.create(Object.getPrototypeOf(item)), item, {
    count: 1, x: undefined, y: undefined, sprite: undefined,
    UISprite: undefined, UIText: undefined,
    effects: item.effects.map(effect => ({ ...effect }))
  });
}

// No Phaser imports, global dungeon, or retained owner. Runtime adapters supply
// presentation and lifecycle operations; tests can exercise the actual module.
export function createInventoryActions(services: InventoryServices) {
  function onEquip(owner: InventoryOwner, item: Entity): void {
    const wasIdentified = item.identified;
    item.equip();
    services.log(owner.context, `You equip ${item.displayName}.`);
    // Equipping always reveals the curse status, but never the upgrade level or
    // the true type of a ring/artifact. Those need a Scroll of Identify or
    // extended use.
    if (!wasIdentified && (item.isPhysicalEquipment || item.equipSlot === 'ring' || item.equipSlot === 'artifact')) {
      services.log(owner.context, item.cursed
        ? `${item.displayName} is cursed and cannot be removed until its curse is lifted.`
        : `${item.displayName} is not cursed.`);
    }
    services.equipSound(item.cursed);
  }

  function onUnequip(owner: InventoryOwner, item: Entity): void {
    services.log(owner.context, `You unequip ${item.displayName}.`);
    item.unequip?.();
  }

  return {
    slotFor, slotOf, equippedItems, allItems,

    // Pickup only stows/merges items; starting gear is explicitly equipped by
    // hero constructors. Rejected pickups leave both floor and inventory intact.
    addItem(owner: InventoryOwner, item: Entity): boolean {
      if (item.isContainer) return false;
      if (item.goldAmount > 0) {
        const index = owner.context.entities.indexOf(item);
        if (index === -1 || item.x === undefined || item.y === undefined) return false;
        owner.gold += item.goldAmount;
        owner.context.entities.splice(index, 1);
        return true;
      }
      const existing = owner.backpack.find(candidate => canStackItems(candidate, item));
      if (existing) {
        existing.count += item.count;
        const index = owner.context.entities.indexOf(item);
        if (index !== -1) owner.context.entities.splice(index, 1);
        services.clearFloorSprite(owner.context, item);
        return true;
      }
      if (owner.backpack.length >= owner.capacity) {
        services.log(owner.context, 'Your backpack is full.');
        return false;
      }
      if (!owner.context.entities.includes(item)) owner.context.entities.push(item);
      item.context = owner.context;
      item.x = undefined;
      item.y = undefined;
      services.clearFloorSprite(owner.context, item);
      owner.backpack.push(item);
      return true;
    },

    equipItem(owner: InventoryOwner, item: Entity): void {
      if (owner.sprite && !owner.canAct()) return;
      const slot = slotFor(owner, item);
      if (!slot) {
        services.log(owner.context, `${item.displayName} cannot be equipped.`);
        return;
      }
      if (!owner.backpack.includes(item)) {
        services.log(owner.context, `${item.displayName} is not in your backpack.`);
        return;
      }
      const previous = owner[slot];
      if (previous?.cursed) {
        services.log(owner.context, `${previous.displayName} is cursed and cannot be removed.`);
        return;
      }
      // Removing the new item frees the slot needed by the old one, even when
      // the backpack is full. Install the new reference before passive hooks.
      owner.backpack = owner.backpack.filter(candidate => candidate !== item);
      owner[slot] = item;
      if (previous) {
        owner.backpack.push(previous);
        onUnequip(owner, previous);
      }
      onEquip(owner, item);
      // Starting equipment is installed before the hero sprite exists.
      if (owner.sprite) owner.spendTurn('equip');
    },

    unequipItem(owner: InventoryOwner, item: Entity): void {
      if (!owner.canAct()) return;
      if (item.cursed) {
        services.log(owner.context, `${item.displayName} is cursed and cannot be removed.`);
        return;
      }
      const slot = slotOf(owner, item);
      if (!slot) return;
      if (owner.backpack.length >= owner.capacity) {
        services.log(owner.context, 'Your backpack is full.');
        return;
      }
      owner[slot] = undefined;
      owner.backpack.push(item);
      onUnequip(owner, item);
      owner.spendTurn('equip');
    },

    dropItem(owner: InventoryOwner, item: Entity): void {
      if (!owner.canAct() || !allItems(owner).includes(item)) return;
      if (item.cursed && slotOf(owner, item)) {
        services.log(owner.context, `${item.displayName} is cursed and cannot be dropped.`);
        return;
      }
      if (owner.x === undefined || owner.y === undefined) {
        services.log(owner.context, 'There is nowhere to drop that here.');
        return;
      }
      if (item.count > 1) {
        item.count -= 1;
        item = splitStackItem(item);
      } else {
        const slot = slotOf(owner, item);
        if (slot) {
          owner[slot] = undefined;
          onUnequip(owner, item);
        } else {
          owner.backpack = owner.backpack.filter(candidate => candidate !== item);
        }
        services.clearItemUI(item);
      }
      item.context = owner.context;
      item.x = owner.x;
      item.y = owner.y;
      if (terrainFor(owner.context).getFeature(owner.x, owner.y) === 'chasm') {
        // Dropped in mid-air over a chasm (levitating): it falls to the floor below.
        const landsBelow = stashChasmFallen(owner.context, item);
        services.log(owner.context, landsBelow
          ? `${item.displayName} drops into the chasm and falls toward the floor below.`
          : `${item.displayName} drops into the chasm and is lost.`);
        owner.spendTurn('drop');
        return;
      }
      if (!owner.context.entities.includes(item)) owner.context.entities.push(item);
      services.placeFloorItem(item);
      services.log(owner.context, `You drop ${item.displayName}.`);
      owner.spendTurn('drop');
    },

    removeItem(owner: InventoryOwner, item: Entity): void {
      if (item.count > 1) {
        item.count -= 1;
        return;
      }
      const slot = slotOf(owner, item);
      if (slot) {
        owner[slot] = undefined;
        onUnequip(owner, item);
      } else {
        owner.backpack = owner.backpack.filter(candidate => candidate !== item);
      }
      services.clearItemUI(item);
    },

    removeItemsByProperty<K extends keyof Entity>(owner: InventoryOwner, property: K, value: Entity[K]): void {
      const removed = allItems(owner).filter(item => item[property] === value);
      for (const item of removed) {
        const slot = slotOf(owner, item);
        if (slot) {
          owner[slot] = undefined;
          item.unequip?.();
        } else {
          owner.backpack = owner.backpack.filter(candidate => candidate !== item);
        }
        services.clearItemUI(item);
        services.removeEntity(owner.context, item);
      }
    },

    removeCurse(owner: InventoryOwner, target?: Entity): void {
      let lifted = false;
      const carried = allItems(owner);
      for (const item of target ? carried.filter(item => item === target) : carried) {
        if (item.cursed) {
          item.cursed = false;
          item.curseId = '';
          item.onUncursed?.();
          lifted = true;
        }
      }
      if (!equippedItems(owner).some(item => item.cursed && item.curseEffectId === 'cursed')) {
        services.removeEffect(owner, 'cursed');
      }
      // Name the cleansed item when a single target was chosen; the global
      // path stays for scripted/test cleansing of every carried item.
      services.log(owner.context, target
        ? lifted
          ? `The curse is lifted from ${target.displayName}.`
          : `${target.displayName} is not cursed.`
        : lifted ? 'The curse is lifted from your equipment.' : 'Nothing is cursed.');
    }
  };
}
