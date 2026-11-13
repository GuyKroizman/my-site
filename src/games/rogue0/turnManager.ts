import type { Entity } from "./entity";
import type { GameContext } from "./context";

export type TurnManagerServices = {
  hasEffect(entity: Entity, id: string): boolean;
  removeEffect(entity: Entity, id: string): void;
  log(context: GameContext, message: string): void;
};

// Discrete-event scheduler. Rendering may delay an event, but never changes its
// simulation timestamp. Equal timestamps give the player priority, then preserve
// entity order. Items do not participate in scheduling.
// Each run scene owns an instance. Only time/nextTick and actor deadlines are
// persisted; the services and known-actor set are rebuilt on resume.
export class TurnManager {
  time = 0;
  nextTick = 1;
  known = new Set<Entity>();
  private readonly services: TurnManagerServices;

  constructor(services: TurnManagerServices) {
    this.services = services;
  }

  reset(entities: Entity[] = [], preserveClock = false) {
    if (!preserveClock) {
      this.time = 0;
      this.nextTick = 1;
    }
    this.known.clear();
    for (const entity of entities) {
      entity.nextActionTime = this.time;
      entity.context.simulationTime = this.time;
      entity.actionReady = entity.type === "player";
      this.known.add(entity);
    }
  }

  update(entities: Entity[]) {
    const { hasEffect, removeEffect, log } = this.services;
    // Bound CPU work, not game time. Resume on the next frame if a large floor
    // needs more events; never advance time while the hero is awaiting input.
    for (let events = 0; events < 256; events++) {
      if (entities.some(e => e.context.pendingFall)) return;
      // A visible trap arrow is a hit waiting to land. Resolving anything else
      // first lets the victim walk away while the arrow is still in the air.
      if (entities.some(e => (e.context.pendingTrapArrows ?? 0) > 0)) return;
      const actors = entities.filter(e => e.type !== "item" && e.healthPoints > 0);
      if (!actors.some(e => e.type === "player")) return;
      for (const entity of this.known) {
        if (!entities.includes(entity)) this.known.delete(entity);
      }
      for (const actor of actors) {
        if (!this.known.has(actor)) {
          actor.nextActionTime = Math.max(this.time, actor.nextActionTime);
          this.known.add(actor);
        }
      }
      // Resolve movement/attack landings before allowing any later event.
      if (actors.some(e => e.moving)) return;

      const actor = actors.reduce((first, e) =>
        e.nextActionTime < first.nextActionTime - 1e-9 ||
        (Math.abs(e.nextActionTime - first.nextActionTime) < 1e-9 && e.type === "player")
          ? e : first
      );
      const targetTime = Math.max(this.time, actor.nextActionTime);
      const effectTime = Math.min(Infinity, ...actors.flatMap(e =>
        e.effects.filter(effect => !effect.manualExpiry || effect.tick)
          .map(effect => effect.nextTick ?? Infinity)
      ));
      const context = actor.context;
      const terrainTime = context.nextTerrainEvent?.() ?? Infinity;
      const nextEvent = Math.min(this.nextTick, effectTime, terrainTime);
      if (nextEvent <= targetTime + 1e-9) {
        this.time = Math.max(this.time, nextEvent);
        for (const entity of actors) entity.context.simulationTime = this.time;
        const upkeep = this.nextTick <= this.time + 1e-9;
        if (upkeep) this.nextTick++;
        // Hunger/regeneration/cooldowns use whole world-time units. Buffs
        // retain their own tick phase, including fractional application times.
        // Deaths may mutate entities and drop loot while this loop runs.
        for (const entity of actors) {
          if (!entities.includes(entity)) continue;
          if (upkeep) {
            entity.refresh();
            // Items do not get actor turns. Carried equipment receives exactly
            // one upkeep tick per world-time unit, independent of action speed.
            if (entity.type === 'player' && entity.healthPoints > 0) {
              for (const item of new Set(entity.context.player?.getAllItems?.() ?? [])) {
                item.refresh?.();
              }
            }
          }
          if (entities.includes(entity)) entity.tickEffects();
          if (entity.context.pendingFall) return;
        }
        if (terrainTime <= this.time + 1e-9) context.onTerrainEvent?.();
        continue;
      }

      this.time = targetTime;
      for (const entity of actors) entity.context.simulationTime = this.time;
      actor.nextActionTime = targetTime;
      actor.actionReady = true;
      if (hasEffect(actor, "stunned")) {
        if (actor.type === "player" || actor.context.visibleTiles.has(`${actor.x},${actor.y}`)) {
          log(actor.context, `${actor.type === "player" ? "You are stunned and miss" : `${actor.name} is stunned and misses`} an action.`);
        }
        const stun = actor.effects.find(effect => effect.id === "stunned")!;
        if (--stun.duration <= 0) removeEffect(actor, "stunned");
        actor.spendTime("wait");
      } else if (hasEffect(actor, "frozen")) {
        log(actor.context, `${actor.type === "player" ? "You are frozen and miss" : `${actor.name} is frozen and misses`} an action.`);
        removeEffect(actor, "frozen");
        actor.spendTime("wait");
        actor.freezeRecovery = true;
      } else {
        actor.turn();
      }
      // No action was taken: player input (including invalid actions) is free.
      if (actor.actionReady || actor.moving) return;
    }
  }
}
