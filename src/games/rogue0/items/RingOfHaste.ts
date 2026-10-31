import Ring from "./ring";
import type { GameContext } from "../context";

export default class RingOfHaste extends Ring {
  constructor(context: GameContext, x?: number, y?: number) {
    super(
      context,
      {
        name: "Ring of Haste",
        description: "Doubles movement speed while equipped. Does not speed up attacks.",
        tile: 4 * 49 + 27
      },
      x,
      y
    );
  }

  get speedMultiplier(): number { return 2 + this.level * 0.5; }

  get baseDescription(): string {
    return this.cursed
      ? `Divides movement speed by ${this.speedMultiplier} while equipped. Each upgrade worsens the slow. Does not affect attacks. Stacks with another ring and temporary Haste.`
      : `Multiplies movement speed by ${this.speedMultiplier} while equipped. Each upgrade adds 0.5 to this multiplier. Does not speed up attacks. Stacks with another ring and temporary Haste.`;
  }

  applyPassive() {
    this.passiveSign = this.curseSign;
    const player = this.context.player;
    if (!player) return;
    const m = this.speedMultiplier;
    player.movementSpeed *= this.passiveSign < 0 ? 1 / m : m;
  }

  removePassive() {
    const player = this.context.player;
    if (!player) return;
    if (this.passiveLevel === undefined) {
      // Old rings installed a permanent shared Haste effect instead of a
      // per-ring speed multiplier. Do not remove an unrelated timed buff.
      player.effects = player.effects.filter(effect => effect.id !== 'haste' || Number.isFinite(effect.duration));
      return;
    }
    const m = 2 + this.passiveLevel * 0.5;
    player.movementSpeed /= this.passiveSign < 0 ? 1 / m : m;
  }
}
