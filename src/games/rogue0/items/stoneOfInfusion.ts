import GlyphStone from "./glyphStone";
import { GLYPH_STONE_TEXTURES } from "../glyphStoneTextures";
import { removeEntity } from "../entity";
import { rollRandomGlyph, equipmentGlyphName } from "../equipmentGlyphs";
import dungeon from "../dungeon";
import type { Entity } from "../entity";
import type { GameContext } from "../context";

// The rarest of the trampled-grass stones. Unlike Blink and Detect Curse, it
// does not act on its own: choose one physical weapon or armor and it etches a
// random glyph into the gear, giving it a permanent special ability.
export default class StoneOfInfusion extends GlyphStone {
  name = "Stone of Infusion";
  description =
    "Use it on one weapon or armor to infuse a random glyph. A weapon can gain Fire, Frost, Luck, Reach or Push; armor can gain Thorns or Push. Each item can hold only one glyph.";
  textureKey = GLYPH_STONE_TEXTURES.infuse;
  requiresItemTarget = true;
  itemTargetTitle = "INFUSE: CHOOSE WEAPON OR ARMOR";
  noItemTargetsMessage = "You have no weapon or armor that can be infused.";

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.init(context, x, y);
  }

  equip() {
    this.context.onChooseItemTarget?.(this);
  }

  // Only physical weapons/armor without a glyph are valid. The infuse stone
  // never overwrites an existing glyph.
  canTargetItem(target: Entity): boolean {
    return target !== this && !target.glyph &&
      !!this.context.player?.getAllItems().includes(target) &&
      (target.equipSlot === "weapon" || target.equipSlot === "armor") &&
      !/^scroll/i.test(target.name);
  }

  useOnItem(target: Entity): boolean {
    const player = this.context.player;
    if (!player?.canAct() || !player.getAllItems().includes(this) ||
        !this.canTargetItem(target)) return false;

    const glyph = rollRandomGlyph(target);
    if (!glyph) return false;
    target.glyph = glyph;

    const lastStone = this.count === 1;
    player.removeItem(this);
    if (lastStone) removeEntity(this.context, this);
    player.spendTurn("use");

    dungeon.log(this.context,
      `The infuse stone etches a ${equipmentGlyphName(glyph)} glyph onto ${target.displayName}.`);
    return true;
  }
}
