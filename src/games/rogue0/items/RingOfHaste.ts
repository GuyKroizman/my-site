import Ring from "./ring";
import type { GameContext } from "../context";
import { applyEffect, createHasteEffect, removeEffect } from "../effects";

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

  applyPassive() {
    const player = this.context.player;
    if (!player) return;

    const haste = createHasteEffect(Number.POSITIVE_INFINITY);
    haste.manualExpiry = true;
    applyEffect(player, haste);
  }

  removePassive() {
    const player = this.context.player;
    if (player) removeEffect(player, "haste");
  }
}
