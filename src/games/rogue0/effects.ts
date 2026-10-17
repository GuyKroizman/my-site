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

// --- Phase 6 / 11 additive effect factories ---

// Makes the entity fade out while it lasts. True stealth (monsters ignoring
// the player) lives in ai.ts and is intentionally not wired here.
export function createInvisibleEffect(duration = 10): StatusEffect {
  return {
    id: "invisible",
    name: "Invisible",
    iconTile: 17 * 49 + 44,
    duration,
    apply(entity) {
      entity.sprite?.setAlpha(0.4);
    },
    remove(entity) {
      entity.sprite?.setAlpha(1);
    }
  };
}

// Grants an extra movement point each round while active.
export function createHasteEffect(duration = 8): StatusEffect {
  return {
    id: "haste",
    name: "Haste",
    iconTile: 18 * 49 + 43,
    duration,
    tick(entity) {
      entity.movementPoints += 1;
    }
  };
}

// Flavour buff from the Levitation potion. Terrain (chasms/water) does not
// exist yet, so this is a timed marker rather than a movement mechanic.
export function createLevitatingEffect(duration = 20): StatusEffect {
  return {
    id: "levitating",
    name: "Levitating",
    iconTile: 18 * 49 + 44,
    duration
  };
}

// Feared monsters run away from the player. Fleeing is a minimal, self-
// contained implementation that moves the monster one walkable tile away and
// skips the rest of its turn.
export function createTerrifiedEffect(duration = 4): StatusEffect {
  return {
    id: "terrified",
    name: "Terrified",
    iconTile: 19 * 49 + 43,
    duration,
    tick(entity, context) {
      if (entity.type !== "enemy") return;
      if (!fleeStep(entity, context)) return;

      entity.movementPoints = 0;
      entity.actionPoints = 0;
      log(context, `${entity.name} flees in terror.`);
    }
  };
}

// Lowers accuracy while active and restores it exactly on expiry.
export function createBlindedEffect(duration = 4): StatusEffect {
  let originalAccuracy: number | undefined;

  return {
    id: "blinded",
    name: "Blinded",
    iconTile: 19 * 49 + 44,
    duration,
    apply(entity) {
      originalAccuracy = entity.accuracy;
      entity.accuracy = Math.max(0, entity.accuracy - 25);
    },
    remove(entity) {
      if (originalAccuracy !== undefined) {
        entity.accuracy = originalAccuracy;
        originalAccuracy = undefined;
      }
    }
  };
}

// Prevents movement (but not attacking) while active.
export function createRootedEffect(duration = 3): StatusEffect {
  return {
    id: "rooted",
    name: "Rooted",
    iconTile: 20 * 49 + 43,
    duration,
    tick(entity) {
      entity.movementPoints = 0;
    }
  };
}

// Moves an entity one walkable tile directly away from the player without
// pathfinding. Returns true when a legal flee tile was found.
function fleeStep(entity: Entity, context: GameContext): boolean {
  const player = context.player;
  const map = context.currentLevel;
  if (!player || !map) return false;
  if (player.x === undefined || player.y === undefined) return false;
  if (entity.x === undefined || entity.y === undefined) return false;

  const ex = entity.x;
  const ey = entity.y;
  const px = player.x;
  const py = player.y;
  const w = map[0].length;
  const h = map.length;

  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  // Prefer the step that increases distance from the player the most.
  dirs.sort((a, b) => {
    const da = (ex + a[0] - px) ** 2 + (ey + a[1] - py) ** 2;
    const db = (ex + b[0] - px) ** 2 + (ey + b[1] - py) ** 2;
    return db - da;
  });

  for (const [dx, dy] of dirs) {
    const nx = ex + dx;
    const ny = ey + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    if (map[ny][nx] !== 0) continue;

    const occupied = context.entities.some(
      (o) => o !== entity && o.sprite && o.x === nx && o.y === ny
    );
    if (occupied) continue;

    entity.x = nx;
    entity.y = ny;
    if (entity.sprite && context.map) {
      entity.sprite.setPosition(
        context.map.tileToWorldX(nx)!,
        context.map.tileToWorldY(ny)!
      );
    }
    return true;
  }

  return false;
}
