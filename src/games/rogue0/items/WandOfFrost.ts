import Wand from "./wand";
import type { GameContext } from "../context";
import { createChilledEffect, createFrozenEffect } from "../effects";
import { Sheet } from '../spriteFrames.ts';

export default class WandOfFrost extends Wand {
  constructor(context: GameContext, x?: number, y?: number) {
    super(
      context,
      {
        name: "Wand of Frost",
        description: "Freezes its target in a blast of ice.",
        tile: Sheet.wandOfFrost,
        attackTile: Sheet.frostProjectile,
        damageType: "ice",
        charges: 3
      },
      x,
      y
    );
  }

  get damageBounds(): readonly [number, number] {
    return [2, 5];
  }

  // Single-effect callers still get the freeze; a zap carries both halves.
  wandEffect() {
    return createFrozenEffect(1);
  }

  // Frost magic always carries both halves: the skipped action (which the
  // victim's recovery window may block) and the lasting slow.
  wandEffects() {
    return [this.wandEffect(), createChilledEffect()];
  }
}
