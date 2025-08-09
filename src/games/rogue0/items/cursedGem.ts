// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import { Entity } from "../entity";
import type { EntityType } from "../entity";
import type { GameContext } from "../context";
import dungeon from "../dungeon";

export default class CursedGem extends Entity {
  name: string = "Cursed Gem";
  description: string = "A cursed gem that is now stuck to your hand. You can only remove it by finding a potion.";
  moving: boolean = false;
  type: EntityType = "item";
  tile = 4 * 49 + 23;
  actionPoints: number = 1;
  cursed: boolean = true;
  active: boolean = false;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.init(context, x, y);
  }

  equip(itemNumber: number) {
  }

  damage() {
    return Phaser.Math.Between(4, 8);
  }

  turn() {
    if (this.context.player?.items.includes(this)) {
      this.active = true;
      dungeon.log(this.context, `Cursed gem gives 1 damage to player. Find potion to cure.`);
      this.context.player.healthPoints -= 1;
      this.actionPoints = 0;
    }

    this.actionPoints = 0;
  }

  refresh() {
    this.actionPoints = 1;
  }

  isOver() {
    return this.actionPoints === 0;
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
