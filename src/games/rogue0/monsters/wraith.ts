import Monster from "./monster";
import type { GameContext } from "../context";
import { createWeakenedEffect } from "../effects";
import { WRAITH_TEXTURE, generateWraithTexture } from "./wraithTexture";

export default class Wraith extends Monster {
  constructor(context: GameContext, x?: number, y?: number) {
    if (context.scene) generateWraithTexture(context.scene);
    super(context, {
      name: "Wraith",
      description: "A spectral horror that weakens those it touches.",
      tile: 0,
      textureKey: WRAITH_TEXTURE,
      healthPoints: 7,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 7,
      attackDamage: 2,
      protection: 0,
      evasion: 40,
      xp: 9,
      range: 0,
      resistance: { physical: 1 }
    }, x, y);

    this.damageType = "magic";
  }

  onHitEffects() {
    return [createWeakenedEffect(3)];
  }
}
