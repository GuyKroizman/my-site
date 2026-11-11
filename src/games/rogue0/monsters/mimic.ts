import Monster from "./monster";
import type { GameContext } from "../context";
import Gem from "../items/gem";
import type { Entity } from '../entity';
import { CHEST_TEXTURE, MIMIC_TEXTURE } from '../chestTextures';
import { Sheet } from '../spriteFrames.ts';

export default class Mimic extends Monster {
  private provoked = false;

  // A dormant mimic is drawn with the exact chest texture, so the disguise is
  // visual as well as behavioural. Provoking it swaps in the open-jawed art.
  get spriteTextureKey(): string {
    return this.provoked ? MIMIC_TEXTURE : CHEST_TEXTURE;
  }

  private provoke(): void {
    if (this.provoked) return;
    this.provoked = true;
    this.sprite?.setTexture(MIMIC_TEXTURE);
  }

  turn(): void {
    if (!this.provoked) {
      this.awareOfPlayer = false;
      this.spendTime('wait');
      return;
    }
    super.turn();
  }

  onAttacked(attacker: Entity): void {
    this.provoke();
    this.wakeUp();
    if (attacker.x !== undefined && attacker.y !== undefined) {
      this.lastSeenX = attacker.x;
      this.lastSeenY = attacker.y;
    }
  }

  takeDamage(amount: number, interruptNavigation = true): void {
    super.takeDamage(amount, interruptNavigation);
    if (amount > 0) this.provoke();
  }

  restoreLegacyStrength(floor: number): void {
    if (this.maxHealthPoints !== 4) return;
    const tier = Math.max(1, Math.min(5, Math.ceil(floor / 5)));
    this.maxHealthPoints = 24 + tier * 8;
    if (this.healthPoints > 0) this.healthPoints += this.maxHealthPoints - 4;
    this.attackDamage = 10 + tier * 4;
    this.protectionValue = 1 + Math.floor(tier / 2);
    this.visionRadius = 6;
    this.xpValue = 8 + tier * 4;
  }

  constructor(context: GameContext, x?: number, y?: number) {
    const tier = Math.max(1, Math.min(5, Math.ceil((context.floor ?? 1) / 5)));
    super(context, {
      name: "Mimic",
      description: "A motionless treasure chest. It awakens and attacks only after being attacked or taking damage.",
      initiallyAwake: true, // Dormancy is not timed sleep and has no sleeping Zs.
      tile: Sheet.chest, // Legacy chest frame, still saved with old runs.
      textureKey: CHEST_TEXTURE, // Disguised as the generated chest art.
      healthPoints: 24 + tier * 8,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 6,
      attackDamage: 10 + tier * 4,
      protection: 1 + Math.floor(tier / 2),
      xp: 8 + tier * 4,
      range: 0,
      // A mimic is a treasure, but a coin-flip gem from the one mimic per
      // floor was the single biggest gem source. Keep it a bonus, not a
      // guaranteed upgrade every floor.
      loot: [false, Gem]
    }, x, y);
  }
}
