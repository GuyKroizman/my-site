// Body-aware visibility and grass concealment.
//
// Rendering and combat feedback used to key off `entity.x/y` alone. The 3x3
// Unblinking Coil's centre can be two tiles away (hidden by tall grass) while its
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

export type RenderedEntity = Positioned & {
  type: string;
  // Tall objects: chests and mimics. Getter on Entity, so restored saves keep it.
  visibleAboveGrass?: boolean;
};

/** The grass directly under a tall object does not hide its occupant: a chest
 * or mimic shows over it. Grass elsewhere is still handled by the FOV, which
 * keeps tiles past it out of `visibleTiles`. */
export function entityIsGrassConcealed(
  entity: RenderedEntity, x: number | undefined, y: number | undefined,
  isConcealed: ConcealmentTest
): boolean {
  if (entity.visibleAboveGrass || x === undefined || y === undefined) return false;
  return isConcealed(x, y);
}

/** Scene0's reveal rule as a pure helper so it can be tested without Phaser.
 * `visible` drives mind markers; `rendered` also needs an in-view cell (or an
 * already-known tile for remembered items) and an unblocked foreground slot. */
export function resolveEntityVisibility(
  entity: RenderedEntity,
  options: {
    visibleTiles: ReadonlySet<string>;
    isSeen: (x: number, y: number) => boolean;
    isGrassConcealed: ConcealmentTest;
    foreground: ReadonlySet<object>;
  }
): { visible: boolean; rendered: boolean } {
  if (entity.x === undefined || entity.y === undefined) {
    return { visible: false, rendered: false };
  }
  const concealed: ConcealmentTest = (x, y) =>
    entityIsGrassConcealed(entity, x, y, options.isGrassConcealed);
  const visible = entity.type === 'enemy'
    ? actorIsVisible(entity, options.visibleTiles, concealed)
    : options.visibleTiles.has(`${entity.x},${entity.y}`) && !concealed(entity.x, entity.y);
  const revealed = entity.type === 'enemy'
    ? visible
    : options.isSeen(entity.x, entity.y) && !concealed(entity.x, entity.y);
  return { visible, rendered: options.foreground.has(entity) && revealed };
}
