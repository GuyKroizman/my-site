import Wand from "./wand";
import type { GameContext } from "../context";
import { createWeakenedEffect } from "../effects";

export default class WandOfLightning extends Wand {
  constructor(context: GameContext, x?: number, y?: number) {
    super(
      context,
      {
        name: "Wand of Lightning",
        description: "Zaps its target with lightning, weakening their blows.",
        tile: 15 * 49 + 44,
        attackTile: 10 * 49 + 19,
        damageType: "shock",
        charges: 3
      },
      x,
      y
    );
  }

  wandDamage() {
    return Phaser.Math.Between(2, 6);
  }

  wandEffect() {
    return createWeakenedEffect(3);
  }
}
