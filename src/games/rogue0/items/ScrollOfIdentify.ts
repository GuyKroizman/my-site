// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity, identify } from "../entity";
import dungeon from "../dungeon";

export default class ScrollOfIdentify extends Entity {
  name: string = "Scroll of Identify";
  description: string = "Reveals the identity of one of your items.";
  moving: boolean = false;
  type: EntityType = "item";
  tile = 15 * 49 + 35;
  textureKey = "scroll-identify";
  consumable = true;
  identified = false;
  tier = 1;
  equipSlot: "consumable" = "consumable";

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.init(context, x, y);
  }

  // Identifies itself (normally already done by useItem), then the first
  // unidentified item in the player's possession.
  equip() {
    const player = this.context.player;
    if (!player) return;

    if (!this.identified) {
      identify(this);
    }

    const target = player
      .getAllItems()
      .find((item) => !item.identified && item !== this);

    if (target) {
      identify(target);
    } else {
      dungeon.log(this.context, "You have no other unidentified items.");
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
