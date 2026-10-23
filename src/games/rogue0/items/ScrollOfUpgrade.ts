// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity, upgrade } from "../entity";
import dungeon from "../dungeon";

export default class ScrollOfUpgrade extends Entity {
  name: string = "Scroll of Upgrade";
  description: string =
    "Upgrades your equipped weapon, or your armor if you have no weapon.";
  moving: boolean = false;
  type: EntityType = "item";
  tile = 15 * 49 + 36;
  textureKey = "scroll-upgrade";
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

    if (player.weapon) {
      upgrade(player.weapon);
    } else if (player.armor) {
      upgrade(player.armor);
    } else {
      dungeon.log(this.context, "Nothing to upgrade.");
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
