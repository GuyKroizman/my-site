// Player-facing feedback for combat against actors the hero cannot see.
//
// The hero may now zap wands past the edge of sight. Damage and death still
// need a log entry, but naming a hidden monster (or its loot) would reveal
// information the player has not earned. These helpers replace the detailed
// line with a distant sound instead.

import type { Entity } from './entity';
import type { GameContext } from './context';
import { terrainFor } from './terrain.ts';

export const UNSEEN_PAIN = 'You hear a cry of pain in the distance.';
export const UNSEEN_KILL = 'You hear a cry of pain in the distance, then silence.';
export const UNSEEN_DEATH = 'You hear a death cry in the distance.';
export const UNSEEN_IMPACT = 'You hear a distant impact.';
export const UNSEEN_MISS = 'You hear your attack miss in the distance.';

// A victim killed by a hit whose cry was already logged must not log a second
// death line when its onDestroy hook runs. WeakSet entries vanish with the
// entity, and do not enter the save graph.
const deathAnnounced = new WeakSet<Entity>();

export function isEnemyVisible(context: GameContext, entity: Entity): boolean {
  if (entity.type !== 'enemy') return true;
  if (entity.x === undefined || entity.y === undefined) return true;
  // A caller without a perception snapshot cannot prove the victim hidden.
  if (!context.visibleTiles) return true;
  if (!context.visibleTiles.has(`${entity.x},${entity.y}`)) return false;
  const player = context.player;
  if (player?.x === undefined || player?.y === undefined) return true;
  return !terrainFor(context).isGrassConcealed(entity.x, entity.y, player.x, player.y);
}

function log(context: GameContext, text: string): void {
  if (!context.messages) return;
  context.messages.unshift(text);
  context.messages = context.messages.slice(0, 20);
}

// Log a landed hit. Visible victims keep their detailed line; hidden victims
// get a sound. A lethal unseen hit gets the "then silence" variant and marks
// the death as already reported.
export function announceHit(
  context: GameContext,
  victim: Entity,
  detail: string,
  damaged = false
): void {
  if (isEnemyVisible(context, victim)) {
    log(context, detail);
    return;
  }
  if (!damaged) {
    log(context, UNSEEN_IMPACT);
    return;
  }
  const lethal = victim.healthPoints <= 0;
  if (lethal) deathAnnounced.add(victim);
  log(context, lethal ? UNSEEN_KILL : UNSEEN_PAIN);
}

export function announceMiss(context: GameContext, victim: Entity, detail: string): void {
  log(context, isEnemyVisible(context, victim) ? detail : UNSEEN_MISS);
}

// Log a death line for a visible victim, or one generic death cry for a hidden
// one. Subsequent calls for the same entity (e.g. a frog's death cloud message
// followed by its base monster death) stay silent once the cry is logged.
export function announceDeath(context: GameContext, entity: Entity, detail: string): void {
  if (isEnemyVisible(context, entity)) {
    log(context, detail);
    return;
  }
  if (deathAnnounced.has(entity)) return;
  deathAnnounced.add(entity);
  log(context, UNSEEN_DEATH);
}
