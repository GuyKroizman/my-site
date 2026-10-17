import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity } from "../entity";
import dungeon from "../dungeon";
import Wand from "./wand";

export default class ScrollOfRecharging extends Entity {
  type: EntityType = "item";
  tier = 1;
  equipSlot: "consumable" = "consumable";
  identified = false;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 15 * 49 + 41;
    this.name = "Scroll of Recharging";
    this.description = "Refills the charges of your equipped wand.";
    this.consumable = true;

    this.init(context, x, y);
  }

  equip() {
    const player = this.context.player;
    if (!player) return;

    if (player.weapon instanceof Wand) {
      player.weapon.refill();
      dungeon.log(this.context, "Your wand is fully recharged.");
    } else {
      dungeon.log(this.context, "You have no wand equipped.");
    }

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
