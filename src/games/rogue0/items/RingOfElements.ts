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
    return `Resists fire, ice and shock (${ELEMENTAL_RESISTANCE + this.level} each) while equipped. Each upgrade adds +1 resistance to each element.`;
  }

  applyPassive() {
    const player = this.context.player;
    if (!player) return;

    const bonus = ELEMENTAL_RESISTANCE + this.level;
    player.resistance.fire = (player.resistance.fire ?? 0) + bonus;
    player.resistance.ice = (player.resistance.ice ?? 0) + bonus;
    player.resistance.shock = (player.resistance.shock ?? 0) + bonus;
  }

  removePassive() {
    const player = this.context.player;
    if (!player) return;

    const bonus = ELEMENTAL_RESISTANCE + (this.passiveLevel ?? 0);
    player.resistance.fire = Math.max(0, (player.resistance.fire ?? 0) - bonus);
    player.resistance.ice = Math.max(0, (player.resistance.ice ?? 0) - bonus);
    player.resistance.shock = Math.max(0, (player.resistance.shock ?? 0) - bonus);
  }
}
