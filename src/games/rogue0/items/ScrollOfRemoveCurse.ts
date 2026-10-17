// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity } from "../entity";

export default class ScrollOfRemoveCurse extends Entity {
  name: string = "Scroll of Remove Curse";
  description: string = "Lifts every curse on your equipment.";
  moving: boolean = false;
  type: EntityType = "item";
  tile = 15 * 49 + 37;
  consumable = true;
  identified = false;
  tier = 1;
  equipSlot: "consumable" = "consumable";

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.init(context, x, y);
  }

  equip() {
    const player = this.context.player;
    if (!player) return;

    player.removeCurse();
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
