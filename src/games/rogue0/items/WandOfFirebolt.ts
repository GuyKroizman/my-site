import Wand from "./wand";
import type { GameContext } from "../context";
import { createBurningEffect } from "../effects";

export default class WandOfFirebolt extends Wand {
  constructor(context: GameContext, x?: number, y?: number) {
    super(
      context,
      {
        name: "Wand of Firebolt",
        description: "Hurls a bolt of fire that ignites its target.",
        tile: 15 * 49 + 42,
        attackTile: 10 * 49 + 15,
        damageType: "fire",
        charges: 3
      },
      x,
      y
    );
  }

  get damageBounds(): readonly [number, number] {
    return [3, 6];
  }

  wandEffect() {
    return createBurningEffect(3);
  }
}
