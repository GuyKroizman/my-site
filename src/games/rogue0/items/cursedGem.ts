// TypeScript errors after site migration - ignoring for game functionality
import { Entity } from "../entity";
import type { EntityType } from "../entity";
import type { GameContext } from "../context";
import { applyEffect, removeEffect, createCursedEffect } from "../effects";

export default class CursedGem extends Entity {
  name: string = "Cursed Gem";
  description: string =
    "A cursed gem that drains your health each turn. It cannot be removed until the curse is lifted.";
  moving: boolean = false;
  type: EntityType = "item";
  tile = 4 * 49 + 22;
  cursed = true;
  tier = 1;
  equipSlot: "ring" = "ring";

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.init(context, x, y);
  }

  // While equipped, apply the ongoing curse penalty (per-round damage).
  equip() {
    const player = this.context.player;
    if (player) {
      applyEffect(player, createCursedEffect());
    }
  }

  // Once uncursed, unequipping it clears the penalty.
  unequip() {
    const player = this.context.player;
    if (player) {
      removeEffect(player, "cursed");
    }
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
