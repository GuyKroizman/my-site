// @ts-nocheck
import Monster from "./monster";
import type { GameContext } from "../context";
import Gem from "../items/gem";
import HolyPotion from "../items/holyPotion";
import HealingPotion from "../items/healingPotion";

export default class Boss extends Monster {
  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Bone Lord",
      description: "The guardian of the dungeon depths. Extremely dangerous.",
      tile: 6 * 49 + 10,
      healthPoints: 30,
      movementPoints: 1,
      actionPoints: 1,
      visionRadius: 9,
      attackDamage: 4,
      protection: 2,
      range: 0,
      scale: 1.4,
      loot: [Gem, HolyPotion, HealingPotion]
    }, x, y);
  }
}
