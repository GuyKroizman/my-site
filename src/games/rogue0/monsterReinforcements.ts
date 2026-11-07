// Floor population guard.
//
// Every visitable floor must contain at least one living monster. When the
// last one dies, the scene gathers walkable tiles and this module picks a small
// wave outside the hero's current field of view, far enough away that it cannot
// arrive on top of the corpse. Floors are always much larger than the FOV, so
// unseen space is effectively guaranteed. The module stays renderer-independent
// so the selection rules can be tested without Phaser; the scene supplies the
// monster constructors.

import type { Entity } from "./entity";
import type { GameContext } from "./context";

export type ReinforcementTile = { x: number; y: number };

export type ReinforcementKind =
  | "skeleton"
  | "goblin"
  | "swarm"
  | "quloptsh"
  | "ghoul"
  | "brute"
  | "cultist"
  | "wraith"
  | "elemental"
  | "frog";

// Far enough that a fresh wave cannot surround or ambush a hero standing on
// the corpse of the previous last monster.
export const REINFORCEMENT_MIN_DISTANCE = 8;

export function isLivingMonster(entity: Entity): boolean {
  return entity.type === "enemy" && !entity.isDecoy && entity.healthPoints > 0;
}

export function floorIsEmptyOfMonsters(entities: Entity[]): boolean {
  return !entities.some(isLivingMonster);
}

// Boss floors are the guardian's arena: they are generated with the guardian
// alone, so nothing is drawn onto them after it dies either. Kept dependency
// free (like dungeon.bossSealsFloor) so this module can be imported and tested
// without the renderer, and mirrors progression.isBossFloor.
export const REINFORCEMENT_BOSS_FLOOR_EVERY = 5;
export function floorAllowsReinforcements(floor: number): boolean {
  return !(Number.isInteger(floor) && floor > 0 && floor % REINFORCEMENT_BOSS_FLOOR_EVERY === 0);
}

export function reinforcementCount(floor: number, random: () => number = Math.random): number {
  const depthBonus = floor >= 8 ? 1 : 0;
  return 2 + depthBonus + (random() < 0.35 ? 1 : 0);
}

// Weighted pool by depth. Floor 1 reinforces with skeletons only; later
// floors can reuse the regular roster, never the Bone Lord.
export function pickReinforcementKind(
  floor: number,
  random: () => number = Math.random
): ReinforcementKind {
  const table: Array<[ReinforcementKind, number]> = [
    ["skeleton", 4],
    ["goblin", floor >= 2 ? 2 : 0],
    ["swarm", floor >= 2 ? 1 : 0],
    ["quloptsh", floor >= 3 ? 2 : 0],
    ["ghoul", floor >= 3 ? 1 : 0],
    ["brute", floor >= 3 ? 1 : 0],
    ["cultist", floor >= 3 ? 1 : 0],
    ["wraith", floor >= 3 ? 1 : 0],
    ["elemental", floor >= 3 ? 2 : 0],
    ["frog", floor >= 4 ? 1 : 0]
  ];
  const total = table.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [kind, weight] of table) {
    if (weight <= 0) continue;
    roll -= weight;
    if (roll < 0) return kind;
  }
  return "skeleton";
}

export type ReinforcementSelection = {
  blocked?: (x: number, y: number) => boolean;
  // True when the tile is not currently visible to the hero.
  hidden?: (x: number, y: number) => boolean;
  minDistance?: number;
  random?: () => number;
};

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Spawn only where the hero cannot see the arrival. Real floors are far larger
// than the FOV, so a wave can always fit outside it; the visible fallback below
// exists only for degenerate test maps so a floor still cannot stay empty.
// Within the unseen set, distant tiles are preferred over nearby ones.
export function selectReinforcementTiles(
  candidates: ReinforcementTile[],
  player: { x?: number; y?: number },
  count: number,
  options: ReinforcementSelection = {}
): ReinforcementTile[] {
  const wanted = Math.max(0, Math.floor(count));
  if (!wanted) return [];

  const blocked = options.blocked ?? (() => false);
  const hidden = options.hidden ?? (() => false);
  const minDistance = options.minDistance ?? REINFORCEMENT_MIN_DISTANCE;
  const random = options.random ?? Math.random;

  const hiddenDistant: ReinforcementTile[] = [];
  const hiddenNear: ReinforcementTile[] = [];
  const visibleDistant: ReinforcementTile[] = [];
  const visibleNear: ReinforcementTile[] = [];
  const seen = new Set<string>();
  for (const tile of candidates) {
    const key = `${tile.x},${tile.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (blocked(tile.x, tile.y)) continue;
    const distant = player.x === undefined || player.y === undefined
      ? true
      : Math.hypot(tile.x - player.x, tile.y - player.y) >= minDistance;
    const unseen = hidden(tile.x, tile.y);
    if (unseen) (distant ? hiddenDistant : hiddenNear).push(tile);
    else (distant ? visibleDistant : visibleNear).push(tile);
  }

  const chosen: ReinforcementTile[] = [];
  for (const bucket of [hiddenDistant, hiddenNear]) {
    if (chosen.length >= wanted) break;
    chosen.push(...shuffled(bucket, random).slice(0, wanted - chosen.length));
  }
  // Never spill into view while unseen tiles remain. Only a map with no unseen
  // walkable tile at all may use the visible fallback.
  if (chosen.length === 0) {
    for (const bucket of [visibleDistant, visibleNear]) {
      if (chosen.length >= wanted) break;
      chosen.push(...shuffled(bucket, random).slice(0, wanted - chosen.length));
    }
  }
  return chosen;
}

export type ReinforcementFloorOptions = ReinforcementSelection & {
  floor?: number;
  count?: number;
};

// Returns the number of monsters spawned. The caller's spawn callback is
// responsible for constructing and registering each actor. Existing living
// monsters (including decoys) mean no wave is due.
export function reinforceFloor(
  context: Pick<GameContext, "entities" | "player" | "visibleTiles">,
  candidates: ReinforcementTile[],
  spawn: (kind: ReinforcementKind, x: number, y: number) => void,
  options: ReinforcementFloorOptions = {}
): number {
  if (!floorIsEmptyOfMonsters(context.entities)) return 0;

  const floor = options.floor ?? 1;
  if (!floorAllowsReinforcements(floor)) return 0;
  const random = options.random ?? Math.random;
  const count = options.count ?? reinforcementCount(floor, random);
  const occupied = new Set<string>();
  for (const entity of context.entities) {
    if (entity.x !== undefined && entity.y !== undefined && entity.healthPoints > 0) {
      occupied.add(`${entity.x},${entity.y}`);
    }
  }

  const tiles = selectReinforcementTiles(candidates, context.player ?? {}, count, {
    blocked: (x, y) => occupied.has(`${x},${y}`) || !!options.blocked?.(x, y),
    hidden: (x, y) => !context.visibleTiles.has(`${x},${y}`),
    minDistance: options.minDistance,
    random
  });

  for (const tile of tiles) {
    spawn(pickReinforcementKind(floor, random), tile.x, tile.y);
  }
  return tiles.length;
}
