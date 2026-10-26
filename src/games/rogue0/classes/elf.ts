// TypeScript errors after site migration - ignoring for game functionality
import BasicHero from "./basicHero";
import type { GameContext } from "../context";
import Sword from "../items/sword";
import dungeon from "../dungeon";

export default class Elf extends BasicHero {
  constructor(context : GameContext, x: number, y: number) {
    super(context);

    this.name = "Elf";
    this.talentClass = "Elf";
    this.description =
      "A swift swordsman. Passive (Elven Grace): +10 evasion. Active (Double Strike, f): strike the nearest visible adjacent enemy twice.";
    this.healthPoints = 20;
    this.maxHealthPoints = 20;
    this.tile = 49 + 28;

    this.skill = "Double Strike";
    this.skillDescription = "Strike the nearest visible adjacent enemy twice.";
    this.skillMaxCooldown = 6;

    const sword = new Sword(context);
    this.addItem(sword);
    this.equipItem(sword);

    this.evasion = 10;

    this.init(context, x, y);
  }

  // Active: Double Strike is always melee, including while unarmed.
  useSkill() {
    const enemy = this.nearestVisibleEnemy(1);
    if (!enemy) {
      dungeon.log(this.context, "No visible adjacent enemy for Double Strike.");
      return;
    }

    dungeon.log(this.context, `You use Double Strike on ${enemy.name}!`);
    this.resolveSkillAttack(enemy, { bonusDamage: this.talentRank("strike") });
    if (enemy.healthPoints > 0) {
      this.resolveSkillAttack(enemy, { bonusDamage: this.talentRank("strike") });
    }
    this.spendTurn("attack");
    this.skillCooldown = this.skillMaxCooldown;
  }
}
