// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity } from "../entity";
import dungeon from "../dungeon";

export default class MinorHealPotion extends Entity {
  type: EntityType = "item";
  tier = 1;
  equipSlot: "consumable" = "consumable";

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 13 * 49 + 37;
    this.name = "Minor Heal Potion";
    this.description = "A potion that restores a small amount of health.";
    this.consumable = true;

    this.init(context, x, y);
  }

  equip() {
    if (!this.context.player) {
      return;
    }
    const points = Phaser.Math.Between(3, 5)

    dungeon.log(this.context, `A warm feeling when drinking the potion as it restores ${points} health points.`)

    this.context.player.healthPoints = Math.min(
      this.context.player.maxHealthPoints,
      this.context.player.healthPoints + points
    );
    this.context.player.removeItem(this);
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
