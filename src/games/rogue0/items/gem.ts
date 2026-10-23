// TypeScript errors after site migration - ignoring for game functionality
import { Entity, removeEntity, upgrade } from "../entity";
import Shield from "./shield";
import type { EntityType } from "../entity";
import type { GameContext } from "../context";

export default class Gem extends Entity {
  name: string = "Gem";
  description: string = "Use to choose a weapon (+1 damage) or shield (+1 protection) to permanently enchant. Consumes one gem and one turn only when you choose equipment.";
  consumable = true;
  type: EntityType = "item";
  tile = 4 * 49 + 23;
  tier = 1;
  equipSlot: "junk" = "junk";

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.init(context, x, y);
  }

  canEnchant(target: Entity): boolean {
    return target.equipSlot === "weapon" || target instanceof Shield;
  }

  enchant(target: Entity): boolean {
    const player = this.context.player;
    if (!player || !player.canAct() || !player.getAllItems().includes(this)) return false;
    if (!player.getAllItems().includes(target) || !this.canEnchant(target)) return false;

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
