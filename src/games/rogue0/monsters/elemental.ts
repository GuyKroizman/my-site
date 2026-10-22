import Monster from "./monster";
import type { GameContext } from "../context";
import {
  createBurningEffect,
  createFrozenEffect,
  createWeakenedEffect
} from "../effects";

export class FireElemental extends Monster {
  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Fire Elemental",
      description: "A living flame that burns whatever it touches.",
      tile: 6 * 49 + 8,
      healthPoints: 8,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 7,
      attackDamage: 2,
      protection: 0,
      xp: 7,
      range: 0,
      resistance: { fire: 2 },
      vulnerability: { ice: 1 }
    }, x, y);

    this.damageType = "fire";
  }

  onHitEffects() {
    return [createBurningEffect(3)];
  }
}

export class IceElemental extends Monster {
  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Ice Elemental",
      description: "A frozen horror whose touch locks victims in place.",
      tile: 6 * 49 + 9,
      healthPoints: 8,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 7,
      attackDamage: 2,
      protection: 0,
      xp: 7,
      range: 0,
      resistance: { ice: 2 },
      vulnerability: { fire: 1 }
    }, x, y);

    this.damageType = "ice";
  }

  onHitEffects() {
    return [createFrozenEffect(1)];
  }
}

export class ShockElemental extends Monster {
  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Shock Elemental",
      description: "A crackling storm that leaves its victims weakened.",
      tile: 6 * 49 + 11,
      healthPoints: 8,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 7,
      attackDamage: 2,
      protection: 0,
      xp: 7,
      range: 0,
      resistance: { shock: 2 }
    }, x, y);

    this.damageType = "shock";
  }

  onHitEffects() {
    return [createWeakenedEffect(3)];
  }
}

export default FireElemental;
