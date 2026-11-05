// TypeScript errors after site migration - ignoring for game functionality
import BasicHero from "./basicHero";
import type { GameContext } from "../context";
import Sword from "../items/sword";

export default class Warrior extends BasicHero {

  constructor(context : GameContext, x: number, y: number) {
    super(context)

    this.name = "Warrior"
    this.talentClass = "Warrior"
    this.description =
      "A battle-hardened fighter. Passive (Blood Fury): +2 damage while below half health."
    this.maxHealthPoints = 30

    const sword = new Sword(context)
    this.addItem(sword)
    this.equipItem(sword)

    this.resistance = { physical: 1 };

    this.init(context, x, y)
  }

  // Passive: Blood Fury — +2 damage while below 50% HP.
  attack() {
    let total = super.attack()
    if (this.healthPoints <= this.maxHealthPoints / 2) {
      total += 2 + this.talentRank("fury")
    }
    return total
  }
}
