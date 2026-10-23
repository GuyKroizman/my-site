import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, removeEntity } from "../entity";
import { applyEffect, createTerrifiedEffect } from "../effects";
import dungeon from "../dungeon";

export default class ScrollOfTerror extends Entity {
  textureKey = "scroll-terror";
  type: EntityType = "item";
  tier = 1;
  equipSlot: "consumable" = "consumable";
  identified = false;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.tile = 15 * 49 + 40;
    this.name = "Scroll of Terror";
    this.description = "Fills the nearest visible enemy with fear, making it flee.";
    this.consumable = true;

    this.init(context, x, y);
  }

  equip() {
    const player = this.context.player;
    if (!player) return;

    let target: Entity | undefined;
    let best = Infinity;

    for (const e of this.context.entities) {
      if (e.type !== "enemy" || e.x === undefined || e.y === undefined) continue;
      if (!this.context.visibleTiles.has(`${e.x},${e.y}`)) continue;
      if (player.x === undefined || player.y === undefined) continue;

      const d = Math.max(Math.abs(e.x - player.x), Math.abs(e.y - player.y));
      if (d < best) {
        best = d;
        target = e;
      }
    }

    if (target) {
      applyEffect(target, createTerrifiedEffect(4));
      dungeon.log(this.context, `${target.name} is struck with terror!`);
    } else {
      dungeon.log(this.context, "No enemy in sight to terrify.");
    }

    player.removeItem(this);
    removeEntity(this.context, this);
  }

  damage() {
    return 0;
  }

  turn() {
  }

  refresh() {
  }

  isOver() {
    return true;
  }

  attack(): number {
    return 0;
  }

  protection(): number {
    return 0;
  }

  range(): number {
    return 0;
  }

  onDestroy() {
  }
}
