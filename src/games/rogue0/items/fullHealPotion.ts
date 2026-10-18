// TypeScript errors after site migration - ignoring for game functionality
import type { EntityType } from "../entity";
import type { GameContext } from "../context";
import dungeon from "../dungeon";
import { removeEntity , Entity} from "../entity";

export default class FullHealPotion extends Entity {
  name: string = "Full Heal Potion";
  description: string = "That feels refreshing!";
  moving: boolean = false;
  type: EntityType = "item";
  tile = 19 * 49 + 33;
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
    dungeon.log(this.context, `You drink the potion and feel refreshed.`);
    this.context.player.removeItem(this);
    this.context.player.healthPoints  = this.context.player.maxHealthPoints;
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
