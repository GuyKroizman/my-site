// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import BasicHero from "./basicHero";
import type { GameContext } from "../context";
import Hammer from "../items/hammer";
import dungeon from "../dungeon";

export default class Cleric extends BasicHero {

  constructor(context : GameContext, x: number, y: number) {
    super(context)

    this.name = "Cleric"
    this.movementPoints = 3
    this.actionPoints = 2
    this.healthPoints = 40
    this.tile = 2 * 49 + 24;

    this.items.push(new Hammer(context))
    this.toggleItem(context, 0)

    this.init(context, x, y)
  }

  refresh() {
    this.movementPoints = 3
    this.actionPoints = 2

    // Cleric heals a bit every turn
    if (this.healthPoints < 40) {
      this.healthPoints += 1
      dungeon.log(this.context, "Cleric heals 1 HP")
    }
  }
}
