// @ts-nocheck
import Monster from "./monster";
import type { GameContext } from "../context";
import Gem from "../items/gem";
import HolyPotion from "../items/holyPotion";
import BerserkPotion from "../items/berserkPotion";

export default class Brute extends Monster {
  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Brute",
      description: "A hulking brute. Slow, but hits very hard.",
      tile: 6 * 49 + 29,
      tint: 0x9944ff,
      healthPoints: 18,
      movementPoints: 1,
      actionPoints: 1,
      visionRadius: 6,
      attackDamage: 3,
      protection: 1,
      range: 0,
      loot: [false, Gem, HolyPotion, BerserkPotion]
    }, x, y);
  }
}
