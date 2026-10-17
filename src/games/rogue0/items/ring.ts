// Shared base for the Phase 6 rings.
//
// Rings are passive equipment: they reveal themselves on equip and apply a
// passive modifier through `applyPassive()` until they are unequipped.
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity, identify } from "../entity";

export type RingConfig = {
  name: string;
  description: string;
  tile: number;
};

export default abstract class Ring extends Entity {
  type: EntityType = "item";
  tier = 1;
  equipSlot: "ring" = "ring";
  identified = false;

  private passiveApplied = false;

  constructor(context: GameContext, config: RingConfig, x?: number, y?: number) {
    super();
    this.name = config.name;
    this.description = config.description;
    this.tile = config.tile;

    this.init(context, x, y);
  }

  abstract applyPassive(): void;
  abstract removePassive(): void;

  equip() {
    identify(this);
    if (this.passiveApplied) return;
    this.applyPassive();
    this.passiveApplied = true;
  }

  unequip() {
    if (!this.passiveApplied) return;
    this.removePassive();
    this.passiveApplied = false;
  }

  attack() {
    return 0;
  }

  damage() {
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
