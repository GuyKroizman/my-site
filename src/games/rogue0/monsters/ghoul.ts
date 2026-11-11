import Monster from "./monster";
import type { GameContext } from "../context";
import { applyEffect, createBleedingEffect, createRegenerationEffect, hasEffect } from "../effects";

export default class Ghoul extends Monster {
  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Ghoul",
      description: "A fast, ravenous ghoul.",
      tile: 0,
      textureKey: 'ghoul',
      healthPoints: 12,
      movementSpeed: 2,
      attackDelay: 1,
      visionRadius: 8,
      attackDamage: 2,
      protection: 0,
      xp: 5,
      range: 0,
      vulnerability: { fire: 1 },
      loot: [false, false, false, false]
    }, x, y);
  }

  turn() {
    if (this.waitWhileSleeping()) return;
    if (!hasEffect(this, "regeneration")) {
      applyEffect(this, createRegenerationEffect());
    }
    super.turn();
  }

  onHitEffects() {
    return [createBleedingEffect(2)];
  }
}
