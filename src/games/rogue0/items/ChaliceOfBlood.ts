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
  private drainingTurns = 0;

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
    const pulse = this.cursed
      ? `Drains 1 health every ${this.healingInterval} world turn${this.healingInterval === 1 ? "" : "s"} while equipped.`
      : `Regenerates 1 health every ${this.healingInterval} world turn${this.healingInterval === 1 ? "" : "s"} while equipped.`;
    return `Level ${this.level}/${this.maxLevel}. ${pulse} ${progress} At level 10: 1 health per turn.`;
  }

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.init(context, x, y);
  }

  equip() {
    identify(this);
    const player = this.context.player;
    if (player) {
      applyEffect(player, this.cursed ? this.drainEffect() : this.regenEffect());
    }
  }

  unequip() {
    const player = this.context.player;
    if (player) {
      removeEffect(player, "chalice-regeneration");
      removeEffect(player, "chalice-drain");
    }
  }

  // Lifting the curse while the chalice is equipped swaps the active drain back
  // to its normal regeneration pulse.
  onUncursed(): void {
    if (this.context.player?.artifact !== this) return;
    removeEffect(this.context.player, "chalice-drain");
    applyEffect(this.context.player, this.regenEffect());
  }

  // Rebuilt on browser resume so the tick callback targets the restored artifact.
  regenEffect(): StatusEffect {
    return {
      id: "chalice-regeneration",
      name: "Regeneration",
      iconTile: 13 * 49 + 44,
      duration: Number.POSITIVE_INFINITY,
      manualExpiry: true,
      tick: (entity) => {
        // Do not bank healing at full health or accelerate it by re-equipping.
        if (entity.healthPoints >= entity.maxHealthPoints) {
          this.healingTurns = 0;
          return;
        }
        this.healingTurns += 1;
        if (this.healingTurns < this.healingInterval) return;
        this.healingTurns = 0;

        const amount = Math.min(1, entity.maxHealthPoints - entity.healthPoints);
        entity.healthPoints += amount;
        // Routine healing is reflected in the health display.

      }
    };
  }

  // Cursed chalices invert their pulse: instead of regenerating, they drain.
  drainEffect(): StatusEffect {
    return {
      id: "chalice-drain",
      name: "Life Drain",
      iconTile: 13 * 49 + 44,
      duration: Number.POSITIVE_INFINITY,
      manualExpiry: true,
      tick: (entity) => {
        this.drainingTurns += 1;
        if (this.drainingTurns < this.healingInterval) return;
        this.drainingTurns = 0;
        entity.takeDamage(1);
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
