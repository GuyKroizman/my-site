import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, identify } from "../entity";
import dungeon from "../dungeon";

const STRIKES_TO_LEVEL = 8;

export default class FangOfTheBeast extends Entity {
  name: string = "Fang of the Beast";
  description: string =
    "A fang that hungers for battle. Grants bonus damage that grows as you fight.";
  type: EntityType = "item";
  textureKey = "fang-of-the-beast";
  tier = 1;
  equipSlot: "artifact" = "artifact";
  identified = false;

  private strikes = 0;

  get unidentifiedTextureKey(): string {
    return this.spriteTextureKey;
  }

  constructor(context: GameContext, x?: number, y?: number) {
    super();
    this.init(context, x, y);
  }

  equip() {
    identify(this);
  }

  get displayDescription(): string {
    return `A fang that hungers for battle. Grants +${2 + this.level} damage while equipped. Grows stronger every ${STRIKES_TO_LEVEL} strikes (${this.strikes}/${STRIKES_TO_LEVEL}).`;
  }

  damage() {
    // Each successful attack with this equipped counts as "use" and slowly
    // levels the artifact up.
    this.strikes += 1;
    if (this.strikes >= STRIKES_TO_LEVEL) {
      this.strikes = 0;
      this.level += 1;
      dungeon.log(
        this.context,
        `${this.name} grows stronger (level ${this.level}).`
      );
    }

    return 2 + this.level;
  }

  attack() {
    return 0;
  }

  protection() {
    return 0;
  }

  range() {
    return 0;
  }

  turn() {
  }

  refresh() {
  }

  isOver() {
    return true;
  }

  onDestroy() {
  }
}
