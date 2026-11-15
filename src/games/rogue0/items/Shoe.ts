import type { EntityType } from "../entity";
import type { GameContext } from "../context";
import { Entity } from "../entity";

// Repurposed revival item. Kept under the historical save-registry/file ID.
export default class Shoe extends Entity {
  name = "Boot";
  description = "A strange boot. Carried in the backpack, it will save you from death.";
  moving = false;
  type: EntityType = "item";
  textureKey = "junk-boot";
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
