// TypeScript errors after site migration - ignoring for game functionality
import { Entity, identify, removeEntity } from "../entity";
import type { EntityType } from "../entity";
import type { GameContext } from "../context";
import { rerollCurseId } from "../curses";
import { CURSE_NAMES } from "../curseData";

export default class CursedGem extends Entity {
  name: string = "Cursed Gem";
  description: string =
    "Use to choose a cursed weapon or armor you carry. Its curse is replaced with a different random curse. The gem is consumed.";
  moving: boolean = false;
  type: EntityType = "item";
  tile = 4 * 49 + 22;
  consumable = true;
  requiresItemTarget = true;
  itemTargetTitle = "CURSED GEM: CHOOSE ITEM";
  noItemTargetsMessage = "You have no cursed weapon or armor.";
  tier = 1;
  equipSlot: "consumable" = "consumable";

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.init(context, x, y);
  }

  // Only weapons and armor have enough named curses for a meaningful swap.
  canTargetItem(target: Entity): boolean {
    if (target === this) return false;
    if (!target.cursed) return false;
    if (target.equipSlot !== "weapon" && target.equipSlot !== "armor") return false;
    return !!this.context.player?.getAllItems().includes(target);
  }

  useOnItem(target: Entity): boolean {
    const player = this.context.player;
    if (!player?.canAct() || !player.getAllItems().includes(this) || !this.canTargetItem(target)) {
      return false;
    }

    const nextCurse = rerollCurseId(target);
    if (!nextCurse) {
      return false;
    }

    identify(this);
    identify(target);
    target.curseId = nextCurse;

    const lastGem = this.count === 1;
    player.removeItem(this);
    if (lastGem) removeEntity(this.context, this);
    player.spendTurn("use");

    const curseName = CURSE_NAMES[nextCurse];
    dungeonLog(this.context, `You invoke the Cursed Gem on ${target.displayName}; its curse becomes ${curseName}.`);
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

function dungeonLog(context: GameContext, message: string): void {
  context.messages.unshift(message);
  context.messages = context.messages.slice(0, 20);
}
