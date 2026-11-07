import GlyphStone from "./glyphStone";
import { GLYPH_STONE_TEXTURES } from "../glyphStoneTextures";
import { removeEntity } from "../entity";
import dungeon from "../dungeon";
import type { Entity } from "../entity";

export default class StoneOfDetectCurse extends GlyphStone {
  name = "Stone of Detect Curse";
  description =
    "Use it on one unidentified item to learn whether it is cursed, without identifying it.";
  textureKey = GLYPH_STONE_TEXTURES.detectCurse;
  requiresItemTarget = true;
  itemTargetTitle = "DETECT CURSE: CHOOSE ITEM";
  noItemTargetsMessage = "You have no unidentified items to examine.";

  equip() {
    this.context.onChooseItemTarget?.(this);
  }

  // Only unidentified items whose curse state is still secret are valid.
  canTargetItem(target: Entity): boolean {
    return target !== this && !target.identified && !target.curseScanned &&
      !!this.context.player?.getAllItems().includes(target);
  }

  useOnItem(target: Entity): boolean {
    const player = this.context.player;
    if (!player?.canAct() || !player.getAllItems().includes(this) ||
        !this.canTargetItem(target)) return false;

    // Record the answer, not the identity. Every later inspection of the item
    // keeps the same glyph-stone verdict until the item is identified.
    target.curseScanned = true;

    const lastStone = this.count === 1;
    player.removeItem(this);
    if (lastStone) removeEntity(this.context, this);
    player.spendTurn("use");

    dungeon.log(this.context,
      `The glyph stone reveals that ${target.displayName} is ${target.cursed ? "cursed" : "free of curse"}.`);
    return true;
  }
}
