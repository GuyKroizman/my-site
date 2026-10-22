import dungeon from "./dungeon";
import { canSee } from "./fov";
import * as tiles from "./tiles";
import type { Entity } from "./entity";
import type { GameContext } from "./context";
import { hasEffect, fleeStep } from "./effects";

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
    entity.spendTime("wait");
    return;
  }

  // Wait for the current move/attack tween to finish before acting again.
  if (entity.moving) return;

  const canMove = !hasEffect(entity, "rooted");
  if (hasEffect(entity, "terrified")) {
    const fled = canMove && fleeStep(entity, entity.context);
    entity.spendTime(fled ? "move" : "wait");
    return;
  }

  const seesPlayer = enemyCanSeePlayer(entity);
  let acted = false;

  // 1) Attack. Ranged enemies shoot when in range; melee enemies strike
  //    when adjacent.
  if (seesPlayer) {
    if (entity.range() > 0) {
      if (inRange(entity, player)) {
        dungeon.attackEntity(
          entity.context,
          entity,
          player,
          entity.attackTile,
          entity.tint,
          entity.damageType
        );
        entity.spendTime("attack");
        acted = true;
      }
    } else if (isAdjacentToPlayer(entity, player)) {
      dungeon.attackEntity(
        entity.context,
        entity,
        player,
        0,
        undefined,
        entity.damageType
      );
      entity.spendTime("attack");
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
        } else if (tryOpenAdjacentDoor(entity, player.x, player.y)) {
          acted = true;
        }
      }
    } else if (entity.lastSeenX !== undefined && entity.lastSeenY !== undefined) {
      const step = nextStepToward(entity, entity.lastSeenX, entity.lastSeenY);
      if (step) {
        dungeon.moveEntityTo(entity.context, entity, step.x, step.y);
        acted = true;
      } else if (tryOpenAdjacentDoor(entity, entity.lastSeenX, entity.lastSeenY)) {
        acted = true;
      } else {
        entity.lastSeenX = undefined;
        entity.lastSeenY = undefined;
      }
    } else {
      acted = wanderStep(entity);
    }

    if (acted) {
      entity.spendTime("move");
    }
  }

  // Blocked/idle actors still spend time, so they cannot starve the queue.
  if (!acted) entity.spendTime("wait");
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

  const path = dungeon.findCardinalPath(entity.x, entity.y, tx, ty);

  if (path.length > 1) {
    return { x: path[1][0], y: path[1][1] };
  }
  return null;
}

// When the pathfinder cannot reach the target (typically because a closed
// door sits between the monster and its goal), open the adjacent door that
// lies closest to the target instead of getting stuck.
function tryOpenAdjacentDoor(entity: Entity, tx: number, ty: number): boolean {
  if (entity.x === undefined || entity.y === undefined) return false;

  const ex = entity.x;
  const ey = entity.y;

  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  dirs.sort((a, b) => {
    const da = (ex + a[0] - tx) ** 2 + (ey + a[1] - ty) ** 2;
    const db = (ex + b[0] - tx) ** 2 + (ey + b[1] - ty) ** 2;
    return da - db;
  });

  for (const [dx, dy] of dirs) {
    const nx = ex + dx;
    const ny = ey + dy;
    if (
      tiles.getFeature(nx, ny) === "door" &&
      tiles.getDoorState(nx, ny) === "closed"
    ) {
      return dungeon.openDoor(nx, ny);
    }
  }

  return false;
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
