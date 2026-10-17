import Monster from "./monster";
import type { GameContext } from "../context";
import Gem from "../items/gem";

export default class Mimic extends Monster {
  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Mimic",
      description: "A treasure chest that lunges at the unwary.",
      tile: 6 * 49 + 33,
      healthPoints: 4,
      movementPoints: 1,
      actionPoints: 1,
      visionRadius: 2,
      attackDamage: 6,
      protection: 0,
      xp: 8,
      range: 0,
      loot: [Gem, Gem]
    }, x, y);
  }
}
