import type { GameContext } from "./context";
import PF from "pathfinding";
import { dungeonTheme } from "./dungeonTheme";
import { bresenhamLine } from "./fov";
import type { Entity } from "./entity";
import { removeEntity } from "./entity";
import MirrorImage from "./monsters/mirrorImage";
import { CURSE_PROC_CHANCE } from "./curseData";
import { sfx } from "./audio";
import { resolveAttack } from "./combat";
import { announceHit, isEnemyVisible } from './combatFeedback';
import { applyAttackResult } from './combatApplication';
import { spawnEntityFloatingText } from "./floatingText";
import { describeTile, describeTileLabel } from './tiles';
import { terrainFor } from './terrain';
import {
  applyEffect,
  createBurningEffect,
  createChilledEffect,
  createFrozenEffect,
  createStunnedEffect,
  createCrippledEffect,
  createConfusedEffect,
  createPoisonedEffect,
  hasEffect,
  removeEffect
} from "./effects";
import type { DamageType, StatusEffect } from "./effects";
import { actorBodyAtTile, actorFootprint, bodyOverlapsAt } from "./actorBodies.ts";
import { footprintBounds, footprintContains, footprintTiles, footprintsOverlap } from "./footprint.ts";

// Tile index of the floor in every theme sheet. The wall index comes from
// dungeonTheme(), so the sheet layout is described in exactly one place.
export const Sprites = {
  floor: 0
};

const tileSize = 16;

// Boss floors are sealed until their guardian dies. This deliberately mirrors
// context.bossSealsFloor without a runtime import, so isolated dungeon suites
// can keep their minimal bindings.
function bossSealsFloor(context: GameContext): boolean {
  return context.floor > 0 && context.floor % 5 === 0 &&
    !(context.bossesSlain?.has(context.floor) ?? false);
}

// Short hops stay snappy, long shots stay readable. The simulation waits out
// this flight, so it is capped well below a single action's worth of time.
function arrowFlightDuration(fromX: number, fromY: number, toX: number, toY: number): number {
  return Math.min(240, 90 + Math.hypot(toX - fromX, toY - fromY) * 22);
}

