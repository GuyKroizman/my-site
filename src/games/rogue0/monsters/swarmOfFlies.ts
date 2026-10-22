import Monster from "./monster";
import type { GameContext } from "../context";
import dungeon from "../dungeon";

export default class SwarmOfFlies extends Monster {
  private offspring = false;

  constructor(context: GameContext, x?: number, y?: number, offspring = false) {
    super(context, {
      name: "Swarm of Flies",
      description: "A buzzing cloud that splits apart when swatted.",
      tile: 6 * 49 + 31,
      healthPoints: offspring ? 4 : 8,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 6,
      attackDamage: 1,
      protection: 0,
      xp: offspring ? 2 : 5,
      range: 0,
      scale: offspring ? 0.7 : 1,
      loot: []
    }, x, y);

    this.offspring = offspring;
  }

  onDestroy() {
    super.onDestroy();

    if (this.offspring || this.x === undefined || this.y === undefined) {
      return;
    }

    for (let i = 0; i < 2; i++) {
      this.context.entities.push(
        new SwarmOfFlies(this.context, this.x, this.y, true)
      );
    }

    dungeon.log(this.context, `${this.name} splits into two smaller swarms.`);
  }
}
