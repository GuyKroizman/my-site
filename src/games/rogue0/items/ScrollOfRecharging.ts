import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity } from "../entity";
import dungeon from "../dungeon";
import Wand from "./wand";

export default class ScrollOfRecharging extends Entity {
  textureKey = "scroll-recharging";
  type: EntityType = "item";
  tier = 1;
  equipSlot: "consumable" = "consumable";
  protected locallyIdentified = false;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.name = "Scroll of Recharging";
    this.description = "Refills the charges of every wand you carry.";
    this.consumable = true;

    this.init(context, x, y);
  }

  equip() {
    const player = this.context.player;
    if (!player) return;

    // Wands live in the backpack (or a quickslot), never in the weapon slot,
    // and passive recharge already ticks every carried wand independently.
    // Do the same here: refill all of them, including cursed and fused wands.
    const wands = player.getAllItems().filter((item): item is Wand => item instanceof Wand);
    if (wands.length > 0) {
      for (const wand of wands) wand.refill();
      dungeon.log(this.context, wands.length === 1
        ? "Your wand is fully recharged."
        : "Your wands are fully recharged.");
    } else {
      dungeon.log(this.context, "You have no wand to recharge.");
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
