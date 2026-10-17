import Ring from "./ring";
import type { GameContext } from "../context";

const EVASION_BONUS = 5;

export default class RingOfEvasion extends Ring {
  constructor(context: GameContext, x?: number, y?: number) {
    super(
      context,
      {
        name: "Ring of Evasion",
        description: `Grants +${EVASION_BONUS} evasion while equipped.`,
        tile: 4 * 49 + 25
      },
      x,
      y
    );
  }

  applyPassive() {
    const player = this.context.player;
    if (player) player.evasion += EVASION_BONUS;
  }

  removePassive() {
    const player = this.context.player;
    if (player) player.evasion -= EVASION_BONUS;
  }
}
