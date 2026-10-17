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

  applyPassive() {
    const player = this.context.player;
    if (!player) return;

    player.resistance.fire = (player.resistance.fire ?? 0) + ELEMENTAL_RESISTANCE;
    player.resistance.ice = (player.resistance.ice ?? 0) + ELEMENTAL_RESISTANCE;
    player.resistance.shock = (player.resistance.shock ?? 0) + ELEMENTAL_RESISTANCE;
  }

  removePassive() {
    const player = this.context.player;
    if (!player) return;

    player.resistance.fire = Math.max(0, (player.resistance.fire ?? 0) - ELEMENTAL_RESISTANCE);
    player.resistance.ice = Math.max(0, (player.resistance.ice ?? 0) - ELEMENTAL_RESISTANCE);
    player.resistance.shock = Math.max(0, (player.resistance.shock ?? 0) - ELEMENTAL_RESISTANCE);
  }
}
