import type { GameContext } from "./context";
import PF from "pathfinding";
import { bresenhamLine } from "./fov";
import type { Entity } from "./entity";
import { removeEntity } from "./entity";
import { sfx } from "./audio";
import { resolveAttack } from "./combat";
import { spawnEntityFloatingText } from "./floatingText";
import * as tiles from "./tiles";
import {
  applyEffect,
  createBurningEffect,
  createFrozenEffect,
  createCrippledEffect,
  createConfusedEffect,
  createPoisonedEffect,
  hasEffect,
  removeEffect
} from "./effects";
import type { DamageType } from "./effects";

export const Sprites = {
  floor: 0,
  wall: 49 * 13
};

const tileSize = 16;

let dungeon = {
  currentLevel: [] as number[][],
  layer: null as Phaser.Tilemaps.TilemapLayer | null,
  pathGrid: null as PF.Grid | null,
  diagonalFinder: null as PF.AStarFinder | null,
  context: null as GameContext | null,
  onTerrainChanged: null as (() => void) | null,

  initialize: function (context: GameContext, levelArray: number[][]) {
    this.currentLevel = levelArray;
    context.currentLevel = levelArray;
    this.context = context;
    this.pathGrid = new PF.Grid(levelArray);
    tiles.applyToPathGrid(this.pathGrid);
    this.diagonalFinder = new PF.AStarFinder({
      diagonalMovement: PF.DiagonalMovement.OnlyWhenNoObstacles
    });

    const level0 = levelArray.map((r) =>
      r.map((t) => (t == 1 ? Sprites.wall : Sprites.floor))
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
      "tiles",
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

  // Diagonal steps and melee cannot cut across walls or closed doors.
  canStepBetween: function (sx: number, sy: number, tx: number, ty: number, actor?: Entity): boolean {
    const dx = Math.abs(tx - sx);
    const dy = Math.abs(ty - sy);
    if (Math.max(dx, dy) !== 1) return false;
    if (!dx || !dy) return true;
    const passable = (x: number, y: number) => this.pathGrid!.isWalkableAt(x, y) ||
      (!!actor && hasEffect(actor, "levitating") && tiles.getFeature(x, y) === "chasm" && this.currentLevel[y]?.[x] === 0);
    return passable(sx, ty) && passable(tx, sy);
  },

  // Pathfinding mutates node state (opened/closed), so always search on a
  // fresh grid clone to avoid stale state between calls.
  // `throughDoors` lets players and pursuing enemies plan routes through
  // closed doors; movement must open the door before entering.
  findPath: function (sx: number, sy: number, tx: number, ty: number, throughDoors = false, avoidTraps = false, actor?: Entity): number[][] {
    const grid = this.pathGrid!.clone();
    const flying = !!actor && hasEffect(actor, "levitating");
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
    // Planning may enter a closed door, but not cut diagonally past it.
    const getNeighbors = grid.getNeighbors.bind(grid);
    grid.getNeighbors = (node, diagonalMovement) => getNeighbors(node, diagonalMovement)
      .filter(next => this.canStepBetween(node.x, node.y, next.x, next.y, actor));
    return this.diagonalFinder!.findPath(sx, sy, tx, ty, grid);
  },

  isWalkableTile: function (context: GameContext, x: number, y: number): boolean {
    const level = this.currentLevel;
    if (!level || y < 0 || x < 0 || y >= level.length || x >= level[0].length) {
      return false;
    }

    for (const entity of context.entities) {
      if (entity.sprite && entity.x === x && entity.y === y) return false;
    }

    if (level[y][x] !== 0) return false;
    const flying = !!context.player && hasEffect(context.player, "levitating");
    if (tiles.isBlocking(x, y) && !(flying && tiles.getFeature(x, y) === "chasm")) {
      // Closed doors open when the player tries to step into them. This lives
      // here because the player's movement code is in basicHero.processInput
      // (which is outside the set of files this terrain pass may edit).
      const state = tiles.getTileState(x, y);
      if (state?.feature === "door" && state.door === "closed") {
        const player = context.player;
        if (
          player &&
          player.x !== undefined &&
          player.y !== undefined &&
          this.canStepBetween(player.x, player.y, x, y, player)
        ) {
          this.openDoor(x, y);
        }
      }
      return false;
    }

    const tileAtDestination = context.map?.getTileAt(x, y);
    return tileAtDestination?.index !== Sprites.wall;
  },

  openDoor: function (x: number, y: number): boolean {
    if (tiles.getFeature(x, y) !== "door") return false;
    if (tiles.getDoorState(x, y) !== "closed") return false;

    tiles.setDoorState(x, y, "open");
    this.pathGrid?.setWalkableAt(x, y, true);
    this.onTerrainChanged?.();

    if (this.context) {
      this.log(this.context, "The door opens.");
    }
    return true;
  },

  // Describes a tile for the Inspect command. Purely informational — it does
  // not reveal hidden traps (those stay invisible until stepped on).
  inspectTile: function (x: number, y: number): string {
    const state = tiles.getTileState(x, y);
    const map = this.currentLevel;
    const isWall = !!map && map[y]?.[x] === 1;
    const gas = this.context?.poisonClouds?.some(c => c.x === x && c.y === y &&
      c.expiresAt > (this.context?.simulationTime ?? 0) + 1e-9);
    return tiles.describeTile(state, isWall) + (gas ? " Poison gas: poisons on entry and while you remain here, even when levitating." : "");
  },

  // Reveal hidden traps and secret end walls in the surrounding 3x3 area.
  // Returns the total discoveries; terrain callbacks refresh FOV and visuals.
  searchAround: function (x: number, y: number): number {
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
  triggerArrowTrap: function (context: GameContext, x: number, y: number): boolean {
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
    if (context.scene && context.map && context.visibleTiles.has(`${x},${y}`)) {
      const arrow = context.scene.add.sprite(
        context.map.tileToWorldX(x)! + 8, context.map.tileToWorldY(y)! + 8, "bow-arrow"
      ).setOrigin(0.5).setDepth(250).setRotation(Math.atan2(endY - y, endX - x));
      context.scene.tweens.add({ targets: arrow,
        x: context.map.tileToWorldX(endX)! + 8, y: context.map.tileToWorldY(endY)! + 8,
        duration: 120, onComplete: () => arrow.destroy() });
    }
    // Damage resolves immediately so subsequent simulation events cannot
    // outrun the cosmetic projectile or target a dead actor.
    if (victim) {
      const damage = Math.max(1, 5 - victim.protection());
      victim.takeDamage(damage);
      this.log(context, `The arrow hits ${victim.name} for ${damage} damage.`);
      if (victim.healthPoints <= 0) removeEntity(context, victim);
    }
    return true;
  },

  entityAtTile: function (context: GameContext, x: number, y: number): Entity | undefined {
    for (const entity of context.entities) {
      if (entity.sprite && entity.x === x && entity.y === y) return entity;
    }
    return undefined;
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
    const chasm = tiles.getFeature(x, y) === "chasm";
    if (this.currentLevel[y]?.[x] !== 0 || (!chasm && tiles.isBlocking(x, y)) ||
        context.entities.some(e => e !== actor && e.type !== "item" && e.healthPoints > 0 && e.x === x && e.y === y)) {
      this.log(context, `${actor.name} stumbles in confusion but cannot move.`);
      return true;
    }
    this.log(context, `${actor.name} stumbles in confusion!`);
    const falling = chasm && !hasEffect(actor, "levitating");
    this.moveEntityTo(context, actor, x, y, falling);
    if (falling) this.fallIntoChasm(context, actor);
    return true;
  },

  // Effect-level forced movement, NOT a player ability. A trap or other effect
  // supplies a cardinal unit vector; it owns its action cost. The victim gets
  // no free action and loses no scheduled action. Shared path grids stay intact.
  knockback: function (context: GameContext, target: Entity, dx: number, dy: number): boolean {
    if (target.healthPoints <= 0 || (target.type !== "enemy" && target.type !== "player") ||
        !context.entities.includes(target) || target.x === undefined || target.y === undefined ||
        target.moving || hasEffect(target, "rooted")) return false;
    if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) + Math.abs(dy) !== 1) return false;
    const x = target.x + dx;
    const y = target.y + dy;
    const chasm = tiles.getFeature(x, y) === "chasm";
    if (this.currentLevel[y]?.[x] !== 0 || (!chasm && tiles.isBlocking(x, y)) ||
        context.entities.some(e => e !== target && e.type !== "item" && e.healthPoints > 0 && e.x === x && e.y === y)) return false;
    // Wake monsters without granting magical knowledge of the player's position.
    target.hearNoise(target.x, target.y);
    this.log(context, `${target.name} is knocked back!`);
    if (chasm && !hasEffect(target, "levitating")) {
      this.moveEntityTo(context, target, x, y, true);
      this.log(context, `${target.name} falls into the chasm!`);
      this.fallIntoChasm(context, target);
    } else {
      this.moveEntityTo(context, target, x, y);
    }
    return true;
  },

  jumpIntoChasm: function (context: GameContext, actor: Entity, x: number, y: number): boolean {
    if (actor.type !== "player" || actor.healthPoints <= 0 || actor.x === undefined || actor.y === undefined ||
        hasEffect(actor, "rooted") || hasEffect(actor, "levitating") ||
        Math.abs(actor.x - x) + Math.abs(actor.y - y) !== 1 ||
        this.currentLevel[y]?.[x] !== 0 || tiles.getFeature(x, y) !== "chasm" ||
        context.entities.some(e => e !== actor && e.type !== "item" && e.healthPoints > 0 && e.x === x && e.y === y)) return false;
    this.moveEntityTo(context, actor, x, y, true);
    this.log(context, "You jump into the chasm!");
    this.fallIntoChasm(context, actor);
    return true;
  },

  expireLevitation: function (context: GameContext, entity: Entity): void {
    this.fallIntoChasm(context, entity);
  },

  fallIntoChasm: function (context: GameContext, entity: Entity): void {
    if (entity.x === undefined || entity.y === undefined || entity.healthPoints <= 0 ||
        tiles.getFeature(entity.x, entity.y) !== "chasm") return;
    if (entity.type === "player") {
      context.pendingFall = true;
      entity.actionReady = false;
    } else if (entity.type === "enemy") {
      entity.takeDamage(entity.healthPoints);
      removeEntity(context, entity);
    }
  },

  moveEntityTo: function (context: GameContext, entity: Entity, x: number, y: number, instant = false): void {
    if (context.map == undefined || context.scene == undefined) {
      throw new Error("context.map is undefined");
    }

    // Enforce actor occupancy here too, not just in individual AI paths.
    if (entity.type !== "item" && context.entities.some(other =>
      other !== entity && other.type !== "item" && other.healthPoints > 0 &&
      other.x === x && other.y === y
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

    const flying = hasEffect(entity, "levitating");
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
      this.log(context, `A geyser erupts beneath ${entity.name}!`);
      // Diagonal entries choose the horizontal component, so every blast has
      // a predictable cardinal direction and never cuts a wall corner.
      const dx = Math.sign(destX - oldX);
      const dy = dx === 0 ? Math.sign(destY - oldY) : 0;
      if (!this.knockback(context, entity, dx, dy)) {
        this.log(context, `${entity.name} cannot be displaced by the geyser.`);
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
      this.log(context, `${entity.name} steps into water and the flames go out.`);
    }

    // Confusion plates affect either side; other ordinary traps remain player-only.
    if ((entity.type === "player" || (entity.type === "enemy" && entryTrap?.trapKind === "confusion")) && !flying && entering) {
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
        if (occupied) continue;

        cells.push({ x, y });
      }
    }

    if (cells.length === 0) return null;
    return cells[Math.floor(Math.random() * cells.length)];
  },

  conductShock: function (context: GameContext, target: Entity, primaryDamage: number): void {
    if (!Number.isFinite(primaryDamage) || primaryDamage <= 0 ||
        target.x === undefined || target.y === undefined || hasEffect(target, "levitating") ||
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
    const victims = context.entities.filter(e => e !== target &&
      (e.type === "player" || e.type === "enemy") && e.healthPoints > 0 &&
      e.x !== undefined && e.y !== undefined && connected.has(`${e.x},${e.y}`) &&
      !hasEffect(e, "levitating"));
    const baseDamage = Math.ceil(primaryDamage / 2);
    for (const victim of victims) {
      if (!context.entities.includes(victim) || victim.healthPoints <= 0) continue;
      const damage = Math.max(0, baseDamage - (victim.resistance.shock ?? 0) + (victim.vulnerability.shock ?? 0));
      if (damage > 0) victim.takeDamage(damage);
      if (victim.type === "player" || context.visibleTiles.has(`${victim.x},${victim.y}`)) {
        this.log(context, `Water conducts lightning into ${victim.name} for ${damage} shock damage.`);
      }
      if (victim.healthPoints <= 0) removeEntity(context, victim);
    }
  },

  freezeWater: function (context: GameContext, x: number, y: number): number {
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
          burned.has(`${other.x},${other.y}`) && !hasEffect(other, "levitating")) {
        applyEffect(other, createBurningEffect());
      }
    }
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
      const actor = context.entities.find(e =>
        e !== attacker && (e.type === "enemy" || e.type === "player") &&
        e.healthPoints > 0 && e.x === x && e.y === y
      );
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
          attacker.sprite!.x = context.map?.tileToWorldX(attacker.x!)!;
          attacker.sprite!.y = context.map?.tileToWorldY(attacker.y!)!;
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
      const targetX = context.map.tileToWorldX(victim.x!)!;
      const targetY = context.map.tileToWorldY(victim.y!)!;
      const offset = projectileTexture ? tileSize / 2 : 0;
      const sprite = context.scene.add
        .sprite(x + offset, y + offset, projectileTexture ?? "tiles", projectileTexture ? 0 : rangedAttack)
        .setOrigin(projectileTexture ? 0.5 : 0)
        .setDepth(250);
      if (projectileTexture) {
        sprite.setRotation(Math.atan2(targetY - y, targetX - x));
      }
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
      onHitEffects: attacker.onHitEffects()
    });

    if (!result.hit) {
      return;
    }

    if (result.damage > 0) {
      victim.takeDamage(result.damage);
      if (result.damageType === "shock") context.onShockWater?.(victim, result.damage);
      spawnEntityFloatingText(victim, `-${result.damage}`);
      this.log(
        context,
        `${attacker.name} hits ${victim.name} for ${result.damage} ${result.damageType} damage.`
      );
      this.applyHitEffects(context, victim);
    } else {
      this.log(
        context,
        `${attacker.name} hits ${victim.name} but deals no damage.`
      );
    }

    for (const effect of result.appliedEffects) {
      if (victim.healthPoints > 0) {
        applyEffect(victim, effect);
      }
    }

    if (victim.healthPoints <= 0) {
      removeEntity(context, victim);
    }
  },

  log: function (context: GameContext, text: string): void {
    context.messages.unshift(text);
    context.messages = context.messages.slice(0, 20);
  },

  applyHitEffects: function (context: GameContext, victim: Entity): void {
    if (!context.scene) return;

    if (victim.type === "player") {
      sfx.hurt();
    } else {
      sfx.hit();
    }

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
