import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity } from "../entity";
import { applyEffect, createLevitatingEffect } from "../effects";

export default class PotionOfLevitation extends Entity {
  type: EntityType = "item";
  tier = 1;
  equipSlot: "consumable" = "consumable";
  protected locallyIdentified = false;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 13 * 49 + 44;
    this.textureKey = "potion-gold";
    this.name = "Potion of Levitation";
    this.description = "Float for 20 world-time units: cross chasms and avoid ground traps, water and grass. If flight ends over a chasm, fall to the next floor and lose one-third of maximum HP (ignores armour, can be lethal). Falling on the final floor is fatal.";
    this.consumable = true;

    this.init(context, x, y);
  }

  equip() {
    const player = this.context.player;
    if (!player) return;

    applyEffect(player, createLevitatingEffect(20));

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
