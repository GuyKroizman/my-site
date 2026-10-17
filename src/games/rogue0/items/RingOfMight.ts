import Ring from "./ring";
import type { GameContext } from "../context";

export default class RingOfMight extends Ring {
  constructor(context: GameContext, x?: number, y?: number) {
    super(
      context,
      {
        name: "Ring of Might",
        description: "Grants +2 damage while equipped.",
        tile: 4 * 49 + 28
      },
      x,
      y
    );
  }

  applyPassive() {
  }

  removePassive() {
  }

  damage() {
    return 2 + this.level;
  }
}
