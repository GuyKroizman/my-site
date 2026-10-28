// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity, identify } from "../entity";

export default class ScrollOfIdentify extends Entity {
  name: string = "Scroll of Identify";
  description: string = "Choose one unidentified item in your inventory to reveal its identity.";
  requiresItemTarget = true;
  itemTargetTitle = "IDENTIFY: CHOOSE ITEM";
  noItemTargetsMessage = "You have no other unidentified items.";
  moving: boolean = false;
  type: EntityType = "item";
  tile = 15 * 49 + 35;
  textureKey = "scroll-identify";
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
    return target !== this && !target.identified && !!this.context.player?.getAllItems().includes(target);
  }

  useOnItem(target: Entity): boolean {
    const player = this.context.player;
    if (!player?.canAct() || !player.getAllItems().includes(this) || !this.canTargetItem(target)) return false;

    if (!this.identified) identify(this);
    identify(target);
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
