import Wand from "./wand";
import type { GameContext } from "../context";
import { createFrozenEffect } from "../effects";

export default class WandOfFrost extends Wand {
  constructor(context: GameContext, x?: number, y?: number) {
    super(
      context,
      {
        name: "Wand of Frost",
        description: "Freezes its target in a blast of ice.",
        tile: 15 * 49 + 43,
        attackTile: 10 * 49 + 18,
        damageType: "ice",
        charges: 3
      },
      x,
      y
    );
  }

  wandDamage() {
    return Phaser.Math.Between(2, 5);
  }

  wandEffect() {
    return createFrozenEffect(1);
  }
}
