// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity, identify } from "../entity";

export default class ScrollOfRemoveCurse extends Entity {
  name: string = "Scroll of Remove Curse";
  description: string = "Choose one item you carry to lift its curse. A curse-free item wastes the scroll.";
  requiresItemTarget = true;
  itemTargetTitle = "REMOVE CURSE: CHOOSE ITEM";
  noItemTargetsMessage = "You have no other items to cleanse.";
  moving: boolean = false;
  type: EntityType = "item";
  tile = 15 * 49 + 37;
  textureKey = "scroll-remove-curse";
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

  // Every carried item is a legal target, cursed or not. Validating the curse
  // here would dim the clean items and hand the player the curse state the
  // unidentified-item rules are meant to keep secret, so a wrong guess simply
  // wastes the scroll.
  canTargetItem(target: Entity): boolean {
    return target !== this && !!this.context.player?.getAllItems().includes(target);
  }

  useOnItem(target: Entity): boolean {
    const player = this.context.player;
    if (!player?.canAct() || !player.getAllItems().includes(this) || !this.canTargetItem(target)) return false;

    // Reading the scroll reveals the scroll, nothing else: the item keeps its
    // unidentified properties and either loses its curse or wastes the scroll.
    if (!this.identified) identify(this);
    player.removeCurse(target);
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
