import { Entity } from "../entity";
import type { EntityType } from "../entity";
import type { GameContext } from "../context";

// Glyph stones are small rune-carved stones found in trampled grass. They are
// thrown or used once, stack like other consumables, and never leave the
// backpack through the generic "eat/read" path.
export default abstract class GlyphStone extends Entity {
  type: EntityType = "item";
  name = "Glyph Stone";
  description = "A rune-carved stone. Its purpose is not obvious.";
  consumable = true;
  equipSlot: "consumable" = "consumable";
  tier = 1;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.init(context, x, y);
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

  attack() {
    return 0;
  }

  protection() {
    return 0;
  }

  range() {
    return 0;
  }

  onDestroy() {
  }
}
