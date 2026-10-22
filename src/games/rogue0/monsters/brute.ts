import Monster from "./monster";
import type { GameContext } from "../context";
import Gem from "../items/gem";
import HolyPotion from "../items/holyPotion";
import BerserkPotion from "../items/berserkPotion";
import { applyEffect, createStrengthenedEffect } from "../effects";

export default class Brute extends Monster {
  private enraged = false;

  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Brute",
      description: "A hulking brute. Slow, but hits very hard.",
      tile: 6 * 49 + 28,
      healthPoints: 18,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 6,
      attackDamage: 3,
      protection: 1,
      xp: 10,
      range: 0,
      resistance: { physical: 2 },
      loot: [false, Gem, HolyPotion, BerserkPotion]
    }, x, y);
  }

  turn() {
    if (!this.enraged && this.healthPoints < this.maxHealthPoints / 2) {
      this.enraged = true;
      applyEffect(this, createStrengthenedEffect());
    }
    super.turn();
  }
}
