import type { EntityType } from "../entity";
import type { GameContext } from "../context";
import { Entity } from "../entity";

export default class BlessedShoe extends Entity {
  name = "Blessed Boot";
  description = "A blessed boot. Carried in the backpack, it will save you from death.";
  type: EntityType = "item";
  textureKey = "blessed-boot";
  tier = 1;
  equipSlot = "junk" as const;
  consumable = false;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.identified = true;
    this.init(context, x, y);
  }

  equip(): void {
  }

  turn(): void {
  }

  refresh(): void {
  }

  isOver(): boolean {
    return true;
  }

  onDestroy(): void {
  }

  damage(): number {
    return 0;
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
}
