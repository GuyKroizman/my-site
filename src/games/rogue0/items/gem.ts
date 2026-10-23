// TypeScript errors after site migration - ignoring for game functionality
import { Entity, removeEntity, upgrade } from "../entity";
import Shield from "./shield";
import type { EntityType } from "../entity";
import type { GameContext } from "../context";

export default class Gem extends Entity {
  name: string = "Gem";
  description: string = "Consumes one gem to permanently enchant your equipped weapon (+1 damage) or shield (+1 protection). Choose a target below. Costs one turn.";
  type: EntityType = "item";
  tile = 4 * 49 + 23;
  tier = 1;
  equipSlot: "junk" = "junk";

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.init(context, x, y);
  }

  enchant(slot: "weapon" | "armor"): boolean {
    const player = this.context.player;
    if (!player || !player.canAct() || !player.getAllItems().includes(this)) return false;
    const target = player[slot];
    if (!target || (slot === "armor" && !(target instanceof Shield))) return false;

    upgrade(target);
    const lastGem = this.count === 1;
    player.removeItem(this);
    if (lastGem) removeEntity(this.context, this);
    player.spendTurn("use");
    player.refreshUI();
    return true;
  }

  equip() {
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
