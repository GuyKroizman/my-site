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

  get baseDescription(): string {
    const amount = 2 + this.level;
    return this.cursed
      ? `Reduces damage by ${amount} while equipped. Each upgrade worsens it by 1.`
      : `Grants +${amount} damage while equipped.`;
  }

  damage() {
    return (this.cursed ? -1 : 1) * (2 + this.level);
  }
}
