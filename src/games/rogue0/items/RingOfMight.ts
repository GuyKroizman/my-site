import Ring from "./ring";
import type { GameContext } from "../context";

export default class RingOfMight extends Ring {
  // Save the installed bonus, not just the level: older saves granted damage
  // and have no Strength bonus to subtract when passives are reconciled.
  private appliedStrength = 0;

  constructor(context: GameContext, x?: number, y?: number) {
    super(
      context,
      {
        name: "Ring of Might",
        description: "Grants +1 Strength while equipped.",
      },
      x,
      y
    );
  }

  applyPassive() {
    const player = this.context.player;
    if (!player) return;
    this.appliedStrength = this.curseSign * (1 + this.level);
    player.strength += this.appliedStrength;
  }

  removePassive() {
    const player = this.context.player;
    if (player) player.strength -= this.appliedStrength ?? 0;
    this.appliedStrength = 0;
  }

  get baseDescription(): string {
    const amount = 1 + this.level;
    return this.cursed
      ? `Reduces Strength by ${amount} while equipped.`
      : `Grants +${amount} Strength while equipped.`;
  }
}
