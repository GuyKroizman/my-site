// TypeScript errors after site migration - ignoring for game functionality
import { Entity } from "../entity";
import type { EntityType } from "../entity";
import type { GameContext } from "../context";
import dungeon from "../dungeon";
import { removeEntity } from "../entity";
import { applyEffect, createStrengthenedEffect } from "../effects";

export default class BerserkPotion extends Entity {
  name: string = "Berserk Potion";
  description: string = "That feels Powerful!";
  moving: boolean = false;
  type: EntityType = "item";
  tile = 13 * 49 + 33;
  textureKey = "potion-purple";
  tier = 1;
  equipSlot: "consumable" = "consumable";

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.consumable = true;
    this.init(context, x, y);
  }

  equip() {
    if (!this.context.player) {
      return;
    }
    dungeon.log(this.context, `You drink the potion and feel as strong as a bear!`);
    applyEffect(this.context.player, createStrengthenedEffect(10));
    this.context.player.removeItem(this);
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
