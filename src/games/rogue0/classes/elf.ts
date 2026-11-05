// TypeScript errors after site migration - ignoring for game functionality
import BasicHero from "./basicHero";
import type { GameContext } from "../context";
import Sword from "../items/sword";

export default class Elf extends BasicHero {
  constructor(context : GameContext, x: number, y: number) {
    super(context);

    this.name = "Elf";
    this.talentClass = "Elf";
    this.description =
      "A swift swordsman. Passive (Elven Grace): +10 evasion.";
    this.healthPoints = 20;
    this.maxHealthPoints = 20;
    this.tile = 49 + 28;

    const sword = new Sword(context);
    this.addItem(sword);
    this.equipItem(sword);

    this.evasion = 10;

    this.init(context, x, y);
  }
}
