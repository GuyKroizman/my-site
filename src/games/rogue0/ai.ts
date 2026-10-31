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

  if (hasEffect(player, "invisible")) return false;

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

function isAdjacentTo(entity: Entity, target: Entity): boolean {
  if (
    entity.x === undefined ||
    entity.y === undefined ||
    target.x === undefined ||
    target.y === undefined
  ) {
    return false;
  }
  return chebyshev(entity.x, entity.y, target.x, target.y) <= 1;
}

function inRange(entity: Entity, target: Entity): boolean {
  if (
    entity.x === undefined ||
    entity.y === undefined ||
    target.x === undefined ||
    target.y === undefined
  ) {
    return false;
  }
  return chebyshev(entity.x, entity.y, target.x, target.y) <= entity.range();
}

function visibleDecoy(entity: Entity): Entity | undefined {
  const context = entity.context;
  if (entity.x === undefined || entity.y === undefined) return undefined;
  if (!context?.entities) return undefined;
  for (const other of context.entities) {
    if (other === entity || !other.isDecoy || other.type !== "enemy" ||
        other.healthPoints <= 0 || other.x === undefined || other.y === undefined) continue;
    if (canSee(dungeon.getCurrentLevel(), entity.x, entity.y, other.x, other.y, entity.visionRadius)) {
      return other;
    }
  }
  return undefined;
}

export function enemyTurn(entity: Entity): void {
  const player = entity.context.player;
  if (!player || player.x === undefined || player.y === undefined) {
    entity.spendTime("wait");
    return;
  }

  // Wait for the current move/attack tween to finish before acting again.
  if (entity.moving) return;

  const seesPlayer = enemyCanSeePlayer(entity);
  entity.awareOfPlayer = seesPlayer;
  if (seesPlayer) {
    entity.lastSeenX = player.x;
    entity.lastSeenY = player.y;
  }

  const canMove = !hasEffect(entity, "rooted");
  if (hasEffect(entity, "terrified")) {
    if (canMove && hasEffect(entity, "confused") && dungeon.confusedMove(entity.context, entity)) return;
    const fled = canMove && fleeStep(entity, entity.context);
    entity.spendTime(fled ? "move" : "wait");
    return;
  }

  // Charmed enemies refuse to fight or chase; they mill about instead.
  if (hasEffect(entity, "charmed")) {
    const wandered = canMove && wanderStep(entity);
    entity.spendTime(wandered ? "move" : "wait");
    return;
  }

  const decoy = visibleDecoy(entity);
  // When both the hero and a mirror image are valid targets, the enemy wastes
  // its action on the image about half the time.
  const preferDecoy = !!decoy && Math.random() < 0.5;
  const attackTarget = (decoy && (preferDecoy || !seesPlayer))
    ? decoy
    : (seesPlayer ? player : null);

  let acted = false;

  // 1) Attack. Ranged enemies shoot when in range; melee enemies strike
  //    when adjacent. A visible mirror image is a valid target.
  if (attackTarget) {
    if (entity.range() > 0) {
      if (inRange(entity, attackTarget) &&
          dungeon.firstActorInPath(entity.context, entity, attackTarget.x!, attackTarget.y!) === attackTarget) {
        dungeon.attackEntity(
          entity.context,
          entity,
          attackTarget,
          entity.attackTile,
          entity.tint,
          entity.damageType
        );
        entity.spendTime("attack");
        acted = true;
      }
    } else if (isAdjacentTo(entity, attackTarget)) {
      dungeon.attackEntity(
        entity.context,
        entity,
        attackTarget,
        0,
        undefined,
        entity.damageType
      );
      entity.spendTime("attack");
      acted = true;
    }
  }

  // 2) Move toward the player, a visible mirror image, their last known
  //    position, or wander.
  if (!acted && canMove) {
    if (hasEffect(entity, "confused") && dungeon.confusedMove(entity.context, entity)) return;
    if (seesPlayer) {
      if (!isAdjacentTo(entity, player)) {
        const step = nextStepToward(entity, player.x, player.y);
        if (step) acted = followStep(entity, step);
      }
    } else if (decoy) {
      // Player unseen: investigate a visible mirror image instead.
      if (!isAdjacentTo(entity, decoy)) {
        const step = nextStepToward(entity, decoy.x!, decoy.y!);
        if (step) acted = followStep(entity, step);
      }
    } else if (entity.lastSeenX !== undefined && entity.lastSeenY !== undefined) {
      const step = nextStepToward(entity, entity.lastSeenX, entity.lastSeenY);
      if (step) {
        acted = followStep(entity, step);
      } else {
        // Arrived or the route no longer exists: resume roaming next action.
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

// Keep a heading for a few turns so idle creatures patrol corridors rather
// than vibrating in one spot. Weak keys also preserve headings on floor revisits.
const roamingHeadings = new WeakMap<Entity, { x: number; y: number }>();

function wanderStep(entity: Entity): boolean {
  if (Math.random() >= 0.5 || entity.x === undefined || entity.y === undefined) return false;

  const heading = roamingHeadings.get(entity);
  let step: { x: number; y: number } | null = null;
  if (heading && Math.random() < 0.75) {
    const nx = entity.x + heading.x;
    const ny = entity.y + heading.y;
    if (dungeon.canStepBetween(entity.x, entity.y, nx, ny) &&
        dungeon.isWalkableTile(entity.context, nx, ny)) step = { x: nx, y: ny };
  }
  step ??= randomAdjacentStep(entity.context, entity);
  if (!step) return false;

  roamingHeadings.set(entity, { x: step.x - entity.x, y: step.y - entity.y });
  dungeon.moveEntityTo(entity.context, entity, step.x, step.y);
  return true;
}

export function nextStepToward(
  entity: Entity,
  tx: number,
  ty: number
): { x: number; y: number } | null {
  if (entity.x === undefined || entity.y === undefined) return null;

  const path = dungeon.findPath(entity.x, entity.y, tx, ty, true);

  if (path.length > 1) {
    return { x: path[1][0], y: path[1][1] };
  }
  return null;
}

// Plan through doors and open them while stepping in, like a pursuer
// emerging through a doorway into an ambush. Do not
// overlap another actor or forget the target just because a corridor is busy.
function followStep(entity: Entity, step: { x: number; y: number }): boolean {
  if (entity.context.entities.some(e =>
    e !== entity && (e.type === "player" || e.type === "enemy") &&
    e.healthPoints > 0 && e.x === step.x && e.y === step.y
  )) return false;
  if (tiles.getDoorState(step.x, step.y) === "closed") {
    if (!dungeon.openDoor(step.x, step.y)) return false;
    // Opening/entering a doorway occupies this action. Even a monster that
    // saw us before opening it is exposed until its next turn or our first hit.
    entity.awareOfPlayer = false;
  }
  dungeon.moveEntityTo(entity.context, entity, step.x, step.y);
  return true;
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
    [0, -1],
    [-1, -1], [1, -1], [-1, 1], [1, 1]
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
    if (dungeon.canStepBetween(entity.x, entity.y, nx, ny) &&
        dungeon.isWalkableTile(context, nx, ny)) {
      return { x: nx, y: ny };
    }
  }

  return null;
}
