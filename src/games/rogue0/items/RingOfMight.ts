import Ring from "./ring";
import type { GameContext } from "../context";
import { Sheet } from '../spriteFrames.ts';

export default class RingOfMight extends Ring {
  constructor(context: GameContext, x?: number, y?: number) {
    super(
      context,
      {
        name: "Ring of Might",
        description: "Grants +2 damage while equipped.",
        tile: Sheet.ringOfMight
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
      ? `Reduces damage by ${amount} while equipped.`
      : `Grants +${amount} damage while equipped.`;
  }

  damage() {
    return (this.cursed ? -1 : 1) * (2 + this.level);
  }
}
