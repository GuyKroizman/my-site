// TypeScript errors after site migration - ignoring for game functionality
import BasicHero from "./basicHero";
import type { GameContext } from "../context";
import Bow from "../items/bow";
import dungeon from "../dungeon";

export default class Elf extends BasicHero {
  constructor(context : GameContext, x: number, y: number) {
    super(context);

    this.name = "Elf";
    this.description =
      "A swift archer. Passive (Elven Grace): +10 evasion. Active (Multishot, f): fire two arrows at the nearest visible enemy within range.";
    this.movementPoints = 4;
    this.actionPoints = 3;
    this.healthPoints = 20;
    this.maxHealthPoints = 20;
    this.tile = 49 + 28;

    this.skill = "Multishot";
    this.skillDescription = "Fire two arrows at the nearest visible enemy within range.";
    this.skillMaxCooldown = 6;

    this.addItem(new Bow(context));

    this.evasion = 10;

    this.init(context, x, y);
  }

  refresh() {
    super.refresh();
    this.movementPoints = 4;
    this.actionPoints = 3;
  }

  // Active: Multishot — two arrows at the nearest visible enemy in bow range.
  useSkill() {
    const range = this.currentWeapon()?.range() ?? 5;
    const enemy = this.nearestVisibleEnemy(range);
    if (!enemy) {
      dungeon.log(this.context, "No visible enemy in range for Multishot.");
      return;
    }

    dungeon.log(this.context, `${this.name} fires a Multishot at ${enemy.name}!`);
    this.resolveSkillAttack(enemy, {});
    if (enemy.healthPoints > 0) {
      this.resolveSkillAttack(enemy, {});
    }
    this.actionPoints -= 1;
    this.skillCooldown = this.skillMaxCooldown;
  }
}
