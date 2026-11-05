import type { Entity } from "./entity";
import type { GameContext, PoisonCloud } from "./context";
import { applyEffect, createPoisonedEffect } from "./effects";
import { terrainFor } from './terrain';

const EPSILON = 1e-9;

// A thrown/drunk Toxic Gas potion now releases a cloud that expands outward one
// cardinal step per world-time unit, up to a diamond of this many steps, and
// then dissipates from its outer edge back toward the impact tile.
export const GAS_MAX_RADIUS = 3;
export const GAS_EXPAND_INTERVAL = 1;
// Base lifetime of the impact tile. Each farther ring expires this much sooner,
// so the cloud visibly shrinks instead of vanishing all at once.
export const GAS_CELL_LIFETIME = 8;
export const GAS_FADE_STEP = 2;

export function exposeToGas(context: GameContext, actor: Entity): void {
  const now = context.simulationTime ?? 0;
  if ((actor.type !== "player" && actor.type !== "enemy") || actor.healthPoints <= 0) return;
  // Poison-immune creatures (e.g. the Deadly Frog) breathe their own gas safely.
  if (actor.poisonImmune) return;
  if (context.poisonClouds?.some(c => c.x === actor.x && c.y === actor.y && c.expiresAt > now + EPSILON)) {
    // Gas is airborne: levitation does not protect against it.
    const poison = actor.effects.find(e => e.id === "poisoned");
    if (poison) poison.duration = Math.max(poison.duration, 2);
    else applyEffect(actor, createPoisonedEffect(2));
  }
}

function isOpen(context: GameContext, map: number[][], x: number, y: number): boolean {
  const { getDoorState, getFeature } = terrainFor(context);
  return map[y]?.[x] === 0 &&
    getDoorState(x, y) !== "closed" && getFeature(x, y) !== "secretDoor";
}

function gasExpiresAt(birth: number, radius: number): number {
  return birth + GAS_CELL_LIFETIME - radius * GAS_FADE_STEP;
}

function makeCloud(x: number, y: number, birth: number, radius: number): PoisonCloud {
  return {
    x,
    y,
    bornAt: birth,
    expiresAt: gasExpiresAt(birth, radius),
    nextTick: birth + 1,
    nextExpand: radius < GAS_MAX_RADIUS ? birth + GAS_EXPAND_INTERVAL : Infinity,
    radius
  };
}

export function createPoisonGas(context: GameContext, map: number[][], x: number, y: number): number {
  const now = context.simulationTime ?? 0;
  if (!isOpen(context, map, x, y)) return 0;

  context.poisonClouds ??= [];
  const existing = context.poisonClouds.find(c => c.x === x && c.y === y);
  if (existing && existing.expiresAt > now + EPSILON) {
    // Repeated splashes merge: they extend the cloud but never postpone its
    // pulse phase, so exposure damage cannot be deferred forever.
    existing.expiresAt = Math.max(existing.expiresAt, gasExpiresAt(now, 0));
  } else {
    if (existing) context.poisonClouds.splice(context.poisonClouds.indexOf(existing), 1);
    context.poisonClouds.push(makeCloud(x, y, now, 0));
  }

  for (const actor of context.entities) {
    if (actor.x === x && actor.y === y) exposeToGas(context, actor);
  }
  return 1;
}

export function nextGasEvent(context: GameContext): number {
  let next = Infinity;
  for (const cloud of context.poisonClouds ?? []) {
    next = Math.min(next, cloud.expiresAt, cloud.nextTick, cloud.nextExpand ?? Infinity);
  }
  return next;
}

export function tickGas(context: GameContext): void {
  const now = context.simulationTime ?? 0;
  const map = context.currentLevel;

  // Expiry wins ties: no pulse, contact or expansion at the exact expiry timestamp.
  const clouds = (context.poisonClouds ?? []).filter(c => c.expiresAt > now + EPSILON);
  context.poisonClouds = clouds;

  // Cells created this tick are not processed until the next event, so a single
  // scheduler tick expands exactly one ring rather than flooding the whole floor.
  const current = clouds.slice();
  const newlyCovered = new Set<string>();
  const pulsing = new Set<string>();

  for (const cloud of current) {
    const radius = cloud.radius ?? 0;
    if ((cloud.nextExpand ?? Infinity) <= now + EPSILON && radius < GAS_MAX_RADIUS) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cloud.x + dx;
        const ny = cloud.y + dy;
        if (!map || !isOpen(context, map, nx, ny)) continue;

        const existing = clouds.find(c => c.x === nx && c.y === ny);
        if (existing) {
          existing.expiresAt = Math.max(existing.expiresAt, gasExpiresAt(now, radius + 1));
          continue;
        }
        clouds.push(makeCloud(nx, ny, now, radius + 1));
        newlyCovered.add(`${nx},${ny}`);
      }
      cloud.nextExpand = Infinity;
    }

    if (cloud.nextTick <= now + EPSILON) {
      pulsing.add(`${cloud.x},${cloud.y}`);
      cloud.nextTick += 1;
    }
  }

  for (const actor of context.entities) {
    const key = `${actor.x},${actor.y}`;
    if (newlyCovered.has(key) || pulsing.has(key)) exposeToGas(context, actor);
  }
}

export function restoreGas(clouds: PoisonCloud[] = [], pausedTime = 0): PoisonCloud[] {
  return clouds.map(c => {
    const restored: PoisonCloud = {
      ...c,
      nextTick: c.nextTick + pausedTime,
      expiresAt: c.expiresAt + pausedTime
    };
    // Preserve legacy saves that omit the expansion fields rather than
    // inventing keys they never serialized.
    if (c.nextExpand !== undefined) restored.nextExpand = c.nextExpand + pausedTime;
    if (c.bornAt !== undefined) restored.bornAt = c.bornAt + pausedTime;
    return restored;
  });
}
