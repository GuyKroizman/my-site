import { createInventoryActions } from './inventory';
import dungeon from './dungeon';
import { sfx } from './audio';
import { removeEntity } from './entity';
import { removeEffect } from './effects';
import { clearFloorSprite, clearItemUI, placeFloorItem } from './itemPresentation';

// Stateless runtime wiring. No controller is stored on the hero or in saves.
export const heroInventory = createInventoryActions({
  log: (context, message) => dungeon.log(context, message),
  equipSound: () => sfx.equip(),
  removeEntity, removeEffect, clearFloorSprite, clearItemUI, placeFloorItem,
});
