import Ring from "./ring";
import type { GameContext } from "../context";

const ACCURACY_BONUS = 5;

export default class RingOfAccuracy extends Ring {
  constructor(context: GameContext, x?: number, y?: number) {
    super(
      context,
      {
        name: "Ring of Accuracy",
        description: `Grants +${ACCURACY_BONUS} accuracy while equipped.`,
        tile: 4 * 49 + 24
      },
      x,
      y
    );
  }

  applyPassive() {
    const player = this.context.player;
    if (player) player.accuracy += ACCURACY_BONUS;
  }

  removePassive() {
    const player = this.context.player;
    if (player) player.accuracy -= ACCURACY_BONUS;
  }
}
