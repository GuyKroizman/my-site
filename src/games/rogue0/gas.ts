import type { Entity } from "./entity";
import type { GameContext, PoisonCloud } from "./context";
import { applyEffect, createPoisonedEffect } from "./effects";
import { getDoorState, getFeature } from "./tiles";

const EPSILON = 1e-9;

export function exposeToGas(context: GameContext, actor: Entity): void {
  const now = context.simulationTime ?? 0;
  if ((actor.type !== "player" && actor.type !== "enemy") || actor.healthPoints <= 0) return;
  if (context.poisonClouds?.some(c => c.x === actor.x && c.y === actor.y && c.expiresAt > now + EPSILON)) {
    // Gas is airborne: levitation does not protect against it.
    const poison = actor.effects.find(e => e.id === "poisoned");
    if (poison) poison.duration = Math.max(poison.duration, 2);
    else applyEffect(actor, createPoisonedEffect(2));
  }
}

export function createPoisonGas(context: GameContext, map: number[][], x: number, y: number): number {
  const now = context.simulationTime ?? 0;
  const open = (px: number, py: number) => map[py]?.[px] === 0 &&
    getDoorState(px, py) !== "closed" && getFeature(px, py) !== "secretDoor";
  if (!open(x, y)) return 0;
  context.poisonClouds ??= [];
  // A bounded cardinal splash, not a spreading floor-wide simulation.
  const splashed = new Set<string>();
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (!open(nx, ny)) continue;
    const existing = context.poisonClouds.find(c => c.x === nx && c.y === ny);
    if (existing && existing.expiresAt > now + EPSILON) {
      existing.expiresAt = now + 4;
      // Keep its pulse phase: repeated splashes must not postpone exposure forever.
    } else {
      if (existing) context.poisonClouds.splice(context.poisonClouds.indexOf(existing), 1);
      context.poisonClouds.push({ x: nx, y: ny, expiresAt: now + 4, nextTick: now + 1 });
    }
    splashed.add(`${nx},${ny}`);
  }
  for (const actor of context.entities) {
    if (splashed.has(`${actor.x},${actor.y}`)) exposeToGas(context, actor);
  }
  return splashed.size;
}

export function nextGasEvent(context: GameContext): number {
  return Math.min(Infinity, ...(context.poisonClouds ?? []).map(c => Math.min(c.nextTick, c.expiresAt)));
}

export function tickGas(context: GameContext): void {
  const now = context.simulationTime ?? 0;
  // Expiry wins ties: no pulse or contact at the exact expiry timestamp.
  context.poisonClouds = (context.poisonClouds ?? []).filter(c => c.expiresAt > now + EPSILON);
  const pulsing = new Set<string>();
  for (const cloud of context.poisonClouds) {
    if (cloud.nextTick <= now + EPSILON) {
      pulsing.add(`${cloud.x},${cloud.y}`);
      cloud.nextTick += 1;
    }
  }
  for (const actor of context.entities) {
    if (pulsing.has(`${actor.x},${actor.y}`)) exposeToGas(context, actor);
  }
}

export function restoreGas(clouds: PoisonCloud[] = [], pausedTime = 0): PoisonCloud[] {
  return clouds.map(c => ({ ...c, nextTick: c.nextTick + pausedTime, expiresAt: c.expiresAt + pausedTime }));
}
