// Physical footprints are not the same as artwork. Every actor occupies a
// rectangular block of map cells: one cell for ordinary actors, a wider or
// taller block for large creatures. Movement, AI, targeting, projectiles and
// inspection all use these helpers so the body is consistent everywhere.
//
// A `bodyRadius` fallback remains for legacy fixtures and objects created
// before the footprint migration. New code should carry a `footprint`.
import {
  TILE_FOOTPRINT,
  footprintContains,
  footprintGap,
  footprintsOverlap
} from './footprint.ts';
import type { Footprint } from './footprint.ts';

export type BodyActor = {
  x?: number;
  y?: number;
  type?: string;
  healthPoints?: number;
  footprint?: Footprint;
  /** @deprecated Centered square body from before footprints. */
  bodyRadius?: number;
};

/** Resolve the physical footprint of any actor-like value. */
export function actorFootprint(actor: BodyActor | undefined): Footprint {
  const declared = actor?.footprint;
  // Legacy fixtures attach bodyRadius to real Entity instances whose prototype
  // getter returns the default 1x1 footprint; only an explicit non-default
  // footprint outranks the old radius.
  if (declared && declared !== TILE_FOOTPRINT) return declared;
  const raw = actor?.bodyRadius ?? 0;
  const radius = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
  if (radius === 0) return declared ?? TILE_FOOTPRINT;
  return {
    width: radius * 2 + 1,
    height: radius * 2 + 1,
    originX: radius,
    originY: radius
  };
}

/** Chebyshev gap between two bodies: 0 when they touch or overlap. */
export function bodyDistance(a: BodyActor, b: BodyActor): number {
  if (a.x === undefined || a.y === undefined || b.x === undefined || b.y === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  return footprintGap(actorFootprint(a), a.x, a.y, actorFootprint(b), b.x, b.y);
}

/** Would the actor's body overlap another body if it stood on x,y? */
export function bodyOverlapsAt(actor: BodyActor, x: number, y: number, other: BodyActor): boolean {
  if (other.x === undefined || other.y === undefined) return false;
  return footprintsOverlap(actorFootprint(actor), x, y, actorFootprint(other), other.x, other.y);
}

/** Does x,y fall inside this actor's body footprint? */
export function bodyAtTile(actor: BodyActor, x: number, y: number): boolean {
  if (actor.x === undefined || actor.y === undefined) return false;
  return footprintContains(actorFootprint(actor), actor.x, actor.y, x, y);
}

/** First living, non-item body covering x,y. Items never own extra cells. */
export function actorBodyAtTile<T extends BodyActor>(
  entities: readonly T[], x: number, y: number, exclude?: T
): T | undefined {
  return entities.find(entity =>
    entity !== exclude && entity.type !== 'item' && (entity.healthPoints ?? 0) > 0 &&
    bodyAtTile(entity, x, y));
}
