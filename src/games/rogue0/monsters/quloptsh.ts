import Monster from "./monster";
import { monsterStats, MONSTER_XP } from '../monsterBalance';
import type { GameContext } from "../context";
import { createWeakenedEffect } from "../effects";

export default class Quloptsh extends Monster {
  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Quloptsh",
      musicCue: 'quloptsh',
      description: "A calm, stealthy assassin that weakens its prey.",
      textureKey: 'quloptsh',
      ...monsterStats('quloptsh', context.floor),
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 7,
      protection: 0,
      evasion: 40,
      xp: MONSTER_XP.quloptsh,
      range: 0,
      loot: [false]
    }, x, y);
  }

  onHitEffects() {
    return [createWeakenedEffect(3)];
  }
}
