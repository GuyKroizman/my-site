import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity } from "../entity";
import { applyEffect, createHasteEffect } from "../effects";
import dungeon from "../dungeon";

// A drunk flask quadruples walking speed for forty turns of world time. Like
// every haste source it leaves attack speed alone, and it stacks with the
// movement-speed bonus from a Ring of Haste.
export const HASTE_POTION_DURATION = 40;
export const HASTE_POTION_MULTIPLIER = 4;

export default class PotionOfHaste extends Entity {
  type: EntityType = "item";
  tier = 1;
  equipSlot: "consumable" = "consumable";
  protected locallyIdentified = false;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.textureKey = "potion-blue";
    this.name = "Potion of Haste";
    this.description = "Makes you move four times faster for 40 turns. Does not speed up attacks.";
    this.consumable = true;

    this.init(context, x, y);
  }

  equip() {
    const player = this.context.player;
    if (!player) return;

    applyEffect(player, createHasteEffect(HASTE_POTION_DURATION, HASTE_POTION_MULTIPLIER));
    dungeon.log(this.context, "You drink the potion and the world slows around you.");

    player.removeItem(this);
    removeEntity(this.context, this);
  }

  damage() {
    return 0;
  }

  turn() {
  }

  refresh() {
  }

  isOver() {
    return true;
  }

  attack(): number {
    return 0;
  }

  protection(): number {
    return 0;
  }

  range(): number {
    return 0;
  }

  onDestroy() {
  }
}
