import StoneOfBlink from "./items/stoneOfBlink";
import StoneOfDetectCurse from "./items/stoneOfDetectCurse";
import StoneOfInfusion from "./items/stoneOfInfusion";
import type { Entity } from "./entity";
import type { GameContext } from "./context";

// Each tall-grass tile the hero tramples has one independent roll. Twelve
// percent keeps glyph stones a discovery rather than a supply, while a floor's
// several grass patches still give the mechanic a chance to appear.
export const GLYPH_STONE_TRAMPLE_CHANCE = 0.12;

// The infuse stone is much rarer than Blink or Detect Curse. It shares the
// 12% trample roll, but takes only this share (0.24% per grass tile).
export const INFUSE_STONE_SHARE = 0.02;

export type GlyphStoneKind = "blink" | "detect-curse" | "infuse";

// Two random draws: first whether grass hides anything, then which rune. Kept
// separate from Entity construction so the odds are testable without Phaser.
export function rollGlyphStoneKind(
  random: () => number = Math.random
): GlyphStoneKind | undefined {
  if (random() >= GLYPH_STONE_TRAMPLE_CHANCE) return undefined;
  const kindRoll = random();
  if (kindRoll < INFUSE_STONE_SHARE) return "infuse";
  // The remaining 98% splits evenly between Blink and Detect Curse.
  return kindRoll < 0.5 + INFUSE_STONE_SHARE / 2 ? "blink" : "detect-curse";
}

export function createGlyphStone(
  context: GameContext,
  kind: GlyphStoneKind,
  x?: number,
  y?: number
): Entity {
  if (kind === "blink") return new StoneOfBlink(context, x, y);
  if (kind === "infuse") return new StoneOfInfusion(context, x, y);
  return new StoneOfDetectCurse(context, x, y);
}

// The find stays on the trampled tile instead of jumping into the backpack. The
// hero is standing on that tile, so the normal walk-onto-item pickup applies
// once they step off and back; a full backpack needs no special case.
export function dropTrampledGlyphStone(
  context: GameContext,
  x: number,
  y: number,
  random: () => number = Math.random
): Entity | undefined {
  const kind = rollGlyphStoneKind(random);
  if (!kind) return undefined;
  const stone = createGlyphStone(context, kind, x, y);
  context.entities.push(stone);
  return stone;
}
