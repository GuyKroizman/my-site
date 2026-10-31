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
  protected locallyIdentified = false;
  // Use the same ring artwork on the floor and after identification as in
  // the unidentified inventory slot; the configured tiles are character art.
  textureKey = "unknown-ring";

  private passiveApplied = false;
  // Record the bonus actually applied, so upgrading/removing never subtracts
  // the new level's bonus from stats that still contain the old level's bonus.
  // Missing in legacy saves, whose non-Might rings always used level-zero stats.
  protected passiveLevel: number | undefined = 0;
  // A cursed ring inverts its passive. Capture the sign at apply time so
  // Remove Curse (which flips `cursed` before `onUncursed`) can still undo
  // exactly what was installed.
  protected get curseSign(): number { return this.cursed ? -1 : 1; }
  protected passiveSign = 1;

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
    this.passiveLevel = this.level;
    this.applyPassive();
    this.passiveApplied = true;
  }

  unequip() {
    if (!this.passiveApplied) return;
    this.removePassive();
    this.passiveApplied = false;
  }

  onUpgrade(): void {
    if (!this.passiveApplied) return;
    this.removePassive();
    this.passiveLevel = this.level;
    this.applyPassive();
  }

  // Removing the curse flips the passive's sign while it stays equipped.
  onUncursed(): void {
    if (!this.passiveApplied) return;
    this.removePassive();
    this.passiveLevel = this.level;
    this.applyPassive();
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
