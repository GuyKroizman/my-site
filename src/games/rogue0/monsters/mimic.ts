import Monster from "./monster";
import type { GameContext } from "../context";
import Gem from "../items/gem";
import type { Entity } from '../entity';

export default class Mimic extends Monster {
  private provoked = false;

  turn(): void {
    if (!this.provoked) {
      this.awareOfPlayer = false;
      this.spendTime('wait');
      return;
    }
    super.turn();
  }

  onAttacked(attacker: Entity): void {
    this.provoked = true;
    this.wakeUp();
    if (attacker.x !== undefined && attacker.y !== undefined) {
      this.lastSeenX = attacker.x;
      this.lastSeenY = attacker.y;
    }
  }

  takeDamage(amount: number, interruptNavigation = true): void {
    super.takeDamage(amount, interruptNavigation);
    if (amount > 0) this.provoked = true;
  }

  restoreLegacyStrength(floor: number): void {
    if (this.maxHealthPoints !== 4) return;
    const tier = Math.max(1, Math.min(5, Math.ceil(floor / 5)));
    this.maxHealthPoints = 12 + tier * 4;
    if (this.healthPoints > 0) this.healthPoints += this.maxHealthPoints - 4;
    this.attackDamage = 5 + tier * 2;
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
      tile: 6 * 49 + 8, // Closed wooden chest (row 6, column 8).
      healthPoints: 12 + tier * 4,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 6,
      attackDamage: 5 + tier * 2,
      protection: 1 + Math.floor(tier / 2),
      xp: 8 + tier * 4,
      range: 0,
      loot: [Gem, Gem]
    }, x, y);
  }
}
