// TypeScript errors after site migration - ignoring for game functionality
import BasicHero from "./basicHero";
import type { GameContext } from "../context";
import Hammer from "../items/hammer";
import dungeon from "../dungeon";

export default class Cleric extends BasicHero {

  constructor(context : GameContext, x: number, y: number) {
    super(context)

    this.name = "Cleric"
    this.talentClass = "Cleric"
    this.description =
      "A holy healer. Passive (Divine Mending): heal 1 HP each turn. Active (Heal, f): restore 5 HP to yourself."
    this.healthPoints = 40
    this.maxHealthPoints = 40
    this.tile = 2 * 49 + 24;

    this.skill = "Heal"
    this.skillDescription = "Restore 5 HP to yourself."
    this.skillMaxCooldown = 6

    const hammer = new Hammer(context)
    this.addItem(hammer)
    this.equipItem(hammer)

    this.resistance = { magic: 1 };

    this.init(context, x, y)
  }

  refresh() {
    super.refresh()

    // Passive: Divine Mending — heal 1 HP each turn.
    if (this.healthPoints < this.maxHealthPoints) {
      this.healthPoints += 1
      // Passive healing updates the health display without log chatter.
    }
  }

  // Active: Heal — restore 5 HP.
  useSkill() {
    if (this.healthPoints >= this.maxHealthPoints) {
      dungeon.log(this.context, "You are already at full health.")
      return
    }

    const healed = Math.min(5 + 3 * this.talentRank("heal"), this.maxHealthPoints - this.healthPoints)
    this.healthPoints += healed
    dungeon.log(this.context, `You heal ${healed} HP.`)
    this.spendTurn()
    this.skillCooldown = this.skillMaxCooldown - this.talentRank("prayer")
  }
}
