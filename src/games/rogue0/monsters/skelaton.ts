import Monster from "./monster";
import type { GameContext } from "../context";
import dungeon from "../dungeon";
import Gem from "../items/gem";
import HolyPotion from "../items/holyPotion";
import BerserkPotion from "../items/berserkPotion";

export default class Skeleton extends Monster {
  private reanimated = false;

  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Skeleton",
      description: "A brittle skeleton that rises again after being destroyed.",
      tile: 6 * 49 + 29,
      healthPoints: 4,
      movementPoints: 1,
      actionPoints: 1,
      visionRadius: 7,
      attackDamage: 1,
      protection: 0,
      xp: 2,
      range: 0,
      loot: [false, false, false, false, Gem, HolyPotion, BerserkPotion]
    }, x, y);
  }

  onDestroy() {
    super.onDestroy();

    if (this.reanimated || this.x === undefined || this.y === undefined) {
      return;
    }

    this.reanimated = true;

    const weakened = new Skeleton(this.context, this.x, this.y);
    weakened.healthPoints = Math.max(1, Math.ceil(weakened.maxHealthPoints / 2));
    weakened.maxHealthPoints = weakened.healthPoints;
    weakened.reanimated = true;

    this.context.entities.push(weakened);
    dungeon.log(this.context, `${this.name} rises again, weakened.`);
  }
}
