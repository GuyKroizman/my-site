import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity } from "../entity";
import { applyEffect, createPotionHealingEffect, cureDebuffs, POTION_HEAL_TICKS } from "../effects";
import { spawnEntityFloatingText } from "../floatingText";
import dungeon from "../dungeon";

// Half of the flask's nominal dose lands on the drink itself so a critical
// hero can survive the incoming round; the rest is banked as Mending. Scaling
// the burst off the nominal dose (not the missing-health cap) keeps it useful
// even when the hero has very few hit points left.
export const POTION_INSTANT_FRACTION = 0.5;

// The dungeon's only healing potion. Flies are the reliable source; floor
// generation hands it out rarely.
export default class PotionOfHealing extends Entity {
  type: EntityType = "item";
  tier = 1;
  equipSlot: "consumable" = "consumable";
  protected locallyIdentified = false;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.textureKey = "potion-red";
    this.name = "Potion of Healing";
    this.description =
      "Restores 80% of your maximum health plus 14: half at once, the rest over several turns. Cures non-permanent debuffs.";
    this.consumable = true;

    this.init(context, x, y);
  }

  equip() {
    const player = this.context.player;
    if (!player) return;

    // 80% of max health plus a flat 14, capped to the health actually
    // missing and to any healing an active flask has already banked. Half of
    // the nominal dose is paid immediately; the remainder keeps mending over
    // the next few turns so a flask drunk mid-fight still does work afterward.
    const total = Math.round(player.maxHealthPoints * 0.8) + 14;
    const missing = Math.max(0, player.maxHealthPoints - player.healthPoints);
    const mending = player.effects.find(effect => effect.id === "potion-healing");
    const banked = mending?.remainingHeal ?? 0;
    const healing = Math.min(total, Math.max(0, missing - banked));

    const instant = Math.min(healing, Math.round(total * POTION_INSTANT_FRACTION));
    if (instant > 0) {
      player.healthPoints = Math.min(player.maxHealthPoints, player.healthPoints + instant);
      spawnEntityFloatingText(player, `+${instant}`, "#6aff6a");
    }
    const residual = healing - instant;
    if (residual > 0) {
      // A second flask adds to an active bank rather than replacing it.
      if (mending) {
        mending.remainingHeal = banked + residual;
        mending.healPerTick = Math.max(1, Math.ceil(mending.remainingHeal / POTION_HEAL_TICKS));
        mending.nextTick = (this.context.simulationTime ?? 0) + 1;
      } else {
        applyEffect(player, createPotionHealingEffect(POTION_HEAL_TICKS, residual));
      }
    }

    dungeon.log(this.context, "You drink the potion and feel its warmth spread through you.");

    const cured = cureDebuffs(player);
    if (cured.length > 0) {
      const list = cured.length === 1
        ? cured[0]
        : `${cured.slice(0, -1).join(", ")} and ${cured[cured.length - 1]}`;
      dungeon.log(this.context, `The potion cleanses your ${list}.`);
    }

    const lastPotion = this.count === 1;
    player.removeItem(this);
    if (lastPotion) removeEntity(this.context, this);
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
