import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, identify } from "../entity";
import type { StatusEffect } from "../effects";
import { applyEffect, removeEffect } from "../effects";
import dungeon from "../dungeon";

const HEALS_TO_LEVEL = 15;

export default class ChaliceOfBlood extends Entity {
  name: string = "Chalice of Blood";
  description: string =
    "Regenerates health while equipped, growing stronger as it heals you.";
  type: EntityType = "item";
  tile = 4 * 49 + 29;
  tier = 1;
  equipSlot: "artifact" = "artifact";
  identified = false;

  private bloodProgress = 0;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.init(context, x, y);
  }

  equip() {
    identify(this);
    const player = this.context.player;
    if (player) {
      applyEffect(player, this.regenEffect());
    }
  }

  unequip() {
    const player = this.context.player;
    if (player) {
      removeEffect(player, "chalice-regeneration");
    }
  }

  private regenEffect(): StatusEffect {
    const artifact = this;
    return {
      id: "chalice-regeneration",
      name: "Regeneration",
      iconTile: 13 * 49 + 44,
      duration: Number.POSITIVE_INFINITY,
      manualExpiry: true,
      tick(entity, context) {
        if (entity.healthPoints >= entity.maxHealthPoints) return;

        const amount = 1 + artifact.level;
        entity.healthPoints = Math.min(
          entity.maxHealthPoints,
          entity.healthPoints + amount
        );
        dungeon.log(context, `${entity.name} regenerates ${amount} health.`);

        artifact.bloodProgress += 1;
        if (artifact.bloodProgress >= HEALS_TO_LEVEL) {
          artifact.bloodProgress = 0;
          artifact.level += 1;
          dungeon.log(
            context,
            `${artifact.name} grows stronger (level ${artifact.level}).`
          );
        }
      }
    };
  }

  attack() {
    return 0;
  }

  damage() {
    return 0;
  }

  protection() {
    return 0;
  }

  range() {
    return 0;
  }

  turn() {
  }

  refresh() {
  }

  isOver() {
    return true;
  }

  onDestroy() {
  }
}
