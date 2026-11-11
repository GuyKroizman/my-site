import Wand from "./wand";
import type { GameContext } from "../context";
import type { Entity } from "../entity";
import { createBurningEffect } from "../effects";
import { Sheet } from '../spriteFrames.ts';

export default class WandOfFirebolt extends Wand {
  constructor(context: GameContext, x?: number, y?: number) {
    super(
      context,
      {
        name: "Wand of Firebolt",
        description: "Hurls a bolt of fire that ignites its target.",
        tile: Sheet.wandOfFirebolt,
        attackTile: Sheet.flameProjectile,
        damageType: "fire",
        charges: 3
      },
      x,
      y
    );
  }

  get damageBounds(): readonly [number, number] {
    return [3, 6];
  }

  // Fire is super effective against ice: firebolt projectiles hit ice
  // elementals for double damage before the normal fire vulnerability applies.
  wandDamageMultiplier(target: Entity): number {
    return target.damageType === "ice" ? 2 : 1;
  }

  wandEffect() {
    return createBurningEffect(3);
  }
}
