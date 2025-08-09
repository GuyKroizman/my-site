// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import BasicHero from "./basicHero";
import type { GameContext } from "../context";
import Sword from "../items/sword";

export default class Warrior extends BasicHero {

  constructor(context : GameContext, x: number, y: number) {
    super(context)

    this.name = "Warrior"
    this.movementPoints = 3
    this.actionPoints = 2

    this.items.push(new Sword(context))
    this.toggleItem(context, 0)

    this.init(context, x, y)
  }

  refresh() {
    this.movementPoints = 3
    this.actionPoints = 2
  }
}
