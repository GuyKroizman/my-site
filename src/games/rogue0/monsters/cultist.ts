import Monster from "./monster";
import type { GameContext } from "../context";
import dungeon from "../dungeon";
import Skeleton from "./skelaton";
import Gem from "../items/gem";

export default class Cultist extends Monster {
  private summonCooldown = 0;

  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: "Cultist",
      description: "A robed cultist who raises skeletons to fight for it.",
      tile: 2 * 49 + 24, // Hooded caster with a staff (row 2, column 24).
      healthPoints: 8,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 7,
      attackDamage: 2,
      protection: 0,
      xp: 8,
      range: 0,
      loot: [false, false, Gem]
    }, x, y);
  }

  turn() {
    if (this.waitWhileSleeping()) return;
    if (this.summonCooldown > 0) {
      this.summonCooldown -= 1;
    }

    if (this.summonCooldown === 0 && !this.hasFriendlySkeleton()) {
      const spot = this.findAdjacentSummonTile();
      if (spot) {
        const skeleton = new Skeleton(this.context, spot.x, spot.y);
        skeleton.wakeUp(); // Summoned reinforcements enter combat awake.
        this.context.entities.push(skeleton);
        dungeon.log(this.context, `${this.name} summons a Skeleton.`);
        this.summonCooldown = 3;
      }
    }

    super.turn();
  }

  private hasFriendlySkeleton(): boolean {
    return this.context.entities.some(
      (e) =>
        e instanceof Skeleton &&
        e.healthPoints > 0 &&
        e.x !== undefined &&
        e.y !== undefined
    );
  }

  private findAdjacentSummonTile(): { x: number; y: number } | null {
    if (this.x === undefined || this.y === undefined) return null;

    const map = dungeon.getCurrentLevel();
    const height = map.length;
    const width = map[0].length;
    const dirs: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    for (const [dx, dy] of dirs) {
      const nx = this.x + dx;
      const ny = this.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (dungeon.isWalkableTile(this.context, nx, ny)) {
        return { x: nx, y: ny };
      }
    }

    return null;
  }
}
