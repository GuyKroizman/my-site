import { Entity } from "../entity";
import type { GameContext } from "../context";

export default class Gold extends Entity {
  type = "item" as const;
  textureKey = "gold-pile";

  constructor(context: GameContext, x: number | undefined, y: number | undefined, amount: number) {
    super();
    this.goldAmount = amount;
    this.name = `${amount} gold`;
    this.description = "A pile of gold coins. Pick it up to add it to your gold balance; no backpack space needed.";
    this.init(context, x, y);
  }

  equip() {}
  refresh() {}
  turn() {}
  isOver() { return true; }
  attack() { return 0; }
  protection() { return 0; }
  range() { return 0; }
  damage() { return 0; }
  onDestroy() {}
}
