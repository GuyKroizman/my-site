import Monster from "./monster";
import type { GameContext } from "../context";
import Shoe from "../items/Shoe";
import { createWeakenedEffect } from "../effects";

export default class Quloptsh extends Monster {
  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Quloptsh",
      description: "A calm, stealthy assassin that weakens its prey.",
      tile: 6 * 49 + 30,
      healthPoints: 6,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 7,
      attackDamage: 1,
      protection: 0,
      evasion: 40,
      xp: 4,
      range: 0,
      loot: [false, Shoe]
    }, x, y);
  }

  onHitEffects() {
    return [createWeakenedEffect(3)];
  }
}
