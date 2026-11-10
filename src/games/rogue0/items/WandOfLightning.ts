import Wand from "./wand";
import type { GameContext } from "../context";
import { createWeakenedEffect } from "../effects";

export default class WandOfLightning extends Wand {
  constructor(context: GameContext, x?: number, y?: number) {
    super(
      context,
      {
        name: "Wand of Lightning",
        description: "Zaps its target with lightning, weakening their blows. Arcs deal 150% damage to adjacent creatures, including you. Water carries shock through the connected pool. Bottled lightning does not spare its caster.",
        tile: 15 * 49 + 44,
        attackTile: 10 * 49 + 19,
        damageType: "shock",
        charges: 3
      },
      x,
      y
    );
  }

  get damageBounds(): readonly [number, number] {
    return [2, 6];
  }

  wandEffect() {
    return createWeakenedEffect(3);
  }

  arcsToAdjacent(): boolean {
    return true;
  }
}
