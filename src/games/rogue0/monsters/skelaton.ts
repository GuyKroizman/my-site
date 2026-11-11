import type Phaser from "phaser";
import Monster from "./monster";
import { playSkeletonDeath } from "./skeletonDeathVisuals";
import type { GameContext } from "../context";
import BerserkPotion from "../items/berserkPotion";

export default class Skeleton extends Monster {
  playDeathAnimation(sprite: Phaser.GameObjects.Sprite): boolean {
    return playSkeletonDeath(this.context, sprite);
  }

  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Skeleton",
      description: "A brittle skeleton animated by dark magic.",
      tile: 6 * 49 + 29,
      healthPoints: 8,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 7,
      attackDamage: 2,
      protection: 0,
      xp: 2,
      range: 0,
      // No gems: skeletons are the most common enemy, so their loot is
      // potions only. Gems come from rare treasures (see scene0/chest/mimic).
      loot: [false, false, false, false, false, BerserkPotion]
    }, x, y);
  }
}
