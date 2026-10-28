import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity } from "../entity";
import dungeon from "../dungeon";

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
    this.description = "Restores roughly a third of your maximum health.";
    this.consumable = true;

    this.init(context, x, y);
  }

  equip() {
    const player = this.context.player;
    if (!player) return;

    const heal = Math.max(1, Math.round(player.maxHealthPoints / 3));
    player.healthPoints = Math.min(
      player.maxHealthPoints,
      player.healthPoints + heal
    );
    dungeon.log(this.context, `You drink the potion and recover ${heal} health.`);

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
