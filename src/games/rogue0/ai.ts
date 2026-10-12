import dungeon from "./dungeon";
import { canSee } from "./fov";
import type { Entity } from "./entity";
import type { GameContext } from "./context";

export function enemyCanSeePlayer(entity: Entity): boolean {
  const player = entity.context.player;
  if (
    !player ||
    player.x === undefined ||
    player.y === undefined ||
    entity.x === undefined ||
    entity.y === undefined
  ) {
    return false;
  }

  return canSee(
    dungeon.getCurrentLevel(),
    entity.x,
    entity.y,
    player.x,
    player.y,
    entity.visionRadius
  );
}

function chebyshev(aX: number, aY: number, bX: number, bY: number): number {
  return Math.max(Math.abs(aX - bX), Math.abs(aY - bY));
}

function isAdjacentToPlayer(entity: Entity, player: Entity): boolean {
  if (
    entity.x === undefined ||
    entity.y === undefined ||
    player.x === undefined ||
    player.y === undefined
  ) {
    return false;
  }
  return chebyshev(entity.x, entity.y, player.x, player.y) <= 1;
}

function inRange(entity: Entity, player: Entity): boolean {
  if (
    entity.x === undefined ||
    entity.y === undefined ||
    player.x === undefined ||
    player.y === undefined
  ) {
    return false;
  }
  return chebyshev(entity.x, entity.y, player.x, player.y) <= entity.range();
}

export function enemyTurn(entity: Entity): void {
  const player = entity.context.player;
  if (!player || player.x === undefined || player.y === undefined) {
    entity.movementPoints = 0;
    entity.actionPoints = 0;
    return;
  }

  // Wait for the current move/attack tween to finish before acting again.
  if (entity.moving) return;

  const canAttack = entity.actionPoints > 0;
  const canMove = entity.movementPoints > 0;
  if (!canAttack && !canMove) return;

  const seesPlayer = enemyCanSeePlayer(entity);
  let acted = false;

  // 1) Attack. Ranged enemies shoot when in range; melee enemies strike
  //    when adjacent.
  if (canAttack && seesPlayer) {
    if (entity.range() > 0) {
      if (inRange(entity, player)) {
        dungeon.attackEntity(
          entity.context,
          entity,
          player,
          entity.attackTile,
          entity.tint
        );
        entity.actionPoints -= 1;
        acted = true;
      }
    } else if (isAdjacentToPlayer(entity, player)) {
      dungeon.attackEntity(entity.context, entity, player, 0, undefined);
      entity.actionPoints -= 1;
      acted = true;
    }
  }

  // 2) Move toward the player, their last known position, or wander.
  if (!acted && canMove) {
    if (seesPlayer) {
      entity.lastSeenX = player.x;
      entity.lastSeenY = player.y;
      if (!isAdjacentToPlayer(entity, player)) {
        const step = nextStepToward(entity, player.x, player.y);
        if (step) {
          dungeon.moveEntityTo(entity.context, entity, step.x, step.y);
          acted = true;
        }
      }
    } else if (entity.lastSeenX !== undefined && entity.lastSeenY !== undefined) {
      const step = nextStepToward(entity, entity.lastSeenX, entity.lastSeenY);
      if (step) {
        dungeon.moveEntityTo(entity.context, entity, step.x, step.y);
        acted = true;
      } else {
        entity.lastSeenX = undefined;
        entity.lastSeenY = undefined;
      }
    } else {
      acted = wanderStep(entity);
    }

    if (acted) {
      entity.movementPoints -= 1;
    }
  }

  // If we couldn't do anything useful (blocked, out of range with no movement
  // left), pass the rest of the turn so the game doesn't stall.
  if (!acted) {
    entity.movementPoints = 0;
    entity.actionPoints = 0;
  }
}

function wanderStep(entity: Entity): boolean {
  if (Math.random() >= 0.5) return false;

  const step = randomAdjacentStep(entity.context, entity);
  if (!step) return false;

  dungeon.moveEntityTo(entity.context, entity, step.x, step.y);
  return true;
}

export function nextStepToward(
  entity: Entity,
  tx: number,
  ty: number
): { x: number; y: number } | null {
  if (entity.x === undefined || entity.y === undefined) return null;

  const grid = dungeon.getPathGrid();
  const finder = dungeon.getCardinalFinder();
  const path = finder.findPath(entity.x, entity.y, tx, ty, grid);

  if (path.length > 1) {
    return { x: path[1][0], y: path[1][1] };
  }
  return null;
}

export function randomAdjacentStep(
  context: GameContext,
  entity: Entity
): { x: number; y: number } | null {
  if (entity.x === undefined || entity.y === undefined) return null;

  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  // Shuffle so wandering feels less mechanical.
  for (let i = dirs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
  }

  const map = dungeon.getCurrentLevel();
  const w = map[0].length;
  const h = map.length;

  for (const [dx, dy] of dirs) {
    const nx = entity.x + dx;
    const ny = entity.y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    if (dungeon.isWalkableTile(context, nx, ny)) {
      return { x: nx, y: ny };
    }
  }

  return null;
}
