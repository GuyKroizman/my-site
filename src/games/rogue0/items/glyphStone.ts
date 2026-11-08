import { Entity } from "../entity";
import type { EntityType } from "../entity";

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

  // Subclasses call init() from their own constructor: a concrete class field
  // like textureKey is only initialized after super() returns, so building the
  // sprite here would fall back to the atlas frame instead of the stone art.

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
