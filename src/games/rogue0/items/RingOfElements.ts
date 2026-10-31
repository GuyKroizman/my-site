import Ring from "./ring";
import type { GameContext } from "../context";

const ELEMENTAL_RESISTANCE = 2;

export default class RingOfElements extends Ring {
  constructor(context: GameContext, x?: number, y?: number) {
    super(
      context,
      {
        name: "Ring of Elements",
        description: `Resists fire, ice and shock (${ELEMENTAL_RESISTANCE} each) while equipped.`,
        tile: 4 * 49 + 26
      },
      x,
      y
    );
  }

  get baseDescription(): string {
    const amount = ELEMENTAL_RESISTANCE + this.level;
    return this.cursed
      ? `Makes you vulnerable to fire, ice and shock (${amount} each) while equipped. Each upgrade worsens it by 1.`
      : `Resists fire, ice and shock (${amount} each) while equipped. Each upgrade adds +1 resistance to each element.`;
  }

  applyPassive() {
    const sign = this.passiveSign = this.curseSign;
    const player = this.context.player;
    if (!player) return;

    const bonus = ELEMENTAL_RESISTANCE + this.level;
    for (const type of ['fire', 'ice', 'shock'] as const) {
      if (sign < 0) player.vulnerability[type] = (player.vulnerability[type] ?? 0) + bonus;
      else player.resistance[type] = (player.resistance[type] ?? 0) + bonus;
    }
  }

  removePassive() {
    const player = this.context.player;
    if (!player) return;

    const bonus = ELEMENTAL_RESISTANCE + (this.passiveLevel ?? 0);
    const sign = this.passiveSign;
    for (const type of ['fire', 'ice', 'shock'] as const) {
      if (sign < 0) player.vulnerability[type] = Math.max(0, (player.vulnerability[type] ?? 0) - bonus);
      else player.resistance[type] = Math.max(0, (player.resistance[type] ?? 0) - bonus);
    }
  }
}
