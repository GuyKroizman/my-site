import type { GameContext } from "./context";
import { removeEntity, type Entity } from "./entity";
import Wand from "./items/wand";
import { clearFloorSprite, placeFloorItem } from "./itemPresentation";
import dungeon from "./dungeon";

// A flask of Liquid Flame shattering immediately to the right of two floor
// wands of the same type burns them together. The pair must be horizontal and
// adjacent, but the two wands may differ in upgrade level and in fusion power:
// a ×2 wand fused with an ordinary ×1 wand becomes ×3, the sum of both tiers.
// Upgrade levels never need to match either; the higher one survives.
export type WandFusionResult = {
  wand: Wand;
  impactX: number;
  impactY: number;
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
  power: number;
};

function floorWandAt(context: GameContext, x: number, y: number): Wand | undefined {
  return context.entities.find(entity =>
    entity instanceof Wand && entity.x === x && entity.y === y
  ) as Wand | undefined;
}

function fusionPower(wand: Wand): number {
  const count = Number(wand.fusionCount);
  return Number.isFinite(count) && count > 1 ? Math.floor(count) : 1;
}

export function canFuseWands(left: Wand, right: Wand): boolean {
  return left instanceof Wand && right instanceof Wand &&
    left.constructor === right.constructor &&
    left.x !== undefined && left.y !== undefined &&
    right.x !== undefined && right.y !== undefined &&
    right.x === left.x + 1 && right.y === left.y;
}

/**
 * Fuse the two floor wands immediately to the left of an impact tile.
 * Returns undefined when the shatter did not complete a valid pair.
 */
export function tryFuseWands(context: GameContext, impactX: number, impactY: number): WandFusionResult | undefined {
  const right = floorWandAt(context, impactX - 1, impactY);
  const left = floorWandAt(context, impactX - 2, impactY);
  if (!left || !right || !canFuseWands(left, right)) return undefined;

  const leftX = left.x!, leftY = left.y!;
  const rightX = right.x!, rightY = right.y!;
  // Fusion power is additive, so mixed tiers combine instead of dead-ending:
  // ×2 + ×1 makes ×3, and ×4 + ×2 makes ×6.
  const power = fusionPower(left) + fusionPower(right);
  // Keep the best upgrade investment and both wands' remaining charges.
  const level = Math.max(left.level, right.level);
  const charges = (left.charges ?? 0) + (right.charges ?? 0);
  // Never let fire burn a curse out of the pair for free.
  const cursed = left.cursed || right.cursed;
  const curseId = right.curseId || left.curseId;
  const blessed = left.blessed || right.blessed;

  removeEntity(context, left);

  right.level = level;
  right.fusionCount = power;
  right.cursed = cursed;
  right.curseId = curseId;
  right.curseLifted = cursed ? false : right.curseLifted && left.curseLifted;
  right.blessed = blessed;
  right.reconcileChargeScaling();
  right.charges = Math.min(right.maxCharges, charges);
  // The surviving wand needs fresh floor presentation because its old sprite
  // is replaced by the merge effect.
  clearFloorSprite(context, right);
  placeFloorItem(right);

  dungeon.log(context,
    `The flames fuse the wands into ${right.displayName} — as strong as ${power} wands.`);

  return { wand: right, impactX, impactY, leftX, leftY, rightX, rightY, power };
}

/** Wands are ordinary entities; this keeps type narrowing available to callers. */
export function isFloorWand(entity: Entity | undefined): entity is Wand {
  return entity instanceof Wand && entity.x !== undefined && entity.y !== undefined;
}
