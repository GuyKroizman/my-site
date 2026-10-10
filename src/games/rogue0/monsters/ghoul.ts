// @ts-nocheck
import Monster from "./monster";
import type { GameContext } from "../context";
import Gem from "../items/gem";

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
      range: 0,
      loot: [false, false, Gem]
    }, x, y);
  }
}
