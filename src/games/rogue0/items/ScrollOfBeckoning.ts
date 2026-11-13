import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity } from "../entity";
import dungeon from "../dungeon";

export default class ScrollOfBeckoning extends Entity {
  textureKey = "scroll-beckoning";
  type: EntityType = "item";
  tier = 1;
  equipSlot: "consumable" = "consumable";
  protected locallyIdentified = false;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.name = "Scroll of Beckoning";
    this.description = "Calls every living monster on this floor to the spot where you read it, waking sleepers and mimics. They hunt you if they see you, or resume roaming if they arrive without finding you.";
    this.consumable = true;
    this.init(context, x, y);
  }

  equip() {
    const player = this.context.player;
    if (player?.x === undefined || player.y === undefined) return;

    // Only actors already on the active floor hear the call. Mirror images
    // are stationary illusions, not living monsters.
    for (const monster of this.context.entities) {
      if (monster.type !== "enemy" || monster.healthPoints <= 0 || monster.isDecoy ||
          monster.x === undefined || monster.y === undefined) continue;
      monster.beckon(player.x, player.y);
    }
    dungeon.log(this.context, "A silent call draws every monster on this floor to this spot.");
    player.removeItem(this);
    removeEntity(this.context, this);
  }

  damage() { return 0; }
  turn() {}
  refresh() {}
  isOver() { return true; }
  attack(): number { return 0; }
  protection(): number { return 0; }
  range(): number { return 0; }
  onDestroy() {}
}
