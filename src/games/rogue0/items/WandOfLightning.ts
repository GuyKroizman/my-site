import Wand from "./wand";
import type { GameContext } from "../context";
import { createWeakenedEffect } from "../effects";
import { SHOCKBOLT_TEXTURE } from '../projectileTextures';

export default class WandOfLightning extends Wand {
  constructor(context: GameContext, x?: number, y?: number) {
    super(
      context,
      {
        name: "Wand of Lightning",
        description: "Zaps its target with lightning, weakening their blows. Arcs deal 150% damage to adjacent creatures, including you. Water carries shock through the connected pool. Bottled lightning does not spare its caster.",
        attackTile: 1,
        projectileTexture: SHOCKBOLT_TEXTURE,
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
