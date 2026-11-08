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
import { TILE_FOOTPRINT, footprintTiles } from "./footprint.ts";
import type { Footprint } from "./footprint.ts";
import { reserveFootprint } from "./placement.ts";

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
  // Physical rectangle every selected spawn occupies. Every cell must be
  // present in the candidate list, unblocked and unseen; waves never overlap.
  footprint?: Footprint;
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
  const footprint = options.footprint ?? TILE_FOOTPRINT;

  // A footprint can only stand where every cell is a candidate.
  const available = new Set(candidates.map(tile => `${tile.x},${tile.y}`));
  const cellsFor = (tile: ReinforcementTile): Array<[number, number]> =>
    [...footprintTiles(footprint, tile.x, tile.y)];

  const hiddenDistant: ReinforcementTile[] = [];
  const hiddenNear: ReinforcementTile[] = [];
  const visibleDistant: ReinforcementTile[] = [];
  const visibleNear: ReinforcementTile[] = [];
  const seen = new Set<string>();
  for (const tile of candidates) {
    const key = `${tile.x},${tile.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cells = cellsFor(tile);
    if (!cells.every(([x, y]) => available.has(`${x},${y}`))) continue;
    if (cells.some(([x, y]) => blocked(x, y))) continue;
    // Hide the whole body: a wave must not appear partially inside the view.
    const unseen = cells.every(([x, y]) => hidden(x, y));
    const distance = player.x === undefined || player.y === undefined
      ? Number.POSITIVE_INFINITY
      : Math.min(...cells.map(([x, y]) => Math.hypot(x - player.x!, y - player.y!)));
    const distant = distance >= minDistance;
    if (unseen) (distant ? hiddenDistant : hiddenNear).push(tile);
    else (distant ? visibleDistant : visibleNear).push(tile);
  }

  const chosen: ReinforcementTile[] = [];
  const chosenCells = new Set<string>();
  const fitsWave = (tile: ReinforcementTile): boolean =>
    cellsFor(tile).every(([x, y]) => !chosenCells.has(`${x},${y}`));
  const take = (bucket: ReinforcementTile[]): void => {
    for (const tile of shuffled(bucket, random)) {
      if (chosen.length >= wanted) return;
      if (!fitsWave(tile)) continue;
      chosen.push(tile);
      for (const [x, y] of cellsFor(tile)) chosenCells.add(`${x},${y}`);
    }
  };
  for (const bucket of [hiddenDistant, hiddenNear]) take(bucket);
  // Never spill into view while unseen tiles remain. Only a map with no unseen
  // walkable tile at all may use the visible fallback.
  if (chosen.length === 0) {
    for (const bucket of [visibleDistant, visibleNear]) take(bucket);
  }
  return chosen;
}

export type ReinforcementFloorOptions = ReinforcementSelection & {
  floor?: number;
  count?: number;
  // Per-kind footprint for mixed-size waves. When present, kinds are chosen
  // first and one rectangle is reserved per spawn so bodies never overlap.
  footprintsFor?: (kind: ReinforcementKind) => Footprint;
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
      reserveFootprint(occupied, entity.footprint ?? TILE_FOOTPRINT, entity.x, entity.y);
    }
  }

  const blocked = (x: number, y: number): boolean =>
    occupied.has(`${x},${y}`) || !!options.blocked?.(x, y);

  if (options.footprintsFor) {
    // Mixed-size wave: choose the roster first, then find a rectangle for each
    // kind and reserve it before selecting the next one.
    let spawned = 0;
    const reserved = new Set(occupied);
    for (let n = 0; n < count; n++) {
      const kind = pickReinforcementKind(floor, random);
      const footprint = options.footprintsFor(kind) ?? TILE_FOOTPRINT;
      const [tile] = selectReinforcementTiles(candidates, context.player ?? {}, 1, {
        blocked: (x, y) => reserved.has(`${x},${y}`) || !!options.blocked?.(x, y),
        hidden: (x, y) => options.hidden
          ? options.hidden(x, y) : !context.visibleTiles.has(`${x},${y}`),
        minDistance: options.minDistance,
        random,
        footprint
      });
      if (!tile) break;
      reserveFootprint(reserved, footprint, tile.x, tile.y);
      spawn(kind, tile.x, tile.y);
      spawned += 1;
    }
    return spawned;
  }

  const tiles = selectReinforcementTiles(candidates, context.player ?? {}, count, {
    blocked,
    hidden: (x, y) => options.hidden
      ? options.hidden(x, y) : !context.visibleTiles.has(`${x},${y}`),
    minDistance: options.minDistance,
    random,
    footprint: options.footprint
  });

  for (const tile of tiles) {
    spawn(pickReinforcementKind(floor, random), tile.x, tile.y);
  }
  return tiles.length;
}
