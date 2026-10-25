// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import { Entity } from "../entity"
import type { EntityType } from "../entity";

export default class Sword extends Entity{

  name: string = "A Sword";
  get displayDescription(): string {
    return `A basic sword. Causes between ${1 + this.level} and ${5 + this.level} damage.`;
  }
  type:EntityType =  "item";
  healthPoints: number = 0;
  tile: number = 328;
  moving: boolean = false;
  tier = 1;
  usesStrength = true;
  equipSlot: "weapon" = "weapon";


  constructor(context: GameContext, x?: number, y?: number ) {
    super();
    this.init(context, x, y);
  }

  damage() {
    return Phaser.Math.Between(1, 5) + this.level;
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
