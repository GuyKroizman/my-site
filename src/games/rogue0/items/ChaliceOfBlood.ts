import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, identify } from "../entity";
import type { StatusEffect } from "../effects";
import { applyEffect, removeEffect } from "../effects";
import dungeon from "../dungeon";

const KILLS_PER_LEVEL = 5;
export const CHALICE_MAX_LEVEL = 10;

export default class ChaliceOfBlood extends Entity {
  name: string = "Chalice of Blood";
  description: string =
    "Slowly regenerates health while equipped, growing stronger as you defeat monsters.";
  type: EntityType = "item";
  textureKey = "chalice-of-blood";
  level = 1;
  maxLevel = CHALICE_MAX_LEVEL;
  tier = 1;
  equipSlot: "artifact" = "artifact";
  protected locallyIdentified = false;

  private bloodProgress = 0;
  private healingTurns = 0;

  get unidentifiedTextureKey(): string {
    return this.spriteTextureKey;
  }

  get healingInterval(): number {
    return 11 - Math.max(1, Math.min(this.level, this.maxLevel));
  }

  get killsToNextLevel(): number {
    return KILLS_PER_LEVEL * this.level;
  }

  onMonsterKilled(): void {
    if (this.context.player?.artifact !== this || this.level >= this.maxLevel) return;
    this.bloodProgress += 1;
    if (this.bloodProgress >= this.killsToNextLevel) {
      this.bloodProgress = 0;
      this.level += 1;
      dungeon.log(this.context, `${this.name} grows stronger (level ${this.level}).`);
    }
  }

  get baseDescription(): string {
    const progress = this.level >= this.maxLevel
      ? "Maximum level reached."
      : `${this.bloodProgress}/${this.killsToNextLevel} monster kills while equipped toward the next level.`;
    return `Level ${this.level}/${this.maxLevel}. Regenerates 1 health every ${this.healingInterval} world turn${this.healingInterval === 1 ? "" : "s"} while equipped. ${progress} At level 10: 1 health per turn.`;
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

  // Rebuilt on browser resume so the tick callback targets the restored artifact.
  regenEffect(): StatusEffect {
    const artifact = this;
    return {
      id: "chalice-regeneration",
      name: "Regeneration",
      iconTile: 13 * 49 + 44,
      duration: Number.POSITIVE_INFINITY,
      manualExpiry: true,
      tick(entity) {
        // Do not bank healing at full health or accelerate it by re-equipping.
        if (entity.healthPoints >= entity.maxHealthPoints) {
          artifact.healingTurns = 0;
          return;
        }
        artifact.healingTurns += 1;
        if (artifact.healingTurns < artifact.healingInterval) return;
        artifact.healingTurns = 0;

        const amount = Math.min(1, entity.maxHealthPoints - entity.healthPoints);
        entity.healthPoints += amount;
        // Routine healing is reflected in the health display.

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
