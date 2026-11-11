// Shared base for the Phase 6 rings.
//
// Rings are passive equipment: equipping reveals only whether they are cursed.
// Their type and upgrade level stay hidden until a Scroll of Identify or
// extended wear identifies them; the passive applies while unidentified.
import type { GameContext } from "../context";
import type { EntityType } from "../entity";
import { Entity } from "../entity";

export type RingConfig = {
  name: string;
  description: string;
};

export default abstract class Ring extends Entity {
  type: EntityType = "item";
  tier = 1;
  equipSlot: "ring" = "ring";
  protected locallyIdentified = false;
  // Rings draw the shared gold-ring marker; the gem colour is assigned per run
  // by the appearance map (entity.ts / ringTextures.ts), like potion colours.
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

    this.init(context, x, y);
  }

  abstract applyPassive(): void;
  abstract removePassive(): void;

  equip() {
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
    const player = this.context?.player;
    if (player && (player.ring1 === this || player.ring2 === this)) {
      this.learnEquipmentFromUse?.();
    }
  }

  isOver() {
    return true;
  }

  onDestroy() {
  }
}
