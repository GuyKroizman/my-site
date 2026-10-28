import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity } from "../entity";
import { applyEffect, createPoisonedEffect } from "../effects";

export default class PotionOfToxicGas extends Entity {
  type: EntityType = "item";
  tier = 1;
  equipSlot: "consumable" = "consumable";
  protected locallyIdentified = false;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 13 * 49 + 41;
    this.textureKey = "potion-green";
    this.name = "Potion of Toxic Gas";
    this.description = "Poisons you when drunk and releases a lingering cloud. Throw to fill the impact tile and open cardinal neighbors with gas for 4 time units.";
    this.consumable = true;

    this.init(context, x, y);
  }

  equip() {
    const player = this.context.player;
    if (!player) return;

    applyEffect(player, createPoisonedEffect(4));
    if (player.x !== undefined && player.y !== undefined) this.context.onCreatePoisonGas?.(player.x, player.y);

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
