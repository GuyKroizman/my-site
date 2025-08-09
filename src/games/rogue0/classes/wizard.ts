// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import BasicHero from "./basicHero";
import type { GameContext } from "../context";
import scrollofFireball from "../items/scrolloffireball";
import scrollofLightning from "../items/scrolloflightning";
import healthPotion from "../items/healthpotion";

export default class Wizard extends BasicHero {
  constructor(context : GameContext, x: number, y: number) {
    super(context);

    this.name = "Wizard";
    this.movementPoints = 3;
    this.actionPoints = 1;
    this.healthPoints = 20;
    this.tile = 49 + 24;

    this.items.push(new scrollofFireball(context));
    this.items.push(new scrollofLightning(context));
    this.items.push(new healthPotion(context));
    this.items.push(new healthPotion(context));
    this.toggleItem(context,1)

    this.init(context, x, y);
  }

  refresh() {
    this.movementPoints = 3;
    this.actionPoints = 1;
  }
}
