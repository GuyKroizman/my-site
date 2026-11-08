import Monster from "./monster";
import type { GameContext } from "../context";
import { announceDeath } from "../combatFeedback";
import { DEADLY_FROG_TEXTURE, generateDeadlyFrogTexture } from "./deadlyFrogTexture";

// A poison-frog encounter: every wound it survives vents a toxic cloud, and its
// death releases one more. The gas itself cannot poison the frog.
export default class DeadlyFrog extends Monster {
  constructor(context: GameContext, x?: number, y?: number) {
    if (context.scene) generateDeadlyFrogTexture(context.scene);
    super(context, {
      name: "Deadly Frog",
      description: "A bloated frog with poison warts. Each wound it survives vents toxic gas, and its death releases a final cloud. Poison cannot harm it.",
      tile: 0,
      textureKey: DEADLY_FROG_TEXTURE,
      healthPoints: 14,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 6,
      attackDamage: 3,
      protection: 0,
      xp: 6,
      range: 0,
      poisonImmune: true
    }, x, y);
  }

  // Covers every damage source, including wands (which skip `onHitBy`). A
  // lethal blow is handled by the death cloud instead, so one hit never vents
  // two clouds.
  takeDamage(amount: number, interruptNavigation = true): void {
    const wasAlive = this.healthPoints > 0;
    super.takeDamage(amount, interruptNavigation);
    if (amount > 0 && wasAlive && this.healthPoints > 0) this.releaseGas();
  }

  onDestroy(): void {
    this.releaseGas();
    announceDeath(this.context, this, `${this.name} bursts in a cloud of poison gas!`);
    super.onDestroy();
  }

  private releaseGas(): void {
    if (this.x === undefined || this.y === undefined) return;
    this.context.onCreatePoisonGas?.(this.x, this.y);
  }
}