const dungeon = {
  currentLevel: [] as number[][],
  layer: null as Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer | null,
  pathGrid: null as PF.Grid | null,
  diagonalFinder: null as PF.AStarFinder | null,
  context: null as GameContext | null,
  onTerrainChanged: null as (() => void) | null,

  initialize: function (context: GameContext, levelArray: number[][]) {
    const tiles = terrainFor(context);
    this.currentLevel = levelArray;
    context.currentLevel = levelArray;
    this.context = context;
    this.pathGrid = new PF.Grid(levelArray);
    // A checkpoint written against a larger map (floor 1 shrank to 50x40) can
    // carry terrain outside the grid. Drop it before building the grid so the
    // floor still loads, and report it so the bad save is not silent.
    const dropped = tiles.pruneToBounds(levelArray[0]?.length ?? 0, levelArray.length);
    if (dropped.length) {
      console.warn(`Rogue0: dropped ${dropped.length} terrain feature(s) outside the ` +
        `${levelArray[0]?.length ?? 0}x${levelArray.length} map on floor ${context.floor}`,
        dropped.slice(0, 5));
    }
    tiles.applyToPathGrid(this.pathGrid);
    this.diagonalFinder = new PF.AStarFinder({
      diagonalMovement: PF.DiagonalMovement.Always
    });

    const theme = dungeonTheme(context.floor);
    const level0 = levelArray.map((r) =>
      r.map((t) => (t == 1 ? theme.wallFrame : Sprites.floor))
    );

    const config = {
      data: level0,
      tileWidth: tileSize,
      tileHeight: tileSize
    };

    if (this.layer) {
      this.layer.destroy();
      this.layer = null;
    }

    if (context.map) {
      context.map.destroy();
      context.map = undefined;
    }

    context.map = context.scene!.make.tilemap(config);

    const tileset = context.map.addTilesetImage(
      "tiles",
      theme.tiles,
      tileSize,
      tileSize,
      0,
      1
    );

    if (!tileset) {
      console.error("Failed to load tileset named tiles");
      return;
    }

    this.layer = context.map.createLayer(0, tileset, 0, 0);
  },

  getCurrentLevel: function (): number[][] {
    return this.currentLevel;
  },

  getPathGrid: function (): PF.Grid {
    return this.pathGrid!;
  },

  // Unrestricted eight-way adjacency: side tiles never block a diagonal.
  // Callers separately check the destination (walls, doors, chasms, actors).
  canStepBetween: function (sx: number, sy: number, tx: number, ty: number, _actor?: Entity): boolean {
    const dx = Math.abs(tx - sx);
    const dy = Math.abs(ty - sy);
    return Math.max(dx, dy) === 1;
  },

  // One physical-occupancy predicate for every actor size. Every cell of the
  // footprint must be in bounds and walkable terrain; living bodies may not
  // overlap. `swept` additionally checks the rectangle the actor leaves behind,
  // which stops a multi-tile body squeezing diagonally through a wall corner.
  canFootprintOccupy: function (
    context: GameContext, actor: Entity | undefined, x: number, y: number,
    options: {
      ignoreActors?: boolean;
      throughClosedDoors?: boolean;
      allowChasm?: boolean;
      swept?: boolean;
    } = {}
  ): boolean {
    const tiles = terrainFor(context);
    const level = this.currentLevel;
    if (!level?.length) return false;
    const fp = actorFootprint(actor);
    const flying = !!actor?.isFlying;

    const terrainFree = (tx: number, ty: number): boolean => {
      if (tx < 0 || ty < 0 || ty >= level.length || tx >= level[0].length) return false;
      if (level[ty][tx] !== 0) return false;
      const state = tiles.getTileState(tx, ty);
      if (tiles.isBlocking(tx, ty)) {
        const throughDoor = options.throughClosedDoors && state?.feature === 'door' &&
          state.door === 'closed';
        const overChasm = (flying || options.allowChasm) && state?.feature === 'chasm';
        if (!throughDoor && !overChasm) return false;
      }
      // `currentLevel` is authoritative: it is rebuilt from the same array as
      // the tilemap and is what every headless simulation uses. Do not consult
      // the rendered layer here; scene tiles can lag during floor transitions.
      return true;
    };

    const rects: Array<{ x: number; y: number }> = [{ x, y }];
    if (options.swept && actor?.x !== undefined && actor.y !== undefined) {
      rects.push({ x: actor.x, y: actor.y });
    }
    // Sweep the bounding union of every rectangle, not just the old and new
    // cells: a diagonal move must not pass through a corner the body would
    // clip on the way. Cardinal moves produce the same union as before.
    const bounds = rects.map(rect => footprintBounds(fp, rect.x, rect.y));
    const x0 = Math.min(...bounds.map(b => b.x0));
    const y0 = Math.min(...bounds.map(b => b.y0));
    const x1 = Math.max(...bounds.map(b => b.x1));
    const y1 = Math.max(...bounds.map(b => b.y1));
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!terrainFree(tx, ty)) return false;
      }
    }

    if (!options.ignoreActors) {
      for (const other of context.entities ?? []) {
        if (other === actor || other.type === 'item' || (other.healthPoints ?? 0) <= 0 ||
            other.x === undefined || other.y === undefined) continue;
        if (footprintsOverlap(fp, x, y, actorFootprint(other), other.x, other.y)) return false;
      }
    }
    return true;
  },

  // A legal one-tile step for any actor size, including the swept-corner rule.
  canMoveActor: function (
    context: GameContext, actor: Entity, x: number, y: number
  ): boolean {
    if (actor.x === undefined || actor.y === undefined ||
        !this.canStepBetween(actor.x, actor.y, x, y, actor) ||
        !this.isWalkableTile(context, x, y, actor)) return false;
    const fp = actorFootprint(actor);
    if (fp.width === 1 && fp.height === 1) return true;
    return this.canFootprintOccupy(context, actor, x, y, { swept: true });
  },

  // Pathfinding mutates node state (opened/closed), so always search on a
  // fresh grid clone to avoid stale state between calls.
  // `throughDoors` lets players and pursuing enemies plan routes through
  // closed doors; movement must open the door before entering.
  findPath: function (sx: number, sy: number, tx: number, ty: number, throughDoors = false, avoidTraps = false, actor?: Entity): number[][] {
    const tiles = terrainFor(this.context!);
    const grid = this.pathGrid!.clone();
    const flying = !!actor && actor.isFlying;
    if (flying) {
      tiles.forEachFeature((x, y, s) => {
        if (s.feature === "chasm" && this.currentLevel[y]?.[x] === 0) grid.setWalkableAt(x, y, true);
      });
    }
    if (throughDoors) {
      tiles.forEachFeature((x, y, s) => {
        if (s.feature === "door" && s.door === "closed") {
          grid.setWalkableAt(x, y, true);
        }
      });
    }
    // Only the explicitly selected destination may be a revealed trap.
    // Apply this on every search so newly revealed traps also stop auto-walk.
    if (avoidTraps && !flying) {
      tiles.forEachFeature((x, y, s) => {
        if (s.feature === "trap" && s.trap === "visible" && (x !== tx || y !== ty)) {
          grid.setWalkableAt(x, y, false);
        }
      });
    }
    if (!grid.isInside(sx, sy) || !grid.isInside(tx, ty)) return [];
    const fp = actorFootprint(actor);
    const multi = fp.width > 1 || fp.height > 1;
    let base: boolean[][] | undefined;
    if (multi) {
      const startWalkable = grid.isWalkableAt(sx, sy);
      // Snapshot walkability after door/trap/flying adjustments. Clearance must
      // be measured against terrain only: mutating the grid to encode "can this
      // anchor hold the body" would make neighbouring anchors inherit false
      // negatives from cells of the body that are not anchors themselves.
      base = [];
      for (let y = 0; y < grid.height; y++) {
        base[y] = [];
        for (let x = 0; x < grid.width; x++) base[y][x] = grid.isWalkableAt(x, y);
      }
      const fits = (x: number, y: number): boolean => {
        for (const [cx, cy] of footprintTiles(fp, x, y)) {
          if (!grid.isInside(cx, cy) || !base![cy][cx]) return false;
        }
        return true;
      };
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          if (grid.isWalkableAt(x, y) && !fits(x, y)) grid.setWalkableAt(x, y, false);
        }
      }
      // Keep the start node usable even when the body is anchored imperfectly
      // (a restored actor or a doorway); its neighbours still need clearance.
      if (startWalkable) grid.setWalkableAt(sx, sy, true);
    }
    // Only destination walkability matters, including trap avoidance. Always
    // enumerate all eight neighbors, matching manual movement and monster AI.
    const getNeighbors = grid.getNeighbors.bind(grid);
    const terrainFreeCell = (x: number, y: number): boolean => {
      if (!grid.isInside(x, y)) return false;
      return multi ? !!base![y]?.[x] : grid.isWalkableAt(x, y);
    };
    const sweptFits = (sx2: number, sy2: number, tx2: number, ty2: number): boolean => {
      const a = footprintBounds(fp, sx2, sy2);
      const b = footprintBounds(fp, tx2, ty2);
      for (let y = Math.min(a.y0, b.y0); y <= Math.max(a.y1, b.y1); y++) {
        for (let x = Math.min(a.x0, b.x0); x <= Math.max(a.x1, b.x1); x++) {
          if (!terrainFreeCell(x, y)) return false;
        }
      }
      return true;
    };
    grid.getNeighbors = (node) => getNeighbors(node, PF.DiagonalMovement.Always)
      .filter(next => this.canStepBetween(node.x, node.y, next.x, next.y, actor) &&
        (!multi || (node.x === sx && node.y === sy) ||
          sweptFits(node.x, node.y, next.x, next.y)));
    return this.diagonalFinder!.findPath(sx, sy, tx, ty, grid);
  },

  isWalkableTile: function (context: GameContext, x: number, y: number, actor?: Entity): boolean {
    const mover = actor ?? context.player;
    const fp = actorFootprint(mover);
    // Terrain, bounds and living-body overlap for every cell of the footprint.
    if (!this.canFootprintOccupy(context, mover, x, y)) return false;

    // Items and corpses occupy exactly their own cell, even inside a larger
    // destination rectangle. A big creature routes around them instead of
    // standing on top of loot.
    for (const entity of context.entities) {
      if (!entity.sprite || entity === mover ||
          entity.x === undefined || entity.y === undefined) continue;
      const fixed = entity.type === 'item' || (entity.healthPoints ?? 0) <= 0;
      if (fixed && footprintContains(fp, x, y, entity.x, entity.y)) return false;
    }
    return true;
  },

  openDoor: function (x: number, y: number): boolean {
    const tiles = terrainFor(this.context!);
    if (tiles.getFeature(x, y) !== "door") return false;
    if (tiles.getDoorState(x, y) !== "closed") return false;

    tiles.setDoorState(x, y, "open");
    this.pathGrid?.setWalkableAt(x, y, true);
    this.onTerrainChanged?.();

    if (this.context) {
      // Opening an ordinary door is visible on the map.
    }
    return true;
  },

  // A wide body may cover more than one closed door. Open every door under the
  // destination rectangle, but only after the caller has confirmed the whole
  // rectangle is passable (canFootprintOccupy throughClosedDoors).
  openDoorsUnderFootprint: function (
    context: GameContext, actor: Entity, x: number, y: number
  ): boolean {
    const tiles = terrainFor(context);
    const fp = actorFootprint(actor);
    let opened = false;
    for (const [tx, ty] of footprintTiles(fp, x, y)) {
      if (tiles.getDoorState(tx, ty) === 'closed' && this.openDoor(tx, ty)) opened = true;
    }
    return opened;
  },

  // Describes a tile for the Inspect command. Purely informational — it does
  // not reveal hidden traps (those stay invisible until stepped on).
  // `label` is a short name for the shared-tile choice list; it is undefined
  // when the terrain is ordinary, so item-only tiles need no extra step.
  inspectTileInfo: function (x: number, y: number): { label?: string; description: string } {
    const tiles = terrainFor(this.context!);
    const state = tiles.getTileState(x, y);
    const map = this.currentLevel;
    const isWall = !!map && map[y]?.[x] === 1;
    const gas = this.context?.poisonClouds?.some(c => c.x === x && c.y === y &&
      c.expiresAt > (this.context?.simulationTime ?? 0) + 1e-9);
    const description = describeTile(state, isWall) +
      (gas ? " Poison gas: poisons on entry and while you remain here, even when levitating." : "");
    const featureLabel = describeTileLabel(state, isWall);
    const label = featureLabel
      ? (gas ? `${featureLabel} (poison gas)` : featureLabel)
      : (gas ? "Poison gas" : undefined);
    return { label, description };
  },

  inspectTile: function (x: number, y: number): string {
    return this.inspectTileInfo(x, y).description;
  },

  // Reveal hidden traps and secret end walls in the surrounding 3x3 area.
  // Returns the total discoveries; terrain callbacks refresh FOV and visuals.
  searchAround: function (x: number, y: number): number {
    const tiles = terrainFor(this.context!);
    const map = this.currentLevel;
    if (!map) return 0;

    let found = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map[0].length || ny >= map.length) continue;
        const state = tiles.getTileState(nx, ny);
        if (state?.feature === "trap" && state.trap === "hidden") {
          tiles.setTrapState(nx, ny, "visible");
          found++;
        } else if (state?.feature === "secretDoor") {
          map[ny][nx] = 0;
          tiles.setFeature(nx, ny, "door", { door: "closed" });
          this.layer?.putTileAt(Sprites.floor, nx, ny);
          this.pathGrid?.setWalkableAt(nx, ny, false);
          if (this.context) this.log(this.context, "You discover a secret door in the end wall!");
          found++;
        }
      }
    }

    if (found > 0) this.onTerrainChanged?.();
    return found;
  },

  // A pressure plate fires once, choosing the nearest living actor of either
  // faction. Walls/closed doors stop the arrow, not the targeting mechanism.
  // The hit lands when the arrow's head reaches its target, never on the
  // firing frame: applying it early let a wounded monster take the damage and
  // walk away while the arrow was still crossing the room, which reads as a
  // miss. While an arrow flies the scheduler waits for it, like a thrown item.
  triggerArrowTrap: function (context: GameContext, x: number, y: number): boolean {
    const tiles = terrainFor(context);
    const state = tiles.getTileState(x, y);
    if (state?.feature !== "trap" || state.trapKind !== "arrow" || state.trap === "triggered") return false;
    if (!tiles.activateTrap(x, y)) return false;
    this.onTerrainChanged?.();
    const actors = context.entities.filter(e =>
      (e.type === "player" || e.type === "enemy") && e.healthPoints > 0 &&
      e.x !== undefined && e.y !== undefined
    );
    actors.sort((a, b) => Math.hypot(a.x! - x, a.y! - y) - Math.hypot(b.x! - x, b.y! - y));
    const target = actors[0];
    this.log(context, "The arrow trap fires!");
    if (!target) return true;
    let endX = x, endY = y;
    let victim: Entity | undefined;
    // Chasms/water/grass affect movement or sight, not physical arrows.
    const blocksArrow = (px: number, py: number) =>
      this.currentLevel[py]?.[px] !== 0 || tiles.getDoorState(px, py) === "closed";
    for (const [px, py] of bresenhamLine(x, y, target.x!, target.y!)) {
      if (blocksArrow(px, py)) break;
      if (px !== endX && py !== endY &&
          (blocksArrow(px, endY) || blocksArrow(endX, py))) break;
      endX = px; endY = py;
      victim = actors.find(e => e.x === px && e.y === py);
      if (victim) break;
    }
    // The victim is only seen walking away from an arrow the player can watch
    // reach it, so the hit waits for a visible impact. A shot into the dark
    // resolves at once: there is no flight to sync with.
    const deferred = !!context.scene && !!context.map &&
      context.visibleTiles.has(`${x},${y}`) && context.visibleTiles.has(`${endX},${endY}`);
    let landed = false;
    const land = () => {
      // Tweens and their callers must never apply one arrow's hit twice.
      if (landed) return;
      landed = true;
      if (deferred) context.pendingTrapArrows = Math.max(0, (context.pendingTrapArrows ?? 1) - 1);
      if (victim && victim.healthPoints > 0) {
        const damage = Math.max(1, 5 - victim.protection());
        victim.takeDamage(damage);
        announceHit(context, victim, `The arrow hits ${victim.type === "player" ? "you" : victim.name} for ${damage} damage.`, true);
        if (isEnemyVisible(context, victim)) this.applyHitEffects(context, victim);
        if (victim.healthPoints <= 0) removeEntity(context, victim);
      }
    };
    if (context.scene && context.map && context.visibleTiles.has(`${x},${y}`)) {
      const scene = context.scene, map = context.map;
      const arrow = scene.add.sprite(
        map.tileToWorldX(x)! + 8, map.tileToWorldY(y)! + 8, "bow-arrow"
      ).setOrigin(0.5).setDepth(250).setRotation(Math.atan2(endY - y, endX - x));
      if (deferred) context.pendingTrapArrows = (context.pendingTrapArrows ?? 0) + 1;
      scene.tweens.add({ targets: arrow,
        x: map.tileToWorldX(endX)! + 8, y: map.tileToWorldY(endY)! + 8,
        ease: "Linear", duration: arrowFlightDuration(x, y, endX, endY),
        onComplete: () => { arrow.destroy(); land(); } });
      return true;
    }
    land();
    return true;
  },

  // Resolve the actor occupying a cell. Items stay one-cell objects; every
  // other living actor is found anywhere inside its footprint, so a tap or a
  // bolt on any body cell reaches the creature rather than the floor beneath.
  entityAtTile: function (context: GameContext, x: number, y: number): Entity | undefined {
    let item: Entity | undefined;
    let corpse: Entity | undefined;
    for (const entity of context.entities) {
      if (!entity.sprite || entity.x === undefined || entity.y === undefined) continue;
      if (entity.type === "item") {
        if (!item && entity.x === x && entity.y === y) item = entity;
        continue;
      }
      if (!footprintContains(actorFootprint(entity), entity.x, entity.y, x, y)) continue;
      // A living creature always beats loot resting on the same cell.
      if ((entity.healthPoints ?? 0) > 0) return entity;
      if (!corpse) corpse = entity;
    }
    return item ?? corpse;
  },

  itemPicked: function (entity: Entity): void {
    sfx.pickup();
    if (entity.sprite) {
      entity.context.scene?.tweens.killTweensOf(entity.sprite);
      entity.sprite.destroy();
    }
    entity.sprite = undefined;
    entity.x = undefined;
    entity.y = undefined;
  },

  distanceBetweenEntities: function (entity1: Entity, entity2: Entity): number {
    if (
      entity1.x == undefined ||
      entity1.y == undefined ||
      entity2.x == undefined ||
      entity2.y == undefined
    ) {
      throw new Error(
        `Error in distanceBetweenEntities: entity ${entity1.name} or ${entity2.name} x or y is undefined`
      );
    }
    const finder = this.diagonalFinder!;
    const path = finder.findPath(
      entity1.x,
      entity1.y,
      entity2.x,
      entity2.y,
      this.pathGrid!.clone()
    );
    return path.length >= 2 ? path.length : 0;
  },

  // Returns true when a movement attempt was consumed, even if the random
  // step hits a blocker. Never retries until a safe direction is found.
  confusedMove: function (context: GameContext, actor: Entity): boolean {
    const tiles = terrainFor(context);
    if (!hasEffect(actor, "confused") || hasEffect(actor, "rooted") || actor.moving ||
        actor.healthPoints <= 0 || actor.x === undefined || actor.y === undefined) return false;
    if (actor === context.player) {
      context.player.walkPath = [];
      context.player.inputBuffer = [];
    }
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
    const x = actor.x + dx;
    const y = actor.y + dy;
    actor.spendTime("move");
    const fp = actorFootprint(actor);
    const chasm = [...footprintTiles(fp, x, y)].some(([tx, ty]) => tiles.getFeature(tx, ty) === "chasm");
    if (!this.canFootprintOccupy(context, actor, x, y, { swept: true, allowChasm: true })) {
      this.log(context, `${actor.type === "player" ? "You stumble" : `${actor.name} stumbles`} in confusion but cannot move.`);
      return true;
    }
    this.log(context, `${actor.type === "player" ? "You stumble" : `${actor.name} stumbles`} in confusion!`);
    const falling = chasm && !actor.isFlying;
    this.moveEntityTo(context, actor, x, y, falling);
    if (falling) this.fallIntoChasm(context, actor);
    return true;
  },

  // Environmental impact damage bypasses attack rolls/armor and uses normal
  // death handling, so wall kills award loot/XP and hero deaths end the run.
  wallImpact: function (context: GameContext, target: Entity): void {
    target.hearNoise(target.x!, target.y!);
    target.takeDamage(3);
    if (isEnemyVisible(context, target)) {
      this.log(context, `${target.type === "player" ? "You slam" : `${target.name} slams`} into a wall for 3 damage!`);
    }
    if (target.healthPoints <= 0) removeEntity(context, target);
  },

  // Effect-level forced movement, NOT a player ability. A trap or other effect
  // supplies a cardinal unit vector; it owns its action cost. The victim gets
  // no free action and loses no scheduled action. Shared path grids stay intact.
  knockback: function (context: GameContext, target: Entity, dx: number, dy: number): boolean {
    const tiles = terrainFor(context);
    if (target.healthPoints <= 0 || (target.type !== "enemy" && target.type !== "player") ||
        !context.entities.includes(target) || target.x === undefined || target.y === undefined ||
        target.moving || hasEffect(target, "rooted")) return false;
    if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) + Math.abs(dy) !== 1) return false;
    const x = target.x + dx;
    const y = target.y + dy;
    const options = { swept: true, allowChasm: true };
    if (!this.canFootprintOccupy(context, target, x, y, options)) {
      if (!this.canFootprintOccupy(context, target, x, y, { ...options, ignoreActors: true })) {
        this.wallImpact(context, target);
      }
      return false;
    }
    const fp = actorFootprint(target);
    const chasm = [...footprintTiles(fp, x, y)].some(([tx, ty]) => tiles.getFeature(tx, ty) === "chasm");
    // Wake monsters without granting magical knowledge of the player's position.
    target.hearNoise(target.x, target.y);
    this.log(context, `${target.type === "player" ? "You are" : `${target.name} is`} knocked back!`);
    if (chasm && !target.isFlying) {
      this.moveEntityTo(context, target, x, y, true);
      this.log(context, `${target.type === "player" ? "You fall" : `${target.name} falls`} into the chasm!`);
      this.fallIntoChasm(context, target);
    } else {
      this.moveEntityTo(context, target, x, y);
    }
    return true;
  },

  // Resolve each tile synchronously so walls, bodies, traps and the first
  // chasm stop the blast; never leap over hazards to the final destination.
  blastPush: function (context: GameContext, target: Entity, dx: number, dy: number, distance: number): void {
    if (target.healthPoints <= 0 || target.moving || hasEffect(target, "rooted") ||
        !context.entities.includes(target) || target.x === undefined || target.y === undefined ||
        !Number.isInteger(dx) || !Number.isInteger(dy) || Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return;
    target.hearNoise(target.x, target.y);
    if (target === context.player) {
      context.player.walkPath = [];
      context.player.inputBuffer = [];
    }
    const tiles = terrainFor(context);
    for (let step = 0; step < distance; step++) {
      const x: number = target.x! + dx;
      const y: number = target.y! + dy;
      const options = { swept: true, allowChasm: true };
      if (!this.canFootprintOccupy(context, target, x, y, options)) {
        // Bodies and roots stop the push without impact damage or stun.
        // Closed doors and the map boundary count as solid walls.
        if (!this.canFootprintOccupy(context, target, x, y, { ...options, ignoreActors: true })) {
          applyEffect(target, createStunnedEffect(3));
          this.wallImpact(context, target);
        }
        return;
      }
      this.moveEntityTo(context, target, x, y, true, true);
      if (target.healthPoints <= 0 || !context.entities.includes(target)) return;
      const falling = !target.isFlying && [...footprintTiles(actorFootprint(target), target.x!, target.y!)]
        .some(([tx, ty]) => tiles.getFeature(tx, ty) === "chasm");
      if (falling) {
        if (isEnemyVisible(context, target)) this.log(context, `${target.type === "player" ? "You fall" : `${target.name} falls`} into the chasm!`);
        this.fallIntoChasm(context, target);
        return;
      }
      // A teleport/geyser owns the rest of its displacement, not this ray.
      if (target.x !== x || target.y !== y || target.moving || context.pendingFall) return;
    }
  },

  canEnterChasm: function (context: GameContext, actor: Entity, x: number, y: number): boolean {
    const tiles = terrainFor(context);
    const fp = actorFootprint(actor);
    const multi = fp.width > 1 || fp.height > 1;
    if (actor.type !== "player" || actor.healthPoints <= 0 || actor.x === undefined || actor.y === undefined ||
        hasEffect(actor, "rooted") || actor.isFlying ||
        Math.max(Math.abs(actor.x - x), Math.abs(actor.y - y)) !== 1 ||
        bossSealsFloor(context) ||
        !this.canStepBetween(actor.x, actor.y, x, y, actor) ||
        tiles.getFeature(x, y) !== "chasm" ||
        !this.canFootprintOccupy(context, actor, x, y, { allowChasm: true, swept: multi })) return false;
    return true;
  },

  stepIntoChasm: function (context: GameContext, actor: Entity, x: number, y: number): boolean {
    if (!this.canEnterChasm(context, actor, x, y)) return false;
    this.moveEntityTo(context, actor, x, y, true);
    this.log(context, "You step into the chasm!");
    this.fallIntoChasm(context, actor);
    return true;
  },

  expireLevitation: function (context: GameContext, entity: Entity): void {
    this.fallIntoChasm(context, entity);
  },

  fallIntoChasm: function (context: GameContext, entity: Entity): void {
    const tiles = terrainFor(context);
    if (entity.x === undefined || entity.y === undefined || entity.healthPoints <= 0 ||
        ![...footprintTiles(actorFootprint(entity), entity.x, entity.y)]
          .some(([x, y]) => tiles.getFeature(x, y) === "chasm")) return;
    if (entity.type === "player") {
      if (bossSealsFloor(context)) {
        this.log(context, "The guardian's seal holds you above the abyss.");
        return;
      }
      context.pendingFall = true;
      entity.actionReady = false;
    } else if (entity.type === "enemy") {
      // Killed by the fall: loot drops into the chasm, not onto the void tile.
      entity.fellIntoChasm = true;
      entity.takeDamage(entity.healthPoints);
      removeEntity(context, entity);
    }
  },

  moveEntityTo: function (context: GameContext, entity: Entity, x: number, y: number, instant = false, allowChasm = false): void {
    const tiles = terrainFor(context);
    if (context.map == undefined || context.scene == undefined) {
      throw new Error("context.map is undefined");
    }

    // Enforce actor occupancy here too, not just in individual AI paths. A
    // wider body cannot be squeezed onto a cell next to another actor, and a
    // multi-tile body must fit every destination cell without cutting a
    // diagonal corner. Single-cell actors keep their legacy fast path.
    if (entity.type !== "item") {
      const fp = actorFootprint(entity);
      if ((fp.width > 1 || fp.height > 1) &&
          !this.canFootprintOccupy(context, entity, x, y, { swept: true, allowChasm })) return;
    }
    if (entity.type !== "item" && context.entities.some(other =>
      other !== entity && other.type !== "item" && other.healthPoints > 0 &&
      bodyOverlapsAt(entity, x, y, other)
    )) return;

    const oldX = entity.x;
    const oldY = entity.y;
    const entering = oldX !== x || oldY !== y;
    const closeDoorBehind = () => {
      if (oldX === undefined || oldY === undefined ||
          (oldX === entity.x && oldY === entity.y) ||
          tiles.getDoorState(oldX, oldY) !== "open") return;
      // Items dropped in a doorway prop it open.
      if (context.entities.some(e => e !== entity && e.sprite &&
          e.x === oldX && e.y === oldY)) return;
      tiles.setDoorState(oldX, oldY, "closed");
      this.pathGrid?.setWalkableAt(oldX, oldY, false);
      this.onTerrainChanged?.();
    };
    let destX = x;
    let destY = y;

    const flying = entity.isFlying;
    const entryTrap = tiles.getTileState(destX, destY);
    if (entering && !flying && entity.type !== "item" && entity.healthPoints > 0 &&
        oldX !== undefined && oldY !== undefined && entryTrap?.feature === "trap" &&
        entryTrap.trapKind === "geyser" && entryTrap.trap !== "triggered") {
      tiles.activateTrap(destX, destY);
      this.onTerrainChanged?.();
      // Reserve the pressure plate before applying forced movement. Resolve it
      // synchronously, never from a tween callback or a second actor action.
      entity.x = destX;
      entity.y = destY;
      context.onGasContact?.(entity);
      closeDoorBehind();
      entity.sprite?.setPosition(context.map.tileToWorldX(destX)!, context.map.tileToWorldY(destY)!);
      if (entity.healthPoints <= 0) return;
      if (entity.type === "player") sfx.step();
      if (entity === context.player) {
        context.player.walkPath = [];
        context.player.inputBuffer = [];
      }
      this.log(context, `A geyser erupts beneath ${entity.type === "player" ? "you" : entity.name}!`);
      // Diagonal entries choose the horizontal component, so every blast has
      // a predictable cardinal direction and never cuts a wall corner.
      const dx = Math.sign(destX - oldX);
      const dy = dx === 0 ? Math.sign(destY - oldY) : 0;
      if (!this.knockback(context, entity, dx, dy)) {
        this.log(context, `${entity.type === "player" ? "You" : entity.name} cannot be displaced by the geyser.`);
      }
      return;
    }
    // Flying actors do not contact water, ice, vegetation or pressure plates.
    if (entity.type !== "item" && !flying && entering && tiles.getFeature(destX, destY) === "ice") {
      if (hasEffect(entity, "burning")) {
        tiles.setFeature(destX, destY, "water");
        this.onTerrainChanged?.();
        this.log(context, "The ice melts back into water.");
      } else {
        applyEffect(entity, createCrippledEffect(2));
      }
    }
    if (!flying && tiles.getFeature(destX, destY) === "water" && hasEffect(entity, "burning")) {
      removeEffect(entity, "burning");
      this.log(context, `${entity.type === "player" ? "You step" : `${entity.name} steps`} into water and the flames go out.`);
    }

    // Confusion and frost plates affect either side; other ordinary traps
    // (darts, fire, teleport, summon, alarm) remain player-only.
    if ((entity.type === "player" || (entity.type === "enemy" &&
        (entryTrap?.trapKind === "confusion" || entryTrap?.trapKind === "frost"))) &&
        !flying && entering) {
      const state = tiles.getTileState(destX, destY);
      if (state && state.feature === "trap" && state.trapKind !== "arrow" && state.trap !== "triggered") {
        tiles.activateTrap(destX, destY);
        this.onTerrainChanged?.();

        const kind = state.trapKind ?? "dart";
        this.log(context, entity.type === "player" ? `You step on a ${kind} trap!` : `${entity.name} steps on a ${kind} trap!`);

        switch (kind) {
          case "confusion":
            applyEffect(entity, createConfusedEffect());
            if (entity === context.player) {
              context.player.walkPath = [];
              context.player.inputBuffer = [];
            }
            break;
          case "summon":
            this.log(context, context.onSummonTrap?.(destX, destY)
              ? "The trap summons a Skeleton!"
              : "The summoning trap fizzles: no room for a Skeleton.");
            break;
          case "alarm":
            for (const enemy of context.entities) {
              if (enemy.type === "enemy" && enemy.healthPoints > 0 &&
                  enemy.x !== undefined && enemy.y !== undefined &&
                  Math.max(Math.abs(enemy.x - destX), Math.abs(enemy.y - destY)) <= 8) {
                enemy.hearNoise(destX, destY);
              }
            }
            this.log(context, "An alarm rings out! Nearby enemies investigate the noise.");
            break;
          case "dart":
            applyEffect(entity, createPoisonedEffect());
            break;
          case "fire":
            applyEffect(entity, createBurningEffect());
            break;
          case "frost":
            applyEffect(entity, createFrozenEffect());
            // The skip alone is easy to shrug off in an empty room; the slow
            // makes the trap a real tempo cost wherever it sits.
            applyEffect(entity, createChilledEffect());
            break;
          case "teleport": {
            const tile = this.randomWalkableTile(context, destX, destY);
            if (tile) {
              destX = tile.x;
              destY = tile.y;
              this.log(context, "The trap teleports you to a new location!");
            }
            break;
          }
        }
      }
    }

    // Tall grass is trampled by walking through it. Entering the tile flattens
    // the blades into bare floor, so nobody can stand hidden in it after a
    // move; hide BEHIND a patch instead. Burning actors ignite it instead:
    // fire is the other way to clear grass.
    if (entering && !flying && entity.type !== "item" && entity.healthPoints > 0 &&
        !hasEffect(entity, "burning") && tiles.getFeature(destX, destY) === "grass") {
      tiles.clearFeature(destX, destY);
      this.onTerrainChanged?.();
      // Only the hero disturbs hidden stones; monster-driven trampling must not
      // create unannounced loot across the floor.
      if (entity.type === "player") {
        context.onGrassTrampled?.(entity, destX, destY);
      }
    }

    // Grass is flammable: a burning creature ignites grass on or next to it.
    if (!flying && hasEffect(entity, "burning")) {
      this.igniteGrass(context, entity, destX, destY);
    }

    if (entity.type === "player") {
      sfx.step();
    }
    // Unseen monsters should not make the player wait for invisible walk
    // animations. Keep animations when either endpoint is visible.
    if (instant || (entity.type === "enemy" &&
        !context.visibleTiles.has(`${entity.x},${entity.y}`) &&
        !context.visibleTiles.has(`${destX},${destY}`))) {
      entity.x = destX;
      entity.y = destY;
      if (entering) context.onGasContact?.(entity);
      if (!flying && entering) this.triggerArrowTrap(context, destX, destY);
      closeDoorBehind();
      entity.sprite?.setPosition(
        context.map.tileToWorldX(destX)!, context.map.tileToWorldY(destY)!
      );
      return;
    }
    // Reserve the destination before another actor can choose its move.
    // The sprite animates independently of the logical tile coordinates.
    entity.x = destX;
    entity.y = destY;
    if (entering) context.onGasContact?.(entity);
    if (entity.type !== "item" && !flying && entering) this.triggerArrowTrap(context, destX, destY);
    if (entity.healthPoints <= 0 && entity.type !== "item") {
      closeDoorBehind();
      return;
    }
    entity.moving = true;

    context.scene.tweens.add({
      targets: entity.sprite!,
      onComplete: () => {
        entity.moving = false;
        closeDoorBehind();
      },
      x: context.map.tileToWorldX(destX)!,
      y: context.map.tileToWorldY(destY)!,
      ease: "Linear",
      duration: 100
    });
  },

  // Returns a random walkable, unoccupied, feature-unblocked tile. Used by
  // the teleport trap. Keeps x < 67 so the player never lands under the UI.
  randomWalkableTile: function (
    context: GameContext,
    excludeX: number,
    excludeY: number
  ): { x: number; y: number } | null {
    const tiles = terrainFor(context);
    const level = this.currentLevel;
    if (!level) return null;

    const cells: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < level.length; y++) {
      for (let x = 0; x < level[0].length; x++) {
        if (x >= 67) continue;
        if (level[y][x] !== 0) continue;
        if (x === excludeX && y === excludeY) continue;
        if (tiles.isBlocking(x, y)) continue;

        const occupied = context.entities.some(
          (e) => e.sprite && e.x === x && e.y === y
        );
        if (occupied || actorBodyAtTile(context.entities, x, y)) continue;

        cells.push({ x, y });
      }
    }

    if (cells.length === 0) return null;
    return cells[Math.floor(Math.random() * cells.length)];
  },

  // One empty, walkable, feature-unblocked cardinal neighbour. Used to place
  // a mirror image without overlapping another actor or a hazard.
  adjacentEmptyTile: function (
    context: GameContext,
    x: number,
    y: number
  ): { x: number; y: number } | null {
    const tiles = terrainFor(context);
    const level = this.currentLevel;
    if (!level) return null;
    const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (level[ny]?.[nx] !== 0) continue;
      if (tiles.isBlocking(nx, ny)) continue;
      if (context.entities.some(e => e.sprite && e.x === nx && e.y === ny)) continue;
      if (actorBodyAtTile(context.entities, nx, ny)) continue;
      return { x: nx, y: ny };
    }
    return null;
  },

  // Armor curse proc: fires once per successful enemy hit against the hero.
  // Passive armor curses (Metabolism, Bulk) are handled by basicHero.
  procArmorCurse: function (context: GameContext, victim: Entity): void {
    const tiles = terrainFor(context);
    const armor = (victim as any).armor as Entity | undefined;
    if (!armor?.cursed || !armor.curseId) return;
    const id = armor.curseId;
    if (id === "metabolism" || id === "bulk") return;
    if (Math.random() >= CURSE_PROC_CHANCE) return;

    if (id === "displacement") {
      if (victim.x === undefined || victim.y === undefined) return;
      const tile = this.randomWalkableTile(context, victim.x, victim.y);
      if (!tile) return;
      victim.x = tile.x;
      victim.y = tile.y;
      if (context.map && victim.sprite) {
        victim.sprite.setPosition(
          context.map.tileToWorldX(tile.x)!,
          context.map.tileToWorldY(tile.y)!
        );
      }
      const player = context.player;
      if (victim === player) {
        player.walkPath = [];
        player.inputBuffer = [];
      }
      this.log(context, "Your cursed armor displaces you!");
    } else if (id === "multiplicity") {
      if (victim.x === undefined || victim.y === undefined) return;
      const spot = this.adjacentEmptyTile(context, victim.x, victim.y);
      if (!spot) return;
      context.entities.push(new MirrorImage(context, spot.x, spot.y, victim));
      this.log(context, "Your cursed armor conjures a mirror image!");
    } else if (id === "anti-entropy") {
      applyEffect(victim, createBurningEffect());
      if (victim.x !== undefined && victim.y !== undefined) {
        const vx = victim.x;
        const vy = victim.y;
        const targets = context.entities.filter(e =>
          e.type === "enemy" && !e.isDecoy && e.healthPoints > 0 &&
          e.x !== undefined && e.y !== undefined &&
          ((e.x === vx && Math.abs(e.y - vy) === 1) ||
           (e.y === vy && Math.abs(e.x - vx) === 1)));
        for (const enemy of targets) applyEffect(enemy, createFrozenEffect());
        this.log(context, targets.length
          ? "Your cursed armor sears you and freezes nearby enemies!"
          : "Your cursed armor sears you!");
      }
    } else if (id === "corrosion") {
      applyEffect(victim, createPoisonedEffect());
      this.log(context, "Your cursed armor splashes you with caustic ooze!");
    } else if (id === "stench") {
      if (victim.x !== undefined && victim.y !== undefined) {
        const count = context.onCreatePoisonGas?.(victim.x, victim.y) ?? 0;
        if (count) this.log(context, "Your cursed armor releases a cloud of toxic gas!");
      }
    } else if (id === "overgrowth") {
      if (victim.x !== undefined && victim.y !== undefined) {
        let grown = 0;
        for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = victim.x + dx;
          const ny = victim.y + dy;
          if (this.currentLevel[ny]?.[nx] === 0 &&
              tiles.getFeature(nx, ny) === undefined && !tiles.isBlocking(nx, ny)) {
            tiles.setFeature(nx, ny, "grass");
            grown++;
          }
        }
        if (grown) {
          this.onTerrainChanged?.();
          this.log(context, "Your cursed armor makes grass sprout around you!");
        }
      }
    }
  },

  // Weapon curse proc: fires once per successful player hit. Passive weapon
  // curses (Wayward, Polarized) are handled by basicHero / tieredEquipment.
  procWeaponCurse: function (context: GameContext, attacker: Entity, victim: Entity, damageDealt: number): void {
    const weapon = (attacker as any).weapon as Entity | undefined;
    if (!weapon?.cursed || !weapon.curseId) return;
    const id = weapon.curseId;
    if (id === "wayward" || id === "polarized") return;

    if (id === "sacrificial") {
      if (damageDealt <= 0) return;
      const cost = Math.max(1, Math.ceil(damageDealt * 0.25));
      attacker.takeDamage(cost);
      spawnEntityFloatingText(attacker, `-${cost}`);
      this.log(context, "Your cursed weapon drains your life force!");
      if (attacker.healthPoints <= 0) removeEntity(context, attacker);
      return;
    }
    if (Math.random() >= CURSE_PROC_CHANCE) return;

    if (id === "displacing") {
      if (victim.x === undefined || victim.y === undefined) return;
      const tile = this.randomWalkableTile(context, victim.x, victim.y);
      if (!tile) return;
      victim.x = tile.x;
      victim.y = tile.y;
      victim.sprite?.setPosition(
        context.map ? context.map.tileToWorldX(tile.x)! : tile.x * 16,
        context.map ? context.map.tileToWorldY(tile.y)! : tile.y * 16
      );
      this.log(context, "Your cursed weapon flings the enemy away!");
    } else if (id === "annoying") {
      if (attacker.x === undefined || attacker.y === undefined) return;
      let woke = 0;
      for (const e of context.entities) {
        if (e.type === "enemy" && !e.isDecoy && e.healthPoints > 0 &&
            e.x !== undefined && e.y !== undefined &&
            Math.max(Math.abs(e.x - attacker.x), Math.abs(e.y - attacker.y)) <= 8) {
          e.hearNoise(attacker.x, attacker.y);
          woke++;
        }
      }
      if (woke) this.log(context, "Your cursed weapon draws enemies to you!");
    } else if (id === "exhausting") {
      applyEffect(attacker, createCrippledEffect());
      this.log(context, "Your cursed weapon exhausts you!");
    }
  },

  // Wand curse proc: a cursed wand may redirect its own magic onto the caster
  // instead of the target. The charge is still spent; only the effect flips.
  procWandCurse: function (context: GameContext, caster: Entity, wand: Entity): boolean {
    if (!wand?.cursed || wand.curseId !== "backfiring") return false;
    if (Math.random() >= CURSE_PROC_CHANCE) return false;
    const source = wand as unknown as {
      wandEffects?: () => StatusEffect[];
      wandEffect?: () => StatusEffect;
    };
    const effects = source.wandEffects?.() ?? (source.wandEffect ? [source.wandEffect()] : []);
    for (const effect of effects) applyEffect(caster, effect);
    this.log(context, "Your cursed wand backfires!");
    return true;
  },

  conductShock: function (context: GameContext, target: Entity, primaryDamage: number, excluded: ReadonlySet<Entity> = new Set()): void {
    const tiles = terrainFor(context);
    if (!Number.isFinite(primaryDamage) || primaryDamage <= 0 ||
        target.x === undefined || target.y === undefined || target.isFlying ||
        tiles.getFeature(target.x, target.y) !== "water") return;
    const connected = new Set<string>();
    const pending: Array<[number, number]> = [[target.x, target.y]];
    for (let index = 0; index < pending.length; index++) {
      const [x, y] = pending[index];
      const key = `${x},${y}`;
      if (connected.has(key) || this.currentLevel[y]?.[x] !== 0 || tiles.getFeature(x, y) !== "water") continue;
      connected.add(key);
      pending.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    // Snapshot victims before deaths/drop hooks mutate the entity list. No recursive
    // attacks, hit effects, crits or accuracy rolls: each secondary victim is hit once.
    const victims = context.entities.filter(e => e !== target && !excluded.has(e) &&
      (e.type === "player" || e.type === "enemy") && e.healthPoints > 0 &&
      e.x !== undefined && e.y !== undefined && connected.has(`${e.x},${e.y}`) &&
      !e.isFlying);
    const baseDamage = Math.ceil(primaryDamage / 2);
    for (const victim of victims) {
      if (!context.entities.includes(victim) || victim.healthPoints <= 0) continue;
      const damage = Math.max(0, baseDamage - (victim.resistance.shock ?? 0) + (victim.vulnerability.shock ?? 0));
      if (damage > 0) victim.takeDamage(damage);
      context.onShockArc?.({ fromX: target.x, fromY: target.y, toX: victim.x!, toY: victim.y!, damageType: "shock" });
      announceHit(context, victim,
        `Water conducts lightning into ${victim.type === "player" ? "you" : victim.name} for ${damage} shock damage.`, damage > 0);
      if (victim.healthPoints <= 0) removeEntity(context, victim);
    }
  },

  // Airborne actors can be struck by direct arcs too. Water extends the splash
  // to grounded actors throughout the connected pool. Adjacent actors take the
  // stronger 150% arc instead of stacking it with the 50% water hit. Snapshot
  // before death hooks run; no recursive arcs, extra charges or action cost.
  conductShockAdjacent: function (context: GameContext, target: Entity, primaryDamage: number): void {
    if (!Number.isFinite(primaryDamage) || primaryDamage <= 0 ||
        target.x === undefined || target.y === undefined) return;
    const tx = target.x;
    const ty = target.y;
    const victims = context.entities.filter(e => e !== target &&
      (e.type === "player" || e.type === "enemy") && e.healthPoints > 0 &&
      e.x !== undefined && e.y !== undefined &&
      Math.max(Math.abs(e.x - tx), Math.abs(e.y - ty)) <= 1);
    this.conductShock(context, target, primaryDamage, new Set(victims));
    const baseDamage = Math.ceil(primaryDamage * 1.5);
    for (const victim of victims) {
      if (!context.entities.includes(victim) || victim.healthPoints <= 0) continue;
      const damage = Math.max(0, baseDamage - (victim.resistance.shock ?? 0) + (victim.vulnerability.shock ?? 0));
      if (damage > 0) victim.takeDamage(damage);
      context.onShockArc?.({ fromX: tx, fromY: ty, toX: victim.x!, toY: victim.y!, damageType: "shock" });
      announceHit(context, victim,
        `Lightning arcs into ${victim.type === "player" ? "you" : victim.name} for ${damage} shock damage.`, damage > 0);
      if (victim.healthPoints <= 0) removeEntity(context, victim);
    }
  },

  freezeWater: function (context: GameContext, x: number, y: number): number {
    const tiles = terrainFor(context);
    // A cardinal splash cannot freeze through corners, doors or walls.
    let count = 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (this.currentLevel[ny]?.[nx] !== 0 || tiles.getFeature(nx, ny) !== "water") continue;
      tiles.setFeature(nx, ny, "ice");
      count++;
    }
    if (count) {
      this.onTerrainChanged?.();
      // Do not announce offscreen enemy frost activity.
      if (context.visibleTiles.has(`${x},${y}`)) this.log(context, "The water freezes into ice.");
    }
    return count;
  },

  igniteGrass: function (
    context: GameContext,
    entity: Entity,
    x: number,
    y: number
  ): void {
    const tiles = terrainFor(context);
    const level = this.currentLevel;
    if (!level) return;

    const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // Preserve contact ignition (underfoot or cardinally adjacent), then spread
    // through connected grass only. Iteration avoids recursion limits on big patches.
    const pending: Array<[number, number]> = [[x, y], ...dirs.map(([dx, dy]) =>
      [x + dx, y + dy] as [number, number])];
    const burned = new Set<string>();
    for (let index = 0; index < pending.length; index++) {
      const [nx, ny] = pending[index];
      if (level[ny]?.[nx] !== 0 || tiles.getFeature(nx, ny) !== "grass") continue;
      // Clearing immediately also marks this cell visited, even around loops.
      tiles.clearFeature(nx, ny);
      burned.add(`${nx},${ny}`);
      for (const [dx, dy] of dirs) pending.push([nx + dx, ny + dy]);
    }
    if (!burned.size) return;

    // Terrain contact is logical, independent of sprites or current visibility.
    for (const other of context.entities) {
      if (other !== entity && (other.type === "player" || other.type === "enemy") &&
          other.healthPoints > 0 && other.x !== undefined && other.y !== undefined &&
          burned.has(`${other.x},${other.y}`) && !other.isFlying) {
        applyEffect(other, createBurningEffect());
      }
    }
    context.onGrassBurn?.([...burned].map(key => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    }));
    this.onTerrainChanged?.();
    this.log(context, `Fire burns through ${burned.size} grass tile${burned.size === 1 ? "" : "s"}!`);
  },

  // Trace in travel order, not entity-list order. Items and dead actors
  // do not stop projectiles, and the launch tile is excluded.
  firstActorInPath: function (
    context: GameContext,
    attacker: Entity,
    tx: number,
    ty: number
  ): Entity | undefined {
    if (attacker.x === undefined || attacker.y === undefined) return undefined;
    const points = bresenhamLine(attacker.x, attacker.y, tx, ty);
    for (const [x, y] of points.slice(1)) {
      const actor = context.entities.find(e => {
        if (e === attacker || (e.type !== "enemy" && e.type !== "player") ||
            e.healthPoints <= 0 || e.x === undefined || e.y === undefined) return false;
        // A wide body intercepts the bolt on any of its cells, not only when
        // the exact line passes through its anchor.
        return footprintContains(actorFootprint(e), e.x, e.y, x, y);
      });
      if (actor) return actor;
    }
    return undefined;
  },

  attackEntity: function (
    context: GameContext,
    attacker: Entity,
    victim: Entity,
    rangedAttack: number,
    tint: number | undefined,
    damageType?: DamageType
  ): void {
    if (!context.scene || !context.map) {
      throw new Error("context scene or map are missing");
    }
    if (rangedAttack) {
      victim = this.firstActorInPath(context, attacker, victim.x!, victim.y!) ?? victim;
    }
    attacker.moving = true;
    attacker.tweens = attacker.tweens || 0;
    attacker.tweens += 1;

    if (!rangedAttack) {
      context.scene.tweens.add({
        targets: attacker.sprite!,
        onComplete: () => {
          attacker.sprite!.x = context.map!.tileToWorldX(attacker.x!)!;
          attacker.sprite!.y = context.map!.tileToWorldY(attacker.y!)!;
          attacker.moving = false;
          attacker.tweens -= 1;

          this.resolveAndApplyAttack(
            context,
            attacker,
            victim,
            rangedAttack,
            damageType
          );
        },
        x: context.map.tileToWorldX(victim.x!)!,
        y: context.map.tileToWorldY(victim.y!)!,
        ease: "Power2",
        hold: 0,
        duration: 50,
        delay: 0,
        yoyo: true
      });
    } else {
      const x = context.map.tileToWorldX(attacker.x!)!;
      const y = context.map.tileToWorldY(attacker.y!)!;
      const projectileTexture = attacker === context.player
        ? context.player.currentWeapon()?.projectileTexture
        : attacker.projectileTexture;
      // Every ranged attack carries generated bolt art. Without it there is
      // nothing sensible to draw, so resolve at once instead of showing a
      // borrowed atlas frame.
      if (!projectileTexture) {
        attacker.moving = false;
        attacker.tweens -= 1;
        this.resolveAndApplyAttack(context, attacker, victim, rangedAttack, damageType);
        return;
      }
      const targetX = context.map.tileToWorldX(victim.x!)!;
      const targetY = context.map.tileToWorldY(victim.y!)!;
      const offset = tileSize / 2;
      const sprite = context.scene.add
        .sprite(x + offset, y + offset, projectileTexture, 0)
        .setOrigin(0.5)
        .setDepth(250);
      sprite.setRotation(Math.atan2(targetY - y, targetX - x));
      if (tint) {
        sprite.tint = tint;
      }

      context.scene.tweens.add({
        targets: sprite,
        onComplete: () => {
          attacker.moving = false;
          attacker.tweens -= 1;

          this.resolveAndApplyAttack(
            context,
            attacker,
            victim,
            rangedAttack,
            damageType
          );
          sprite.destroy();
        },
        x: targetX + offset,
        y: targetY + offset,
        ease: "Power2",
        hold: 0,
        duration: 120,
        delay: 0
      });
    }
  },

  resolveAndApplyAttack: function (
    context: GameContext,
    attacker: Entity,
    victim: Entity,
    rangedAttack: number,
    damageType?: DamageType
  ): void {
    const result = resolveAttack(context, attacker, victim, {
      damageType: damageType ?? "physical",
      isRanged: rangedAttack ? true : false,
      // Sidearm strikes can skip abilities that belong to the primary attack.
      onHitEffects: attacker.onHitEffects(!!rangedAttack)
    });

    applyAttackResult(context, attacker, victim, result, {
      applyEffect: (target, effect) => applyEffect(target, effect),
      removeEffect: (target, id) => removeEffect(target, id),
      removeEntity: (ctx, target) => removeEntity(ctx, target),
      onHit: () => {
        const attackNote = [result.surprise ? "Surprise" : "", result.crit ? "Critical" : ""].filter(Boolean).join(", ");
        const prefix = attackNote ? `${attackNote}! ` : "";
        const seenVictim = isEnemyVisible(context, victim);
        if (result.damage > 0) {
          if (seenVictim) spawnEntityFloatingText(victim, `-${result.damage}`);
          announceHit(context, victim,
            `${prefix}${attacker.type === "player" ? "You hit" : `${attacker.name} hits`} ${victim.type === "player" ? "you" : victim.name} for ${result.damage} ${result.damageType} damage.`, true);
          if (seenVictim) this.applyHitEffects(context, victim, result.surprise);
        } else {
          announceHit(context, victim,
            `${prefix}${attacker.type === "player" ? "You hit" : `${attacker.name} hits`} ${victim.type === "player" ? "you" : victim.name} for no damage.`);
          // A hit that lands but deals no damage still needs impact audio, just
          // a different one from a wound. Hidden victims stay silent on screen.
          if (seenVictim) this.applyHitEffects(context, victim, result.surprise, false);
        }
        // Ordinary weapon attacks retain curse procs; throws/wands do not.
        if (victim.type === "player") this.procArmorCurse(context, victim);
        if (attacker.type === "player") this.procWeaponCurse(context, attacker, victim, result.damage);
        // Unknown physical gear becomes familiar from real combat use. A weapon
        // learns from a landed swing; armor learns from a blow it absorbs.
        if (attacker.type === "player") context.player?.currentWeapon?.()?.learnEquipmentFromUse?.();
        if (victim.type === "player") context.player?.armor?.learnEquipmentFromUse?.();
      }
    });
  },

  log: function (context: GameContext, text: string): void {
    context.messages.unshift(text);
    context.messages = context.messages.slice(0, 20);
  },

  applyHitEffects: function (context: GameContext, victim: Entity, surprise = false, damaged = true): void {
    if (!context.scene) return;

    if (victim.type === "player") {
      if (damaged) sfx.hurt();
      else sfx.deflect();
    } else if (surprise) {
      sfx.surpriseHit();
    } else {
      sfx.hit();
    }

    // A fully absorbed hit only carries sound; no wound visuals are shown.
    if (!damaged) return;

    // White flash on the victim's sprite.
    if (victim.sprite) {
      const prevTint = victim.sprite.tint;
      victim.sprite.setTint(0xffffff);
      context.scene.time.delayedCall(90, () => {
        if (victim.sprite) victim.sprite.setTint(prevTint);
      });
    }

    // Red impact sparks at the victim's position.
    if (context.map && victim.x !== undefined && victim.y !== undefined) {
      const wx = context.map.tileToWorldX(victim.x)! + 8;
      const wy = context.map.tileToWorldY(victim.y)! + 8;
      const emitter = context.scene.add.particles(wx, wy, "spark", {
        speed: { min: 20, max: 70 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.2, end: 0 },
        lifespan: 260,
        quantity: 6,
        tint: 0xff6a6a,
        emitting: false
      });
      emitter.explode(6);
      context.scene.time.delayedCall(400, () => emitter.destroy());
    }
  }
};

export default dungeon;
