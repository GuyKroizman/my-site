import Monster from "./monster";
import type { GameContext } from "../context";
import BerserkPotion from "../items/berserkPotion";
import { applyEffect, createStrengthenedEffect } from "../effects";

export default class Brute extends Monster {
  private enraged = false;

  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Brute",
      description: "A hulking brute. Slow, but hits very hard.",
      textureKey: 'brute',
      healthPoints: 36,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 6,
      attackDamage: 6,
      protection: 1,
      xp: 10,
      range: 0,
      resistance: { physical: 2 },
      loot: [false, false, false, BerserkPotion]
    }, x, y);
  }

  turn() {
    if (this.waitWhileSleeping()) return;
    if (!this.enraged && this.healthPoints < this.maxHealthPoints / 2) {
      this.enraged = true;
      applyEffect(this, createStrengthenedEffect());
    }
    super.turn();
  }
}
