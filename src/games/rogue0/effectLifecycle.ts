// Base-entity status lifecycle. Keep runtime dependencies on dungeon code and
// Entity subclasses out of this module: Entity calls it during world ticks,
// before those subclasses are necessarily initialized by the module loader.
import type { Entity } from './entity';
import type { GameContext } from './context';

export function logStatusEffect(entity: Entity, text: string): void {
  const context = entity.context;
  // Off-screen effects still run, but must not leak monster activity into the log.
  if (entity.type === 'enemy' && !context.visibleTiles.has(`${entity.x},${entity.y}`)) return;
  context.messages.unshift(text);
  context.messages = context.messages.slice(0, 20);
}

export function removeEffect(entity: Entity, effectId: string): void {
  const index = entity.effects.findIndex((e) => e.id === effectId);
  if (index === -1) return;

  const [effect] = entity.effects.splice(index, 1);
  effect.remove?.(entity, entity.context);
  // The potion's delayed mending ends quietly: its payouts are visible in the
  // health display, so no "wears off" line for it.
  if (effect.id !== 'potion-healing') {
    logStatusEffect(entity, `${entity.type === 'player' ? 'Your' : `${entity.name}'s`} ${effect.name} wears off.`);
  }
}

export function tickEffects(entity: Entity, context: GameContext): void {
  for (const effect of [...entity.effects]) {
    const now = context.simulationTime ?? 0;
    if (effect.nextTick === undefined) effect.nextTick = now + 1;
    if (effect.nextTick > now + 1e-9) continue;
    effect.nextTick += 1;
    effect.tick?.(entity, context);

    // The tick callback may have removed the effect itself.
    if (!entity.effects.includes(effect)) continue;
    if (effect.manualExpiry) continue;

    effect.duration -= 1;
    if (effect.duration <= 0) removeEffect(entity, effect.id);
  }
}
