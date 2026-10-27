// Centralised combat model.
//
// `resolveAttack` owns the pure number math (accuracy/evasion, crits, armor,
// resistances/vulnerabilities, surprise attacks and on-hit status effects).
// `dungeon.attackEntity` keeps the tweens/animation and calls this for the
// numbers, then applies the returned status effects to the victim.

import type { Entity } from "./entity";
import type { GameContext } from "./context";
import { canSee } from "./fov";
import * as tiles from "./tiles";
import {
  hasEffect,
  createBleedingEffect
} from "./effects";
import type { DamageType, StatusEffect } from "./effects";

export type CombatOptions = {
  damageType?: DamageType;
  isRanged?: boolean;
  onHitEffects?: StatusEffect[];
};

export type CombatResult = {
  hit: boolean;
  damage: number;
  crit: boolean;
  surprise?: boolean;
  damageType: DamageType;
  appliedEffects: StatusEffect[];
};

const CRIT_CHANCE = 0.1;
const CRIT_MULTIPLIER = 1.5;
const SURPRISE_BONUS_DAMAGE = 2;
const SURPRISE_BLEED_CHANCE = 0.5;
const WEAKENED_ATTACK_PENALTY = 1;
const STRENGTHENED_ATTACK_BONUS = 2;

function log(context: GameContext, text: string): void {
  context.messages.unshift(text);
  context.messages = context.messages.slice(0, 20);
}

export function isSurpriseAttack(
  context: GameContext,
  attacker: Entity,
  defender: Entity
): boolean {
  if (
    attacker.x === undefined ||
    attacker.y === undefined ||
    defender.x === undefined ||
    defender.y === undefined
  ) {
    return false;
  }

  // A player defender is surprised when the attacker is outside the player's
  // current field of view.
  if (defender.type === "player") {
    return !context.visibleTiles.has(`${attacker.x},${attacker.y}`) ||
      tiles.isGrassConcealed(attacker.x, attacker.y, defender.x, defender.y);
  }

  // A monster that just rounded cover has not had a chance to react yet.
  if (attacker.type === "player" &&
      (!defender.awareOfPlayer || hasEffect(attacker, "invisible"))) return true;

  // Also allow ambushes when cover currently blocks line of sight.
  const map = context.currentLevel;
  if (!map) return false;

  return !canSee(
    map,
    defender.x,
    defender.y,
    attacker.x,
    attacker.y,
    defender.visionRadius
  );
}

export function resolveAttack(
  context: GameContext,
  attacker: Entity,
  defender: Entity,
  opts: CombatOptions = {}
): CombatResult {
  const damageType = opts.damageType ?? "physical";
  const appliedEffects: StatusEffect[] = [];
  const surprise = isSurpriseAttack(context, attacker, defender);

  // Resolve the opening ambush before destroying cover, including on a miss.
  if (attacker.x !== undefined && attacker.y !== undefined &&
      tiles.getFeature(attacker.x, attacker.y) === "grass") {
    tiles.clearFeature(attacker.x, attacker.y);
    context.onCoverChanged?.();
  }

  // An attack reveals the player's location even on a miss. Consume the
  // ambush before the next attack, including multiple fast player actions.
  if (attacker.type === "player" && defender.type === "enemy") {
    defender.awareOfPlayer = true;
    defender.lastSeenX = attacker.x;
    defender.lastSeenY = attacker.y;
  }

  // Hit roll (skipped for surprise attacks, which always connect).
  if (!surprise) {
    const roll = Math.random() * 100;
    const accuracy = attacker.effectiveAccuracy ?? attacker.accuracy;
    const evasion = defender.effectiveEvasion ?? defender.evasion;
    if (roll >= accuracy - evasion) {
      if (evasion > 0) {
        log(context, `${defender.type === "player" ? "You dodge" : `${defender.name} dodges`} ${attacker.type === "player" ? "your" : `${attacker.name}'s`} attack.`);
      } else {
        log(context, `${attacker.type === "player" ? "You miss" : `${attacker.name} misses`} ${defender.type === "player" ? "you" : defender.name}.`);
      }
      return {
        hit: false,
        damage: 0,
        crit: false,
        damageType,
        appliedEffects
      };
    }
  }

  // Base damage (already aggregates equipped gear for heroes).
  let damage = attacker.attack();
  if (hasEffect(attacker, "weakened")) {
    damage = Math.max(0, damage - WEAKENED_ATTACK_PENALTY);
  }
  if (hasEffect(attacker, "strengthened")) {
    damage += STRENGTHENED_ATTACK_BONUS;
  }

  // Crit roll.
  const crit = Math.random() < CRIT_CHANCE;
  if (crit) {
    damage = Math.round(damage * CRIT_MULTIPLIER);
  }

  // Surprise bonus: extra damage and (physical only) a chance to bleed.
  if (surprise) {
    damage += SURPRISE_BONUS_DAMAGE;
    if (damageType === "physical" && Math.random() < SURPRISE_BLEED_CHANCE) {
      appliedEffects.push(createBleedingEffect(2));
    }
  }

  // Attacker-declared on-hit effects (e.g. a ghoul's bleed).
  for (const effect of opts.onHitEffects ?? []) {
    appliedEffects.push(effect);
  }

  // Reduction: armor (physical only) + resistance, offset by vulnerability.
  const armor = damageType === "physical" ? defender.protection() : 0;
  const resistance = defender.resistance[damageType] ?? 0;
  const vulnerability = defender.vulnerability[damageType] ?? 0;
  const reduction = armor + resistance - vulnerability;

  if (reduction > 0) {
    const absorbed = Math.min(damage, reduction);
    damage -= absorbed;
    // The attack summary reports final damage; don't add a separate armor log.
  } else if (reduction < 0) {
    damage += -reduction;
  }

  damage = Math.max(0, damage);
  if (surprise) context.onSurpriseAttack?.(defender);

  return {
    hit: true,
    damage,
    crit,
    surprise,
    damageType,
    appliedEffects
  };
}
