// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import Axe from "../items/axe";
import Shield from "../items/shield";
import BasicHero from "./basicHero";

export default class Dwarf extends BasicHero {
  constructor(context: GameContext, x: number, y: number) {
    super(context);

    this.name = "Dwarf";
    this.talentClass = "Dwarf";
    this.description =
      "A stout defender. Passive (Dwarven Armor): +1 armor and physical resistance.";
    this.healthPoints = 35;
    this.maxHealthPoints = 35;

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
}
