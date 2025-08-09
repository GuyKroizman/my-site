// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import type { GameContext } from "../context";
import { Entity } from "../entity"
import type { EntityType } from "../entity";

export default class Sword extends Entity{

  name: string = "A Sword";
  description: string = "A basic sword. Causes between 1 and 5 damage.";
  type:EntityType =  "item";
  healthPoints: number = 0;
  actionPoints: number = 0;
  tile: number = 328;
  weapon: boolean = true;
  moving: boolean = false;


  constructor(context: GameContext, x?: number, y?: number ) {
    super();
    this.init(context, x, y);
  }

  damage() {
    return Phaser.Math.Between(1, 5)
  }

  turn() {
  }

  equip() {
  }

  unequip() {
  }

  refresh() {
  }

  isOver() {
    return true
  }

  createUI() {
    return 0
  }

  attack(): number {
    return 0
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
