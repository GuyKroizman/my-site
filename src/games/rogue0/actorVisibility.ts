// Body-aware visibility and grass concealment.
//
// Rendering and combat feedback used to key off `entity.x/y` alone. A 3x3
// guardian's centre can be two tiles away (hidden by tall grass) while its
// exposed edge is adjacent to the hero and in melee range. A creature is
// visible when any occupied cell is visible, and is concealed only when every
// occupied cell is grass-concealed.
import { actorFootprint } from './actorBodies.ts';
import { footprintTiles } from './footprint.ts';

type Positioned = {
  x?: number;
  y?: number;
  footprint?: { width: number; height: number; originX: number; originY: number };
  bodyRadius?: number;
};

export type ConcealmentTest = (x: number, y: number) => boolean;

/** Any one occupied cell is inside the current field of view. */
export function actorHasVisibleTile(
  actor: Positioned, visibleTiles: ReadonlySet<string>
): boolean {
  if (actor.x === undefined || actor.y === undefined) return false;
  for (const [x, y] of footprintTiles(actorFootprint(actor), actor.x, actor.y)) {
    if (visibleTiles.has(`${x},${y}`)) return true;
  }
  return false;
}

/** True only when every occupied cell is grass-concealed. */
export function actorIsConcealed(
  actor: Positioned, isConcealed: ConcealmentTest
): boolean {
  if (actor.x === undefined || actor.y === undefined) return true;
  for (const [x, y] of footprintTiles(actorFootprint(actor), actor.x, actor.y)) {
    if (!isConcealed(x, y)) return false;
  }
  return true;
}

/** Visibility for monsters and immediate combat feedback: at least one
 * occupied cell must be both currently visible and not grass-concealed.
 * Concealment of unseen cells must not reveal a body whose only visible cell
 * is the grass-covered centre. */
export function actorIsVisible(
  actor: Positioned, visibleTiles: ReadonlySet<string>, isConcealed: ConcealmentTest
): boolean {
  if (actor.x === undefined || actor.y === undefined) return false;
  for (const [x, y] of footprintTiles(actorFootprint(actor), actor.x, actor.y)) {
    if (visibleTiles.has(`${x},${y}`) && !isConcealed(x, y)) return true;
  }
  return false;
}
