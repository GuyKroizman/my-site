// Simulation time is measured in normal actions, never milliseconds/frames.

/** Starvation deals one HP on each integer upkeep tick. The current tick
 * has already been processed when the hero is ready to choose an action. */
export function starvationDamageDuring(now: number, duration: number): number {
  return Math.max(0, Math.floor(now + duration + 1e-9) - Math.floor(now + 1e-9));
}
export type ActionKind = "move" | "attack" | "use" | "equip" | "drop" | "throw" | "skill" | "search" | "wait";

export interface TimedActor {
  movementSpeed: number;
  attackDelay: number;
  effects: Array<{ id: string }>;
  movementCostMultiplier?(): number;
  attackCostMultiplier?(): number;
}

export function actionCost(actor: TimedActor, action: ActionKind, weaponDelay = actor.attackDelay): number {
  let cost = 1;
  if (action === "move") {
    let speed = actor.movementSpeed;
    if (actor.effects.some(e => e.id === "haste")) speed *= 2;
    if (actor.effects.some(e => e.id === "crippled")) speed *= 0.5;
    cost = (actor.movementCostMultiplier?.() ?? 1) / speed;
  } else if (action === "attack") {
    cost = weaponDelay * (actor.attackCostMultiplier?.() ?? 1);
  } else if (action === "search") {
    cost = 2;
  }
  // Bad content must not create zero-time loops or stall the simulation.
  return Number.isFinite(cost) && cost > 0 ? Math.max(0.05, cost) : 1;
}
