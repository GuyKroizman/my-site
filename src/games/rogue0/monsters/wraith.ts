import Monster from "./monster";
import { monsterStats, MONSTER_XP } from '../monsterBalance';
import type { GameContext } from "../context";
import { createWeakenedEffect } from "../effects";
import { WRAITH_TEXTURE, generateWraithTexture } from "./wraithTexture";

export default class Wraith extends Monster {
  constructor(context: GameContext, x?: number, y?: number) {
    if (context.scene) generateWraithTexture(context.scene);
    super(context, {
      name: "Wraith",
      musicCue: 'wraith',
      description: "A spectral horror that weakens those it touches.",
      textureKey: WRAITH_TEXTURE,
      ...monsterStats('wraith', context.floor),
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 7,
      protection: 0,
      evasion: 40,
      xp: MONSTER_XP.wraith,
      range: 0,
      resistance: { physical: 1 }
    }, x, y);

    this.damageType = "magic";
  }

  onHitEffects() {
    return [createWeakenedEffect(3)];
  }
}
