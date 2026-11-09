import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity } from "../entity";
import { applyEffect, createPotionHealingEffect, cureDebuffs, POTION_HEAL_TICKS } from "../effects";
import dungeon from "../dungeon";

// The dungeon's only healing potion. Flies are the reliable source; floor
// generation hands it out rarely.
export default class PotionOfHealing extends Entity {
  type: EntityType = "item";
  tier = 1;
  equipSlot: "consumable" = "consumable";
  protected locallyIdentified = false;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 13 * 49 + 38;
    this.textureKey = "potion-red";
    this.name = "Potion of Healing";
    this.description =
      "Restores 80% of your maximum health plus 14, spread over several turns, and cures non-permanent debuffs.";
    this.consumable = true;

    this.init(context, x, y);
  }

  equip() {
    const player = this.context.player;
    if (!player) return;

    // 80% of max health plus a flat 14, delivered over the next ten time
    // units. Only missing health is banked, and health already banked by an
    // active flask counts toward it, so a flask drunk at full health (or on
    // top of enough pending healing) is not a delayed full heal.
    const total = Math.round(player.maxHealthPoints * 0.8) + 14;
    const missing = Math.max(0, player.maxHealthPoints - player.healthPoints);
    const mending = player.effects.find(effect => effect.id === "potion-healing");
    const banked = mending?.remainingHeal ?? 0;
    const healing = Math.min(total, Math.max(0, missing - banked));

    dungeon.log(this.context, "You drink the potion and feel its warmth spread through you.");
    if (healing > 0) {
      // A second flask adds to an active bank rather than replacing it.
      if (mending) {
        mending.remainingHeal = banked + healing;
        mending.healPerTick = Math.max(mending.healPerTick ?? 1,
          Math.ceil(healing / POTION_HEAL_TICKS));
        mending.nextTick = (this.context.simulationTime ?? 0) + 1;
      } else {
        applyEffect(player, createPotionHealingEffect(POTION_HEAL_TICKS, healing));
      }
    }

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
