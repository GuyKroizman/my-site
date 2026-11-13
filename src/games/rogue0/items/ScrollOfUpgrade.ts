// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity, upgrade, identify } from "../entity";
import Wand from "./wand";

export default class ScrollOfUpgrade extends Entity {
  name: string = "Scroll of Upgrade";
  description: string =
    "Use to choose a weapon, armor, ring, or wand to upgrade. For physical weapons and armor, curse removal and glyph erasure each roll independently: 10% at +1, 20% at +2, increasing by 10 percentage points per resulting upgrade level, up to 100% at +10 and above. The upgrade level always increases.";
  requiresItemTarget = true;
  itemTargetTitle = "UPGRADE: CHOOSE ITEM";
  noItemTargetsMessage = "You have no items that can be upgraded.";
  moving: boolean = false;
  type: EntityType = "item";
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
