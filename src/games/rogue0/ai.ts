import dungeon from "./dungeon";
import { canSee } from "./fov";
import { terrainFor } from './terrain';
import type { Entity } from "./entity";
import type { GameContext } from "./context";
import type { ActionKind } from "./timing";
import { hasEffect, fleeStep } from "./effects";
import { bodyDistance, bodyOverlapsAt } from "./actorBodies.ts";

// Enemies avoid stepping on traps they can perceive (revealed/armed plates).
// Hidden traps stay invisible, and confusion overrides avoidance entirely.
function isVisibleTrap(context: GameContext, x: number, y: number): boolean {
  return terrainFor(context).getTileState(x, y)?.trap === "visible";
}

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
    entity.visionRadius,
    terrainFor(entity.context)
  );
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
  // Bodies, not centres: a wide guardian can reach a hero two cells from its
  // centre because its body already fills the cell between them.
  return bodyDistance(entity, target) <= 1;
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
  return bodyDistance(entity, target) <= entity.range();
}

function visibleDecoy(entity: Entity): Entity | undefined {
  const context = entity.context;
  if (entity.x === undefined || entity.y === undefined) return undefined;
  if (!context?.entities) return undefined;
  for (const other of context.entities) {
    if (other === entity || !other.isDecoy || other.type !== "enemy" ||
        other.healthPoints <= 0 || other.x === undefined || other.y === undefined) continue;
    if (canSee(dungeon.getCurrentLevel(), entity.x, entity.y, other.x, other.y, entity.visionRadius, terrainFor(context))) {
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
  let moveAction: ActionKind = "move";

  // 1) Attack. Ranged enemies shoot when in range, but switch to a weaker
  //    melee sidearm when a target is adjacent (arming a bow point-blank is
  //    worse than a dagger). Melee enemies strike when adjacent. A visible
  //    mirror image is a valid target.
  if (attackTarget) {
    const adjacent = isAdjacentTo(entity, attackTarget);
    if (entity.range() > 0) {
      if (adjacent && entity.hasMeleeSidearm()) {
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
      } else if (inRange(entity, attackTarget) &&
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
    } else if (adjacent) {
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
  //    position, or wander. A pursuer that opens a door steps onto its tile
  //    in the same action, but still pays the fixed open-door action cost.
  if (!acted && canMove) {
    if (hasEffect(entity, "confused") && dungeon.confusedMove(entity.context, entity)) return;
    if (seesPlayer) {
      if (!isAdjacentTo(entity, player)) {
        const step = nextStepToward(entity, player.x, player.y);
        const action = step ? followStep(entity, step) : null;
        if (action) { acted = true; moveAction = action; }
      }
    } else if (decoy) {
      // Player unseen: investigate a visible mirror image instead.
      if (!isAdjacentTo(entity, decoy)) {
        const step = nextStepToward(entity, decoy.x!, decoy.y!);
        const action = step ? followStep(entity, step) : null;
        if (action) { acted = true; moveAction = action; }
      }
    } else if (entity.lastSeenX !== undefined && entity.lastSeenY !== undefined) {
      const step = nextStepToward(entity, entity.lastSeenX, entity.lastSeenY);
      if (step) {
        const action = followStep(entity, step);
        if (action) { acted = true; moveAction = action; }
      } else {
        // Arrived or the route no longer exists: resume roaming next action.
        entity.lastSeenX = undefined;
        entity.lastSeenY = undefined;
      }
    } else {
      acted = wanderStep(entity);
      moveAction = "move";
    }

    if (acted) {
      entity.spendTime(moveAction);
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
        dungeon.isWalkableTile(entity.context, nx, ny, entity) &&
        (entity.isFlying || !isVisibleTrap(entity.context, nx, ny))) step = { x: nx, y: ny };
  }
  step ??= randomAdjacentStep(entity.context, entity);
  if (!step) return false;

  roamingHeadings.set(entity, { x: step.x - entity.x, y: step.y - entity.y });
  dungeon.moveEntityTo(entity.context, entity, step.x, step.y);
  return true;
}

// Ring tiles around a target that a swarm can step onto (chasms are open to
// flying swarms; items do not block, matching moveEntityTo occupancy rules).
function isOpenSwarmTile(entity: Entity, x: number, y: number): boolean {
  const tiles = terrainFor(entity.context);
  const level = dungeon.getCurrentLevel();
  if (!level || y < 0 || x < 0 || y >= level.length || x >= level[0].length) return false;
  if (level[y][x] !== 0) return false;
  if (tiles.isBlocking(x, y) && !(entity.isFlying && tiles.getFeature(x, y) === "chasm")) return false;
  if (entity.context.entities.some(e => e !== entity && e.type !== "item" &&
      e.healthPoints > 0 && e.x === x && e.y === y)) return false;
  return true;
}

// Pick an unoccupied tile adjacent to the target that this swarm should head
// for, spreading swarms around the hero instead of beelining onto one tile.
function swarmSurroundStep(entity: Entity, target: Entity): { x: number; y: number } | null {
  if (entity.x === undefined || entity.y === undefined ||
      target.x === undefined || target.y === undefined) return null;

  const ring: Array<{ x: number; y: number }> = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = target.x + dx;
      const ny = target.y + dy;
      if (isOpenSwarmTile(entity, nx, ny)) ring.push({ x: nx, y: ny });
    }
  }
  if (ring.length === 0) return null;

  let best = ring[0];
  let bestDist = Infinity;
  for (const tile of ring) {
    const path = dungeon.findPath(entity.x, entity.y, tile.x, tile.y, true, true, entity);
    if (path.length > 0 && path.length < bestDist) {
      bestDist = path.length;
      best = tile;
    }
  }
  return best;
}

// Flies box the hero in: attack when adjacent, otherwise move one tile toward
// an unoccupied adjacent tile so multiple swarms approach from different sides.
export function swarmTurn(entity: Entity): void {
  const player = entity.context.player;
  if (!player || player.x === undefined || player.y === undefined) {
    entity.spendTime("wait");
    return;
  }

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
  if (hasEffect(entity, "charmed")) {
    const wandered = canMove && wanderStep(entity);
    entity.spendTime(wandered ? "move" : "wait");
    return;
  }

  const decoy = visibleDecoy(entity);
  const preferDecoy = !!decoy && Math.random() < 0.5;
  const attackTarget = (decoy && (preferDecoy || !seesPlayer))
    ? decoy
    : (seesPlayer ? player : null);

  let acted = false;
  let moveAction: ActionKind = "move";

  if (attackTarget && isAdjacentTo(entity, attackTarget)) {
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

  if (!acted && canMove && attackTarget && !isAdjacentTo(entity, attackTarget)) {
    const ringTile = swarmSurroundStep(entity, attackTarget);
    if (ringTile) {
      const step = nextStepToward(entity, ringTile.x, ringTile.y);
      const action = step ? followStep(entity, step) : null;
      if (action) { acted = true; moveAction = action; }
    }
  }

  if (!acted && canMove) {
    if (hasEffect(entity, "confused") && dungeon.confusedMove(entity.context, entity)) return;
    if (seesPlayer) {
      if (!isAdjacentTo(entity, player)) {
        const step = nextStepToward(entity, player.x, player.y);
        const action = step ? followStep(entity, step) : null;
        if (action) { acted = true; moveAction = action; }
      }
    } else if (decoy) {
      if (!isAdjacentTo(entity, decoy)) {
        const step = nextStepToward(entity, decoy.x!, decoy.y!);
        const action = step ? followStep(entity, step) : null;
        if (action) { acted = true; moveAction = action; }
      }
    } else if (entity.lastSeenX !== undefined && entity.lastSeenY !== undefined) {
      const step = nextStepToward(entity, entity.lastSeenX, entity.lastSeenY);
      if (step) {
        const action = followStep(entity, step);
        if (action) { acted = true; moveAction = action; }
      } else {
        entity.lastSeenX = undefined;
        entity.lastSeenY = undefined;
      }
    } else {
      acted = wanderStep(entity);
      moveAction = "move";
    }

    if (acted) {
      entity.spendTime(moveAction);
    }
  }

  if (!acted) entity.spendTime("wait");
}

export function nextStepToward(
  entity: Entity,
  tx: number,
  ty: number
): { x: number; y: number } | null {
  if (entity.x === undefined || entity.y === undefined) return null;

  const path = dungeon.findPath(entity.x, entity.y, tx, ty, true, true, entity);

  if (path.length > 1) {
    return { x: path[1][0], y: path[1][1] };
  }
  return null;
}

// Plan through doors and step through in one action, opening a closed door
// before entering its tile. Do not overlap another actor or forget the target
// just because a corridor is busy.
function followStep(entity: Entity, step: { x: number; y: number }): ActionKind | null {
  const tiles = terrainFor(entity.context);
  // Never step onto a revealed trap, even when it is the navigation target.
  // Flying actors ignore ground pressure plates entirely.
  if (!entity.isFlying && isVisibleTrap(entity.context, step.x, step.y)) return null;
  if (entity.context.entities.some(e =>
    e !== entity && (e.type === "player" || e.type === "enemy") &&
    e.healthPoints > 0 && bodyOverlapsAt(entity, step.x, step.y, e)
  )) return null;
  let openedDoor = false;
  if (tiles.getDoorState(step.x, step.y) === "closed") {
    if (!dungeon.openDoor(step.x, step.y)) return null;
    // The pursuer opens the door and steps onto its tile in the same action.
    // It has not yet had a chance to react, so the waiting player's next hit
    // can still land as a surprise attack.
    entity.awareOfPlayer = false;
    openedDoor = true;
  }
  dungeon.moveEntityTo(entity.context, entity, step.x, step.y);
  return openedDoor ? "openDoor" : "move";
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
        dungeon.isWalkableTile(context, nx, ny, entity) &&
        (entity.isFlying || !isVisibleTrap(context, nx, ny))) {
      return { x: nx, y: ny };
    }
  }

  return null;
}
