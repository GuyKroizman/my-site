import Monster from "./monster";
import type { GameContext } from "../context";
import Gem from "../items/gem";
import { createBleedingEffect } from "../effects";

export default class Ghoul extends Monster {
  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Ghoul",
      description: "A fast, ravenous ghoul.",
      tile: 6 * 49 + 26,
      healthPoints: 6,
      movementPoints: 2,
      actionPoints: 1,
      visionRadius: 8,
      attackDamage: 1,
      protection: 0,
      xp: 5,
      range: 0,
      vulnerability: { fire: 1 },
      loot: [false, false, Gem]
    }, x, y);
  }

  onHitEffects() {
    return [createBleedingEffect(2)];
  }
}
