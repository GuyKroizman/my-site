import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity } from "../entity";
import { applyEffect, createStrengthenedEffect } from "../effects";

export default class ScrollOfRage extends Entity {
  textureKey = "scroll-rage";
  type: EntityType = "item";
  tier = 1;
  equipSlot: "consumable" = "consumable";
  protected locallyIdentified = false;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 15 * 49 + 39;
    this.name = "Scroll of Rage";
    this.description = "Fills you with rage, strengthening your attacks.";
    this.consumable = true;

    this.init(context, x, y);
  }

  equip() {
    const player = this.context.player;
    if (!player) return;

    applyEffect(player, createStrengthenedEffect(10));

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
