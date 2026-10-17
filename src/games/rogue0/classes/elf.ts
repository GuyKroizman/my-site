// TypeScript errors after site migration - ignoring for game functionality
import BasicHero from "./basicHero";
import type { GameContext } from "../context";
import Bow from "../items/bow";

export default class Elf extends BasicHero {
  constructor(context : GameContext, x: number, y: number) {
    super(context);

    this.name = "Elf";
    this.movementPoints = 4;
    this.actionPoints = 3;
    this.healthPoints = 20;
    this.maxHealthPoints = 20;
    this.tile = 49 + 28;

    this.addItem(new Bow(context));

    this.evasion = 10;

    this.init(context, x, y);
  }

  refresh() {
    this.movementPoints = 4;
    this.actionPoints = 3;
  }
}
