// TypeScript errors after site migration - ignoring for game functionality
import BasicHero from "./basicHero";
import type { GameContext } from "../context";
import Sword from "../items/sword";
import dungeon from "../dungeon";

export default class Warrior extends BasicHero {

  constructor(context : GameContext, x: number, y: number) {
    super(context)

    this.name = "Warrior"
    this.description =
      "A battle-hardened fighter. Passive (Blood Fury): +2 damage while below half health. Active (Power Strike, f): strike an adjacent enemy for +3 damage."
    this.movementPoints = 3
    this.actionPoints = 2
    this.maxHealthPoints = 30

    this.skill = "Power Strike"
    this.skillDescription = "Strike an adjacent enemy for +3 damage."
    this.skillMaxCooldown = 5

    this.addItem(new Sword(context))

    this.resistance = { physical: 1 };

    this.init(context, x, y)
  }

  refresh() {
    super.refresh()
    this.movementPoints = 3
    this.actionPoints = 2
  }

  // Passive: Blood Fury — +2 damage while below 50% HP.
  attack() {
    let total = super.attack()
    if (this.healthPoints <= this.maxHealthPoints / 2) {
      total += 2
    }
    return total
  }

  // Active: Power Strike — melee attack on an adjacent enemy with +3 damage.
  useSkill() {
    const enemy = this.adjacentEnemy()
    if (!enemy) {
      dungeon.log(this.context, "Power Strike needs an adjacent enemy.")
      return
    }

    dungeon.log(this.context, `${this.name} unleashes Power Strike!`)
    this.resolveSkillAttack(enemy, { bonusDamage: 3 })
    this.actionPoints -= 1
    this.skillCooldown = this.skillMaxCooldown
  }
}
