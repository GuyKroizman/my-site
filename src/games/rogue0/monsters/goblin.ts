import Monster from "./monster";
import type { GameContext } from "../context";
import { createBleedingEffect } from "../effects";
import { GOBLIN_ARROW_TEXTURE, generateGoblinArrowTexture } from "../projectileTextures";

export default class Goblin extends Monster {
  constructor(context: GameContext, x?: number, y?: number) {
    if (context.scene) generateGoblinArrowTexture(context.scene);
    super(context, {
      name: "Goblin",
      description: "A spiteful, sharp-eared goblin. Fires barbed arrows from a distance that cause bleeding.",
      textureKey: "goblin",
      healthPoints: 12,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 8,
      attackDamage: 4,
      protection: 0,
      evasion: 20,
      xp: 5,
      range: 5,
      meleeDamage: 2,
      attackTile: 1,
      projectileTexture: GOBLIN_ARROW_TEXTURE,
      // Loot is currency only: curse relief belongs to the Scroll of Remove
      // Curse, which goblins never carry.
      loot: []
    }, x, y);
  }

  onHitEffects(isRanged = true) {
    // Barbed arrows cause bleeding; the goblin's dagger does not.
    return isRanged ? [createBleedingEffect(3)] : [];
  }
}
