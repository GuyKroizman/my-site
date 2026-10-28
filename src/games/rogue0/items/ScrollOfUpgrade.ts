// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity, upgrade, identify } from "../entity";
import Wand from "./wand";

export default class ScrollOfUpgrade extends Entity {
  name: string = "Scroll of Upgrade";
  description: string =
    "Choose a weapon, armor, ring, or wand from your equipment or backpack to upgrade. Consumes one scroll and one turn only after you choose.";
  requiresItemTarget = true;
  itemTargetTitle = "UPGRADE: CHOOSE ITEM";
  noItemTargetsMessage = "You have no items that can be upgraded.";
  moving: boolean = false;
  type: EntityType = "item";
  tile = 15 * 49 + 36;
  textureKey = "scroll-upgrade";
  consumable = true;
  protected locallyIdentified = false;
  tier = 1;
  equipSlot: "consumable" = "consumable";

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.init(context, x, y);
  }

  equip() {
    this.context.onChooseItemTarget?.(this);
  }

  canTargetItem(target: Entity): boolean {
    return target !== this && target.level < target.maxLevel &&
      !!this.context.player?.getAllItems().includes(target) &&
      (target.equipSlot === "weapon" || target.equipSlot === "armor" ||
        target.equipSlot === "ring" || target instanceof Wand);
  }

  useOnItem(target: Entity): boolean {
    const player = this.context.player;
    if (!player?.canAct() || !player.getAllItems().includes(this) || !this.canTargetItem(target)) return false;
    identify(this);
    upgrade(target);
    const lastScroll = this.count === 1;
    player.removeItem(this);
    if (lastScroll) removeEntity(this.context, this);
    player.spendTurn("use");
    player.refreshUI();
    return true;
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
