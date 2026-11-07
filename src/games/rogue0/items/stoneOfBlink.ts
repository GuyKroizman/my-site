import GlyphStone from "./glyphStone";
import { GLYPH_STONE_TEXTURES } from "../glyphStoneTextures";
import dungeon from "../dungeon";
import { bresenhamLine } from "../fov";
import { terrainFor } from "../terrain";
import type { Entity } from "../entity";
import type { GameContext } from "../context";

// The stone is thrown at a destination, so "use" should immediately start
// throw targeting instead of swallowing it.
export default class StoneOfBlink extends GlyphStone {
  name = "Stone of Blink";
  description = "Throw it to teleport to the tile where it lands.";
  textureKey = GLYPH_STONE_TEXTURES.blink;
  throwToUse = true;

  onThrownLand(tx: number, ty: number): boolean {
    const context = this.context;
    const player = context.player;
    if (!player || player.healthPoints <= 0 ||
        player.x === undefined || player.y === undefined) return false;

    // A chasm is a one-way trip: the stone falls through and pulls the hero to
    // the next floor instead of leaving the stone there to be picked up.
    if (terrainFor(context).getFeature(tx, ty) === "chasm") {
      if (context.floor >= context.maxFloor) {
        dungeon.log(context, "The Stone of Blink vanishes into the abyss. There is no floor below.");
        return true;
      }
      player.walkPath = [];
      player.inputBuffer = [];
      player.actionReady = false;
      context.pendingFall = true;
      context.pendingBlinkFall = true;
      dungeon.log(context, "The Stone of Blink tumbles into the chasm and pulls you through!");
      return true;
    }

    if (!canBlinkTo(context, player, tx, ty)) {
      // A living actor stops the stone like any other thrown item. Blink to the
      // last clear tile before it, never around or beyond the blocker.
      const blocker = context.entities.find(entity =>
        entity !== player && entity.type !== "item" && entity.healthPoints > 0 &&
        entity.x === tx && entity.y === ty
      );
      if (blocker) {
        const landing = lastClearTileBefore(context, player, blocker);
        if (landing) {
          movePlayer(context, player, landing.x, landing.y);
          dungeon.log(context,
            `The Stone of Blink is stopped by ${blocker.name} and carries you to the last clear tile.`);
        } else {
          dungeon.log(context, `The Stone of Blink is stopped by ${blocker.name}.`);
        }
        return true;
      }
      // Non-floor destinations keep their usual thrown-item landing behaviour.
      return false;
    }

    movePlayer(context, player, tx, ty);
    dungeon.log(context, "The Stone of Blink carries you to its landing spot.");
    return true;
  }
}

// Blink obeys the same destination rules as any thrown object: the landing
// tile must be in bounds, walkable floor and free of living actors.
export function canBlinkTo(
  context: GameContext,
  player: Entity,
  tx: number,
  ty: number
): boolean {
  const level = context.currentLevel;
  if (!level?.length) return false;
  if (tx < 0 || ty < 0 || ty >= level.length || tx >= level[0].length) return false;
  if (level[ty][tx] !== 0) return false;
  if (terrainFor(context).isBlocking(tx, ty)) return false;
  return !occupiedByActor(context, player, tx, ty);
}

function occupiedByActor(
  context: GameContext,
  player: Entity,
  x: number,
  y: number
): boolean {
  return context.entities.some(entity =>
    entity !== player && entity.type !== "item" && entity.healthPoints > 0 &&
    entity.x === x && entity.y === y
  );
}

// Walk the flight line up to the blocker and keep the last landable tile.
function lastClearTileBefore(
  context: GameContext,
  player: Entity,
  blocker: Entity
): { x: number; y: number } | undefined {
  if (player.x === undefined || player.y === undefined ||
      blocker.x === undefined || blocker.y === undefined) return undefined;
  let landing: { x: number; y: number } | undefined;
  for (const [x, y] of bresenhamLine(player.x, player.y, blocker.x, blocker.y)) {
    if (x === blocker.x && y === blocker.y) break;
    if (x === player.x && y === player.y) continue;
    if (canBlinkTo(context, player, x, y)) landing = { x, y };
  }
  return landing;
}

function movePlayer(
  context: GameContext,
  player: Entity,
  x: number,
  y: number
): void {
  player.x = x;
  player.y = y;
  if (context.player === player) {
    context.player.walkPath = [];
    context.player.inputBuffer = [];
  }
  if (context.map && player.sprite) {
    player.sprite.setPosition(
      context.map.tileToWorldX(x)!,
      context.map.tileToWorldY(y)!
    );
  }
}
