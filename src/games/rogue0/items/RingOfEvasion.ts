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
      },
      x,
      y
    );
  }

  get baseDescription(): string {
    const amount = EVASION_BONUS * (1 + this.level);
    return this.cursed
      ? `Reduces evasion by ${amount} while equipped.`
      : `Grants +${amount} evasion while equipped.`;
  }

  applyPassive() {
    this.passiveSign = this.curseSign;
    const player = this.context.player;
    if (player) player.evasion += this.passiveSign * EVASION_BONUS * (1 + this.level);
  }

  removePassive() {
    const player = this.context.player;
    if (player) player.evasion -= this.passiveSign * EVASION_BONUS * (1 + (this.passiveLevel ?? 0));
  }
}
