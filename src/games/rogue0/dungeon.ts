// @ts-nocheck
import type { GameContext } from "./context";
import PF from "pathfinding";
import type { Entity } from "./entity";
import { removeEntity } from "./entity";

export const Sprites = {
  floor: 0,
  wall: 49 * 13
};

const tileSize = 16;

let dungeon = {
  currentLevel: [],
  layer: undefined,

  initialize: function(context, levelArray) {
    this.currentLevel = levelArray;

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
      this.layer = undefined;
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

  getCurrentLevel: function() {
    return this.currentLevel;
  },

  isWalkableTile: function(context, x, y) {
    for (const entity of context.entities) {
      if (entity.sprite && entity.x === x && entity.y === y) return false;
    }

    const tileAtDestination = context.map?.getTileAt(x, y);
    return tileAtDestination?.index !== Sprites.wall;
  },

  entityAtTile: function(context, x, y) {
    for (const entity of context.entities) {
      if (entity.sprite && entity.x === x && entity.y === y) return entity;
    }
    return undefined;
  },

  itemPicked: function(entity) {
    if (entity.sprite) {
      entity.context?.scene?.tweens.killTweensOf(entity.sprite);
      entity.sprite.destroy();
    }
    entity.sprite = undefined;
    entity.x = undefined;
    entity.y = undefined;
  },

  distanceBetweenEntities: function(entity1, entity2) {
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
    const grid = new PF.Grid(this.currentLevel);
    const finder = new PF.AStarFinder({
      diagonalMovement: PF.DiagonalMovement.Always
    });
    const path = finder.findPath(
      entity1.x,
      entity1.y,
      entity2.x,
      entity2.y,
      grid
    );
    return path.length >= 2 ? path.length : 0;
  },

  moveEntityTo: function(context, entity, x, y) {
    if (context.map == undefined || context.scene == undefined) {
      throw new Error("context.map is undefined");
    }
    entity.moving = true;

    context.scene.tweens.add({
      targets: entity.sprite,
      onComplete: () => {
        entity.moving = false;
        entity.x = x;
        entity.y = y;
      },
      x: context.map.tileToWorldX(x),
      y: context.map.tileToWorldY(y),
      ease: "Power2",
      duration: 50
    });
  },

  attackEntity: function(context, attacker, victim, rangedAttack, tint) {
    if (!context.scene || !context.map) {
      throw new Error("context scene or map are missing");
    }
    attacker.moving = true;
    attacker.tweens = attacker.tweens || 0;
    attacker.tweens += 1;

    if (!rangedAttack) {
      context.scene.tweens.add({
        targets: attacker.sprite,
        onComplete: () => {
          attacker.sprite!.x = context.map?.tileToWorldX(attacker.x!)!;
          attacker.sprite!.y = context.map?.tileToWorldY(attacker.y!)!;
          attacker.moving = false;
          attacker.tweens -= 1;

          let damage = attacker.attack() - victim.protection();
          if (damage > 0) {
            victim.healthPoints -= damage;

            this.log(
              context,
              `${attacker.name} does ${damage} damage to ${victim.name}.`
            );

            this.applyHitEffects(context, victim);

            if (victim.healthPoints <= 0) {
              removeEntity(context, victim);
            }
          }
        },
        x: context.map.tileToWorldX(victim.x!),
        y: context.map.tileToWorldY(victim.y!),
        ease: "Power2",
        hold: 20,
        duration: 80,
        delay: attacker.tweens * 200,
        yoyo: true
      });
    } else {
      const x = context.map.tileToWorldX(attacker.x!);
      const y = context.map.tileToWorldY(attacker.y!);
      const sprite = context.scene.add
        .sprite(x!, y!, "tiles", rangedAttack)
        .setOrigin(0);
      if (tint) {
        sprite.tint = tint;
      }

      context.scene.tweens.add({
        targets: sprite,
        onComplete: () => {
          attacker.moving = false;
          attacker.tweens -= 1;

          let attack = attacker.attack();
          let protection = victim.protection();
          let damage = attack - protection;
          if (damage > 0) {
            victim.healthPoints -= damage;

            this.log(
              context,
              `${attacker.name} does ${damage} damage to ${victim.name}.`
            );

            this.applyHitEffects(context, victim);

            if (victim.healthPoints <= 0) {
              removeEntity(context, victim);
            }
          }
          sprite.destroy();
        },
        x: context.map.tileToWorldX(victim.x!),
        y: context.map.tileToWorldY(victim.y!),
        ease: "Power2",
        hold: 20,
        duration: 180,
        delay: attacker.tweens * 200
      });
    }
  },

  log: function(context, text) {
    context.messages.unshift(text);
    context.messages = context.messages.slice(0, 8);
  },

  applyHitEffects: function(context, victim) {
    if (!context.scene) return;

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
      const wx = context.map.tileToWorldX(victim.x) + 8;
      const wy = context.map.tileToWorldY(victim.y) + 8;
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
