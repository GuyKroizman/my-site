import Monster from "./monster";
import type { GameContext } from "../context";
import Gem from "../items/gem";
import HolyPotion from "../items/holyPotion";
import { createBleedingEffect } from "../effects";

export default class Archer extends Monster {
  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Archer",
      description: "A skeleton archer. Shoots bolts from a distance.",
      tile: 6 * 49 + 24,
      healthPoints: 6,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 8,
      attackDamage: 2,
      protection: 0,
      evasion: 20,
      xp: 5,
      range: 5,
      attackTile: 10 * 49 + 15,
      loot: [false, Gem, HolyPotion]
    }, x, y);
  }

  onHitEffects() {
    return [createBleedingEffect(3)];
  }
}
