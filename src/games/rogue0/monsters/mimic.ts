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

  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Mimic",
      description: "A motionless treasure chest. It awakens and attacks only after being attacked or taking damage.",
      initiallyAwake: true, // Dormancy is not timed sleep and has no sleeping Zs.
      tile: 6 * 49 + 8, // Closed wooden chest (row 6, column 8).
      healthPoints: 4,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 2,
      attackDamage: 6,
      protection: 0,
      xp: 8,
      range: 0,
      loot: [Gem, Gem]
    }, x, y);
  }
}
