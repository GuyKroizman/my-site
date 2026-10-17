// Status-effect system.
//
// Effects live on `Entity.effects` and tick once per round via
// `Entity.tickEffects()` (called from `turnManager._refresh`). Damage/heal
// effects do their work in `tick` and are timed via `duration`. Passive
// modifiers (weakened/crippled) are read where the relevant stat is used:
// - `weakened`/`strengthened` are applied in `combat.resolveAttack`.
// - `crippled` reduces movement points in its `tick` (after `refresh`).
// - `frozen` is consumed by `turnManager._turn`, which skips the entity's
//   action and then removes the effect.

import type { Entity } from "./entity";
import type { GameContext } from "./context";

export type DamageType =
  | "physical"
  | "fire"
  | "ice"
  | "shock"
  | "poison"
  | "magic";

export type StatusEffect = {
  id: string;
  name: string;
  iconTile: number;
  duration: number;
  // When true, `tickEffects` does not auto-decrement `duration`; the effect
  // is expected to remove itself (see `frozen`).
  manualExpiry?: boolean;
  apply?(entity: Entity, context: GameContext): void;
  tick?(entity: Entity, context: GameContext): void;
  remove?(entity: Entity, context: GameContext): void;
};

function log(context: GameContext, text: string): void {
  context.messages.unshift(text);
  context.messages = context.messages.slice(0, 8);
}

export function hasEffect(entity: Entity, effectId: string): boolean {
  return entity.effects.some((e) => e.id === effectId);
}

export function applyEffect(entity: Entity, effect: StatusEffect): void {
  const existing = entity.effects.find((e) => e.id === effect.id);
  if (existing) {
    existing.duration = Math.max(existing.duration, effect.duration);
    log(entity.context, `${entity.name} is already ${effect.name}.`);
    return;
  }

  const applied: StatusEffect = { ...effect };
  entity.effects.push(applied);
  applied.apply?.(entity, entity.context);
  log(entity.context, `${entity.name} is ${applied.name}.`);
}

export function removeEffect(entity: Entity, effectId: string): void {
  const index = entity.effects.findIndex((e) => e.id === effectId);
  if (index === -1) return;

  const [effect] = entity.effects.splice(index, 1);
  effect.remove?.(entity, entity.context);
  log(entity.context, `${entity.name}'s ${effect.name} wears off.`);
}

export function tickEffects(entity: Entity, context: GameContext): void {
  for (const effect of [...entity.effects]) {
    effect.tick?.(entity, context);

    // The tick callback may have removed the effect itself.
    if (!entity.effects.includes(effect)) continue;

    if (effect.manualExpiry) continue;

    effect.duration -= 1;
    if (effect.duration <= 0) {
      removeEffect(entity, effect.id);
    }
  }
}

export function createBurningEffect(duration = 3): StatusEffect {
  return {
    id: "burning",
    name: "Burning",
    iconTile: 13 * 49 + 43,
    duration,
    tick(entity, context) {
      const amount = 1;
      entity.healthPoints -= amount;
      log(context, `${entity.name} burns for ${amount} fire damage.`);
    }
  };
}

export function createPoisonedEffect(duration = 3): StatusEffect {
  return {
    id: "poisoned",
    name: "Poisoned",
    iconTile: 14 * 49 + 43,
    duration,
    tick(entity, context) {
      const amount = 1;
      entity.healthPoints -= amount;
      log(context, `${entity.name} takes ${amount} poison damage.`);
    }
  };
}

export function createBleedingEffect(duration = 3): StatusEffect {
  return {
    id: "bleeding",
    name: "Bleeding",
    iconTile: 14 * 49 + 44,
    duration,
    tick(entity, context) {
      const amount = 1;
      entity.healthPoints -= amount;
      log(context, `${entity.name} bleeds for ${amount} physical damage.`);
    }
  };
}

export function createRegenerationEffect(duration = 4): StatusEffect {
  return {
    id: "regeneration",
    name: "Regeneration",
    iconTile: 13 * 49 + 44,
    duration,
    tick(entity, context) {
      if (entity.healthPoints >= entity.maxHealthPoints) return;

      const amount = 1;
      entity.healthPoints = Math.min(
        entity.maxHealthPoints,
        entity.healthPoints + amount
      );
      log(context, `${entity.name} regenerates ${amount} health.`);
    }
  };
}

export function createFrozenEffect(duration = 1): StatusEffect {
  return {
    id: "frozen",
    name: "Frozen",
    iconTile: 15 * 49 + 43,
    duration,
    manualExpiry: true
  };
}

export function createWeakenedEffect(duration = 3): StatusEffect {
  return {
    id: "weakened",
    name: "Weakened",
    iconTile: 15 * 49 + 44,
    duration
  };
}

export function createCrippledEffect(duration = 3): StatusEffect {
  return {
    id: "crippled",
    name: "Crippled",
    iconTile: 16 * 49 + 43,
    duration,
    tick(entity) {
      entity.movementPoints = Math.max(0, entity.movementPoints - 1);
    }
  };
}

// Extra timed buff used by the adapted Berserk Potion demonstration.
export function createStrengthenedEffect(duration = 10): StatusEffect {
  return {
    id: "strengthened",
    name: "Strengthened",
    iconTile: 16 * 49 + 44,
    duration
  };
}

// Ongoing penalty applied by cursed gear (e.g. the Cursed Gem) while it stays
// equipped. `manualExpiry` keeps it active until the curse is lifted via
// Remove Curse / Holy Potion and the item is unequipped.
export function createCursedEffect(): StatusEffect {
  return {
    id: "cursed",
    name: "Cursed",
    iconTile: 17 * 49 + 43,
    duration: Number.POSITIVE_INFINITY,
    manualExpiry: true,
    tick(entity, context) {
      const amount = 1;
      entity.healthPoints -= amount;
      log(context, `${entity.name} is cursed and takes ${amount} damage.`);
    }
  };
}
