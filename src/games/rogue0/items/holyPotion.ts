// TypeScript errors after site migration - ignoring for game functionality
import { Entity } from "../entity";
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import dungeon from "../dungeon";
import { removeEntity } from "../entity";

export default class HolyPotion extends Entity {
  name: string = "Holy Potion";
  description: string = "A potion that removes cursed items when equipped.";
  moving: boolean = false;
  type: EntityType = "item";
  tile = 13 * 49 + 32;
  textureKey = "potion-gold";
  tier = 1;
  equipSlot: "consumable" = "consumable";

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.consumable = true;
    this.init(context, x, y);
  }

  equip() {
    if (!this.context.player) {
      return;
    }
    dungeon.log(this.context, `A blessing passes through your body and lifts every curse.`);
    this.context.player.removeCurse();
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
