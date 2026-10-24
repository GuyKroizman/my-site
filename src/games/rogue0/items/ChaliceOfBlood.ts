import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, identify } from "../entity";
import type { StatusEffect } from "../effects";
import { applyEffect, removeEffect } from "../effects";
import dungeon from "../dungeon";

// Only ticks that actually restore health count. Each successive level takes
// longer: 60, 120, then 180 healing ticks, rather than 15 at every level.
const HEALS_PER_LEVEL = 60;
export const CHALICE_MAX_LEVEL = 3;

export default class ChaliceOfBlood extends Entity {
  name: string = "Chalice of Blood";
  description: string =
    "Regenerates health while equipped, growing stronger as it heals you.";
  type: EntityType = "item";
  textureKey = "chalice-of-blood";
  maxLevel = CHALICE_MAX_LEVEL;
  tier = 1;
  equipSlot: "artifact" = "artifact";
  identified = false;

  private bloodProgress = 0;

  get unidentifiedTextureKey(): string {
    return this.spriteTextureKey;
  }

  get healingAmount(): number {
    return 1 + Math.min(this.level, this.maxLevel);
  }

  get healsToNextLevel(): number {
    return HEALS_PER_LEVEL * (this.level + 1);
  }

  get displayDescription(): string {
    const progress = this.level >= this.maxLevel
      ? "Maximum level reached."
      : `${this.bloodProgress}/${this.healsToNextLevel} healing ticks toward the next level.`;
    return `Regenerates up to ${this.healingAmount} health per world turn while equipped. ${progress} Level cap: +${this.maxLevel} (${1 + this.maxLevel} health per turn).`;
  }

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

        const amount = Math.min(artifact.healingAmount, entity.maxHealthPoints - entity.healthPoints);
        entity.healthPoints += amount;
        dungeon.log(context, `${entity.name} regenerates ${amount} health.`);

        if (artifact.level >= artifact.maxLevel) return;
        artifact.bloodProgress += 1;
        if (artifact.bloodProgress >= artifact.healsToNextLevel) {
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
