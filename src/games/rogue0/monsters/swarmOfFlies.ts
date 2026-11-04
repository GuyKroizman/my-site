import Phaser from "phaser";
import Monster from "./monster";
import type { GameContext } from "../context";
import type { Entity } from "../entity";
import type { DamageType } from "../effects";
import dungeon from "../dungeon";
import * as tiles from "../tiles";
import { swarmTurn } from "../ai";
import Gold from "../items/gold";
import PotionOfHealing from "../items/PotionOfHealing";
import { FLY_SWARM_TEXTURE, generateFlySwarmTexture } from "./flySwarmTexture";

// Flies are farmed for healing potions; this is the per-kill drop chance.
const HEALING_POTION_DROP_CHANCE = 0.2;

export default class SwarmOfFlies extends Monster {
  constructor(context: GameContext, x?: number, y?: number, offspring = false, splitHealth?: number) {
    if (context.scene) generateFlySwarmTexture(context.scene);
    const health = offspring ? (splitHealth ?? 8) : 16;
    super(context, {
      name: "Swarm of Flies",
      description: "A buzzing cloud that splits apart when struck with a physical blow.",
      tile: 0,
      textureKey: FLY_SWARM_TEXTURE,
      initiallyAwake: offspring,
      healthPoints: health,
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 6,
      attackDamage: 2,
      protection: 0,
      xp: offspring ? 2 : 5,
      range: 0,
      scale: offspring ? 0.7 : 1,
      loot: []
    }, x, y);

    this.flying = true;
  }

  turn(): void {
    if (this.waitWhileSleeping()) return;
    swarmTurn(this);
  }

  // A physical (non-magical) blow from the hero splits a living swarm rather
  // than simply wounding it. Magical damage and non-player attacks do not.
  onHitBy(attacker: Entity, damageType: DamageType, damage: number): void {
    if (attacker.type !== "player") return;
    if (damageType !== "physical" || damage <= 0) return;
    if (this.healthPoints <= 1 || this.x === undefined || this.y === undefined) return;
    if (!this.context.entities.includes(this)) return;
    this.split();
  }

  onDestroy(): void {
    const context = this.context;
    context.kills = (context.kills ?? 0) + 1;
    context.player?.gainXp(this.xpValue);
    context.player?.artifact?.onMonsterKilled?.();

    const x = this.x;
    const y = this.y;
    if (x === undefined || y === undefined) return;

    if (Math.random() < HEALING_POTION_DROP_CHANCE) {
      const potion = new PotionOfHealing(context, x, y);
      context.entities.push(potion);
      dungeon.log(context, `${this.name} was killed, dropping ${potion.name}.`);
      return;
    }

    if (this.gold > 0 && Phaser.Math.Between(1, 4) === 1) {
      const pile = new Gold(context, x, y, this.gold);
      context.entities.push(pile);
      dungeon.log(context, `${this.name} was killed, dropping ${pile.name}.`);
      return;
    }

    dungeon.log(context, `${this.name} was killed.`);
  }

  private split(): void {
    const context = this.context;
    const x = this.x!;
    const y = this.y!;
    const remaining = this.healthPoints;
    const firstHp = Math.ceil(remaining / 2);
    const secondHp = Math.floor(remaining / 2);

    const spot = this.freeAdjacentTile();

    this.removeWithoutDeath();

    context.entities.push(new SwarmOfFlies(context, x, y, true, firstHp));
    context.entities.push(new SwarmOfFlies(context, spot?.x ?? x, spot?.y ?? y, true, secondHp));

    dungeon.log(context, `${this.name} splits into two smaller swarms!`);
  }

  // Removes this swarm without death rewards/loot/XP; splitting is not dying.
  private removeWithoutDeath(): void {
    const context = this.context;
    const index = context.entities.indexOf(this);
    if (index !== -1) context.entities.splice(index, 1);

    const sprite = this.sprite;
    this.sprite = undefined;
    if (sprite) {
      context.scene?.tweens.killTweensOf(sprite);
      context.scene?.tweens.add({
        targets: sprite,
        alpha: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: 180,
        onComplete: () => sprite.destroy()
      });
    }

    if (context.inspectedEntity === this) context.inspectedEntity = undefined;
    this.x = undefined;
    this.y = undefined;
  }

  private freeAdjacentTile(): { x: number; y: number } | null {
    const x = this.x;
    const y = this.y;
    if (x === undefined || y === undefined) return null;

    const level = dungeon.getCurrentLevel();
    const dirs: Array<[number, number]> = [
      [1, 0], [-1, 0], [0, 1], [0, -1], [-1, -1], [1, -1], [-1, 1], [1, 1]
    ];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }

    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (ny < 0 || nx < 0 || ny >= level.length || nx >= level[0].length) continue;
      if (level[ny][nx] !== 0) continue;
      if (tiles.isBlocking(nx, ny) && !(this.isFlying && tiles.getFeature(nx, ny) === "chasm")) continue;
      if (this.context.entities.some(e => e !== this && e.type !== "item" &&
          e.healthPoints > 0 && e.x === nx && e.y === ny)) continue;
      return { x: nx, y: ny };
    }

    return null;
  }
}
