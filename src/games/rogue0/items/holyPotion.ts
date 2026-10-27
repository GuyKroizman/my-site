// TypeScript errors after site migration - ignoring for game functionality
import { Entity, identify } from "../entity";
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import dungeon from "../dungeon";
import { removeEntity } from "../entity";

export default class HolyPotion extends Entity {
  name: string = "Holy Potion";
  description: string = "Choose one cursed item in your inventory to cleanse. The item is kept, and its curse is lifted.";
  requiresItemTarget = true;
  moving: boolean = false;
  type: EntityType = "item";
  tile = 13 * 49 + 32;
  textureKey = "potion-gold";
  tier = 1;
  equipSlot: "consumable" = "consumable";

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.consumable = true;
    this.init(context, x, y);
  }

  equip() {
    this.context.onChooseItemTarget?.(this);
  }

  canTargetItem(target: Entity): boolean {
    return target !== this && target.cursed && !!this.context.player?.getAllItems().includes(target);
  }

  useOnItem(target: Entity): boolean {
    const player = this.context.player;
    if (!player?.canAct() || !player.getAllItems().includes(this) || !this.canTargetItem(target)) return false;
    identify(this);
    player.removeCurse(target);
    identify(target);
    const lastPotion = this.count === 1;
    player.removeItem(this);
    if (lastPotion) removeEntity(this.context, this);
    dungeon.log(this.context, `You cleanse ${target.displayName} with the Holy Potion.`);
    player.spendTurn('use');
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
