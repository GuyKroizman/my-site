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

  get baseDescription(): string {
    const amount = EVASION_BONUS * (1 + this.level);
    return this.cursed
      ? `Reduces evasion by ${amount} while equipped. Each upgrade worsens it by 5.`
      : `Grants +${amount} evasion while equipped. Each upgrade adds +5 evasion.`;
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
