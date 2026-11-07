import StoneOfBlink from "./items/stoneOfBlink";
import StoneOfDetectCurse from "./items/stoneOfDetectCurse";
import type { Entity } from "./entity";
import type { GameContext } from "./context";

// Each tall-grass tile the hero tramples has one independent roll. Twelve
// percent keeps glyph stones a discovery rather than a supply, while a floor's
// several grass patches still give the mechanic a chance to appear.
export const GLYPH_STONE_TRAMPLE_CHANCE = 0.12;

export type GlyphStoneKind = "blink" | "detect-curse";

// Two random draws: first whether grass hides anything, then which rune. Kept
// separate from Entity construction so the odds are testable without Phaser.
export function rollGlyphStoneKind(
  random: () => number = Math.random
): GlyphStoneKind | undefined {
  if (random() >= GLYPH_STONE_TRAMPLE_CHANCE) return undefined;
  return random() < 0.5 ? "blink" : "detect-curse";
}

export function createGlyphStone(
  context: GameContext,
  kind: GlyphStoneKind,
  x?: number,
  y?: number
): Entity {
  return kind === "blink"
    ? new StoneOfBlink(context, x, y)
    : new StoneOfDetectCurse(context, x, y);
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
