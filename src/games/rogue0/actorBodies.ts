// Physical footprints are not the same as artwork. Most actors occupy exactly
// their own cell; the scaled guardian spreads over a 3x3 body so the hero can
// never stand underneath its sprite. Movement, AI and attacks all use these
// helpers so the larger body is consistent everywhere.
export type BodyActor = {
  x?: number;
  y?: number;
  type?: string;
  healthPoints?: number;
  bodyRadius?: number;
};

export function bodyRadius(actor: BodyActor | undefined): number {
  const radius = actor?.bodyRadius ?? 0;
  return Number.isFinite(radius) ? Math.max(0, Math.floor(radius)) : 0;
}

/** Chebyshev distance between two bodies: 0 when they touch or overlap. */
export function bodyDistance(a: BodyActor, b: BodyActor): number {
  if (a.x === undefined || a.y === undefined || b.x === undefined || b.y === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) -
    bodyRadius(a) - bodyRadius(b));
}

/** Would the actor's body overlap another body if it stood on x,y? */
export function bodyOverlapsAt(actor: BodyActor, x: number, y: number, other: BodyActor): boolean {
  if (other.x === undefined || other.y === undefined) return false;
  return Math.max(Math.abs(x - other.x), Math.abs(y - other.y)) <=
    bodyRadius(actor) + bodyRadius(other);
}

/** Does x,y fall inside this actor's body footprint? */
export function bodyAtTile(actor: BodyActor, x: number, y: number): boolean {
  if (actor.x === undefined || actor.y === undefined) return false;
  return Math.max(Math.abs(x - actor.x), Math.abs(y - actor.y)) <= bodyRadius(actor);
}

/** First living, non-item body covering x,y. Items never own extra cells. */
export function actorBodyAtTile<T extends BodyActor>(
  entities: readonly T[], x: number, y: number, exclude?: T
): T | undefined {
  return entities.find(entity =>
    entity !== exclude && entity.type !== 'item' && (entity.healthPoints ?? 0) > 0 &&
    bodyAtTile(entity, x, y));
}
