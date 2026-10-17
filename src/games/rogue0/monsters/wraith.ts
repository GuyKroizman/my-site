import Monster from "./monster";
import type { GameContext } from "../context";
import { createWeakenedEffect } from "../effects";

export default class Wraith extends Monster {
  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Wraith",
      description: "A spectral horror that weakens those it touches.",
      tile: 6 * 49 + 14,
      healthPoints: 7,
      movementPoints: 1,
      actionPoints: 1,
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
