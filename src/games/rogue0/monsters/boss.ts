import Monster from "./monster";
import type { GameContext } from "../context";
import PotionOfHealing from "../items/PotionOfHealing";
import { createCrippledEffect, createWeakenedEffect } from "../effects";
import { BOSS_TEXTURE, generateBossTexture } from "./bossTexture";
import { resolveFootprint } from "../footprint.ts";
import type { Footprint } from "../footprint.ts";

// A 3x3 centre-anchored footprint is the physical creature: movement, hits,
// projectiles and inspection all use these nine cells. The artwork fills the
// same rectangle. The class-level constant is restore-safe (prototype getter).
export const BOSS_FOOTPRINT: Footprint = resolveFootprint({
  width: 3, height: 3, anchor: 'center'
});

// The arena guardian waits at the middle of its hall with a long dormancy: the
// hero can cross the room, but the blob wakes on its own if ignored, on any
// wound or noise, and once the hero is close enough to be seen.
export const BOSS_ARENA_DORMANCY = 200;

export default class Boss extends Monster {
  // Available before construction so floor generation can reserve the arena
  // rectangle without instantiating the guardian.
  static readonly footprint: Footprint = BOSS_FOOTPRINT;

  get terrorImmune(): boolean { return true; }

  constructor(context: GameContext, x?: number, y?: number) {
    if (context.scene) generateBossTexture(context.scene);
    super(context, {
      name: "Bone Lord",
      description: "A mountain of gelatinous flesh with one great eye and a mouth full of fangs. The guardian of the dungeon depths. Immune to terror. Extremely dangerous.",
      textureKey: BOSS_TEXTURE,
      healthPoints: 60,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 9,
      attackDamage: 8,
      protection: 2,
      resistance: { physical: 2 },
      xp: 25,
      range: 0,
      scale: 2,
      loot: [false, PotionOfHealing]
    }, x, y);

    // The arena hall is vast, so the guardian naps until intruded on: it wakes
    // on any wound or noise, when the hero is close enough to be seen, or after
    // this many elapsed time units if the hero simply waits it out.
    this.sleepTurnsRemaining = BOSS_ARENA_DORMANCY;
  }

  init(context: GameContext, x?: number, y?: number) {
    super.init(context, x, y);
    if (!this.sprite) return;
    // Unlike upright single-cell actors, the blob fills its ground footprint.
    // Keep the sprite at the usual tile anchor for movement/tweens, but place
    // its top-left at the footprint's top-left and draw all three rows. Do this
    // on every init so old saves with spriteScale=1.5 also get the corrected art.
    const fp = this.footprint;
    this.sprite.setDisplaySize(fp.width * 16, fp.height * 16);
    this.sprite.setOrigin(fp.originX / fp.width, fp.originY / fp.height);
  }

  onHitEffects() {
    return [createWeakenedEffect(3), createCrippledEffect(3)];
  }

  // Centre-anchored, so the saved guardian position keeps the old meaning.
  get footprint(): Footprint {
    return BOSS_FOOTPRINT;
  }
}
