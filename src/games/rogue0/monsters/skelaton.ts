import Monster from "./monster";
import type { GameContext } from "../context";
import Gem from "../items/gem";
import HolyPotion from "../items/holyPotion";
import BerserkPotion from "../items/berserkPotion";

export default class Skeleton extends Monster {
  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Skeleton",
      description: "A brittle skeleton animated by dark magic.",
      tile: 6 * 49 + 29,
      healthPoints: 4,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 7,
      attackDamage: 1,
      protection: 0,
      xp: 2,
      range: 0,
      loot: [false, false, false, false, Gem, HolyPotion, BerserkPotion]
    }, x, y);
  }
}
