import Monster from "./monster";
import type { GameContext } from "../context";
import Gem from "../items/gem";
import HolyPotion from "../items/holyPotion";
import FullHealPotion from "../items/fullHealPotion";
import { createCrippledEffect, createWeakenedEffect } from "../effects";
import { BOSS_TEXTURE, generateBossTexture } from "./bossTexture";

// The arena guardian waits at the middle of its hall with a long dormancy: the
// hero can cross the room, but the blob wakes on its own if ignored, on any
// wound or noise, and once the hero is close enough to be seen.
export const BOSS_ARENA_DORMANCY = 200;

export default class Boss extends Monster {
  constructor(context: GameContext, x?: number, y?: number) {
    if (context.scene) generateBossTexture(context.scene);
    super(context, {
      name: "Bone Lord",
      description: "A mountain of gelatinous flesh with one great eye and a mouth full of fangs. The guardian of the dungeon depths. Extremely dangerous.",
      tile: 0,
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
      scale: 1.5,
      loot: [Gem, HolyPotion, FullHealPotion]
    }, x, y);

    // The arena hall is vast, so the guardian naps until intruded on: it wakes
    // on any wound or noise, when the hero is close enough to be seen, or after
    // this many elapsed time units if the hero simply waits it out.
    this.sleepTurnsRemaining = BOSS_ARENA_DORMANCY;
  }

  onHitEffects() {
    return [createWeakenedEffect(3), createCrippledEffect(3)];
  }

  // The 1.5x blob art spans more than one cell. Give it a matching 3x3 body so
  // the hero is stopped outside the artwork instead of walking underneath it.
  get bodyRadius(): number {
    return 1;
  }
}
