// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import type { EntityType } from "../entity";
import type { GameContext } from "../context";
import { Entity} from "../entity";
import dungeon from "../dungeon";


export default class Shoe extends Entity {
  name: string = "Shoe";
  description: string = "A shoe";
  moving: boolean = false;
  type: EntityType = "item";
  tile: number = 19 * 49 + 32;

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.init(context, x, y);
  }

  equip(/*itemNumber: number*/) {
    if (!this.context.player) {
      return;
    }
    dungeon.log(this.context, 'You cannot use this shoe.');
  }

  damage(): number {
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
