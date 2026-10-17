// TypeScript errors after site migration - ignoring for game functionality
import type { GameContext } from "../context";
import Axe from "../items/axe";
import Shield from "../items/shield";
import BasicHero from "./basicHero";

export default class Dwarf extends BasicHero {
  constructor(context: GameContext, x: number, y: number) {
    super(context);

    this.name = "Dwarf";
    this.movementPoints = 2;
    this.actionPoints = 2;
    this.healthPoints = 35;
    this.maxHealthPoints = 35;
    this.tile = 9 * 49 + 29;

    this.addItem(new Axe(context));
    this.addItem(new Shield(context));

    this.resistance = { physical: 1 };

    this.init(context, x, y);
  }

  refresh() {
    this.movementPoints = 2;
    this.actionPoints = 2;
  }
}
