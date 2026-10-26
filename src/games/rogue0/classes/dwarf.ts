// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import Axe from "../items/axe";
import Shield from "../items/shield";
import BasicHero from "./basicHero";
import dungeon from "../dungeon";
import { createCrippledEffect } from "../effects";

export default class Dwarf extends BasicHero {
  constructor(context: GameContext, x: number, y: number) {
    super(context);

    this.name = "Dwarf";
    this.talentClass = "Dwarf";
    this.description =
      "A stout defender. Passive (Dwarven Armor): +1 armor and physical resistance. Active (Shield Bash, f): bash an adjacent enemy and cripple it.";
    this.healthPoints = 35;
    this.maxHealthPoints = 35;
    this.tile = 9 * 49 + 29;

    this.skill = "Shield Bash";
    this.skillDescription = "Bash an adjacent enemy and cripple it.";
    this.skillMaxCooldown = 4;

    const axe = new Axe(context);
    const shield = new Shield(context);
    this.addItem(axe);
    this.addItem(shield);
    this.equipItem(axe);
    this.equipItem(shield);

    this.resistance = { physical: 1 };

    this.init(context, x, y);
  }

  // Passive: Dwarven Armor — +1 armor (stacks with the equipped shield).
  protection() {
    return super.protection() + 1 + this.talentRank("armor");
  }

  // Active: Shield Bash — attack an adjacent enemy and cripple it.
  useSkill() {
    const enemy = this.adjacentEnemy();
    if (!enemy) {
      dungeon.log(this.context, "Shield Bash needs an adjacent enemy.");
      return;
    }

    dungeon.log(this.context, `You slam ${enemy.name} with a Shield Bash!`);
    this.resolveSkillAttack(enemy, {
      bonusDamage: 1,
      onHitEffects: [createCrippledEffect(3 + this.talentRank("bash"))]
    });
    this.spendTurn("attack");
    this.skillCooldown = this.skillMaxCooldown;
  }
}
