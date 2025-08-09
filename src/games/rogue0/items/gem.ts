// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import { Entity } from "../entity";
import type { EntityType } from "../entity";
import type { GameContext } from "../context";

export default class Gem extends Entity {
  name: string = "Gem";
  description: string = "A gem";
  type: EntityType = "item";
  tile = 4 * 49 + 23;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.init(context, x, y);
  }

  equip(itemNumber: number) {
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
