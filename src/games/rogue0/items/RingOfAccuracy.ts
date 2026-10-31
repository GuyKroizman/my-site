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

  get baseDescription(): string {
    return `Grants +${ACCURACY_BONUS * (1 + this.level)} accuracy while equipped. Each upgrade adds +5 accuracy.`;
  }

  private changeAccuracy(amount: number): void {
    const player = this.context.player;
    if (!player) return;
    const blindness = player.effects.find(effect => effect.id === 'blinded');
    if (blindness?.originalAccuracy !== undefined) {
      blindness.originalAccuracy += amount;
      player.accuracy = Math.max(0, blindness.originalAccuracy - 25);
    } else player.accuracy += amount;
  }

  applyPassive() {
    this.changeAccuracy(ACCURACY_BONUS * (1 + this.level));
  }

  removePassive() {
    this.changeAccuracy(-ACCURACY_BONUS * (1 + (this.passiveLevel ?? 0)));
  }
}
