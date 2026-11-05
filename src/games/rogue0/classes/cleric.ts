// TypeScript errors after site migration - ignoring for game functionality
import BasicHero from "./basicHero";
import type { GameContext } from "../context";
import Hammer from "../items/hammer";

export default class Cleric extends BasicHero {

  constructor(context : GameContext, x: number, y: number) {
    super(context)

    this.name = "Cleric"
    this.talentClass = "Cleric"
    this.description =
      "A holy healer. Passive (Divine Mending): heal 1 HP each turn."
    this.healthPoints = 40
    this.maxHealthPoints = 40
    this.tile = 2 * 49 + 24;

    const hammer = new Hammer(context)
    this.addItem(hammer)
    this.equipItem(hammer)

    this.resistance = { magic: 1 };

    this.init(context, x, y)
  }

  // Passive: Divine Mending — heal 1 HP each turn (+1 per talent rank).
  refresh() {
    super.refresh()

    if (this.healthPoints < this.maxHealthPoints) {
      this.healthPoints = Math.min(this.maxHealthPoints,
        this.healthPoints + 1 + this.talentRank("mending"))
      // Passive healing updates the health display without log chatter.
    }
  }
}
