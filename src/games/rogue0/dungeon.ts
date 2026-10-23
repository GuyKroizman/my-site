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
  canStepBetween: function (sx: number, sy: number, tx: number, ty: number): boolean {
    const dx = Math.abs(tx - sx);
    const dy = Math.abs(ty - sy);
    if (Math.max(dx, dy) !== 1) return false;
    if (!dx || !dy) return true;
    return this.pathGrid!.isWalkableAt(sx, ty) && this.pathGrid!.isWalkableAt(tx, sy);
  },

  // Pathfinding mutates node state (opened/closed), so always search on a
  // fresh grid clone to avoid stale state between calls.
  // `throughDoors` lets players and pursuing enemies plan routes through
  // closed doors; movement must open the door before entering.
  findPath: function (sx: number, sy: number, tx: number, ty: number, throughDoors = false, avoidTraps = false): number[][] {
    const grid = this.pathGrid!.clone();
    if (throughDoors) {
      tiles.forEachFeature((x, y, s) => {
        if (s.feature === "door" && s.door === "closed") {
          grid.setWalkableAt(x, y, true);
        }
      });
    }
    // Only the explicitly selected destination may be a revealed trap.
    // Apply this on every search so newly revealed traps also stop auto-walk.
    if (avoidTraps) {
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
      .filter(next => this.canStepBetween(node.x, node.y, next.x, next.y));
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

    if (tiles.isBlocking(x, y)) {
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
          this.canStepBetween(player.x, player.y, x, y)
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
    return tiles.describeTile(state, isWall);
  },

  // SPD-style search: reveal hidden traps in the 3x3 area around (x, y).
  // Returns the number of traps uncovered.
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
        }
      }
    }

    if (found > 0) this.onTerrainChanged?.();
    return found;
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

  moveEntityTo: function (context: GameContext, entity: Entity, x: number, y: number): void {
    if (context.map == undefined || context.scene == undefined) {
      throw new Error("context.map is undefined");
    }

    const oldX = entity.x;
    const oldY = entity.y;
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

    // Water douses fire for any entity that steps in.
    if (tiles.getFeature(destX, destY) === "water" && hasEffect(entity, "burning")) {
      removeEffect(entity, "burning");
      this.log(context, `${entity.name} steps into water and the flames go out.`);
    }

    // Only the player triggers traps.
    if (entity.type === "player") {
      const state = tiles.getTileState(destX, destY);
      if (state && state.feature === "trap" && state.trap !== "triggered") {
        tiles.setTrapState(destX, destY, "triggered");
        this.onTerrainChanged?.();

        const kind = state.trapKind ?? "dart";
        this.log(context, `You step on a ${kind} trap!`);

        switch (kind) {
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
    if (hasEffect(entity, "burning")) {
      this.igniteGrass(context, entity, destX, destY);
    }

    if (entity.type === "player") {
      sfx.step();
    }
    // Unseen monsters should not make the player wait for invisible walk
    // animations. Keep animations when either endpoint is visible.
    if (entity.type === "enemy" &&
        !context.visibleTiles.has(`${entity.x},${entity.y}`) &&
        !context.visibleTiles.has(`${destX},${destY}`)) {
      entity.x = destX;
      entity.y = destY;
      closeDoorBehind();
      entity.sprite?.setPosition(
        context.map.tileToWorldX(destX)!, context.map.tileToWorldY(destY)!
      );
      return;
    }
    entity.moving = true;

    context.scene.tweens.add({
      targets: entity.sprite!,
      onComplete: () => {
        entity.moving = false;
        entity.x = destX;
        entity.y = destY;
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

  igniteGrass: function (
    context: GameContext,
    entity: Entity,
    x: number,
    y: number
  ): void {
    const level = this.currentLevel;
    if (!level) return;

    const dirs: Array<[number, number]> = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= level[0].length || ny >= level.length) continue;
      if (tiles.getFeature(nx, ny) !== "grass") continue;

      tiles.clearFeature(nx, ny);
      this.onTerrainChanged?.();
      this.log(context, `The grass at ${nx},${ny} ignites and burns away.`);

      for (const other of context.entities) {
        if (
          other !== entity &&
          other.sprite &&
          other.x === nx &&
          other.y === ny &&
          other.type !== "item"
        ) {
          applyEffect(other, createBurningEffect());
        }
      }
      return;
    }
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
