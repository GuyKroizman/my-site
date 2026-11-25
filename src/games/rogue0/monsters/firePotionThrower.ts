import Monster from "./monster";
import { monsterStats, MONSTER_XP } from '../monsterBalance';
import type { GameContext } from "../context";
import dungeon from "../dungeon";
import { resolveAttack } from "../combat";
import { applyAttackResult } from "../combatApplication";
import { applyEffect, createBurningEffect, removeEffect } from "../effects";
import { removeEntity } from "../entity";
import { enemyCanSeePlayer } from "../ai";
import { isEnemyVisible } from "../combatFeedback";
import { actorFootprint } from "../actorBodies.ts";
import { footprintContains } from "../footprint.ts";
import {
  FIRE_POTION_THROWER_TEXTURE,
  generateFirePotionThrowerTexture
} from './firePotionThrowerTexture';

/** Own turns between completed fire-potion bursts. */
export const FIRE_POTION_COOLDOWN = 2;
/** The centre plus its eight neighbours, fixed when the telegraph starts. */
export const FIRE_POTION_TELEGRAPH_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1]
];

export default class FirePotionThrower extends Monster {
  // Plain serializable fields: a save restores a telegraph mid-windup without
  // turning it into a status effect or a wall-clock timer.
  telegraphStage: 0 | 1 | 2 = 0;
  targetX = -1;
  targetY = -1;
  abilityCooldown = 0;

  constructor(context: GameContext, x?: number, y?: number) {
    if (context.scene) generateFirePotionThrowerTexture(context.scene);
    super(context, {
      name: "Fire Potion Thrower",
      description: "A brass-goggled worker hurling flasks of liquid flame. Red borders mark fixed tiles; step clear of the 3x3 before the burst.",
      textureKey: FIRE_POTION_THROWER_TEXTURE,
      musicCue: 'firePotionThrower',
      ...monsterStats('firePotionThrower', context.floor),
      movementSpeed: 1,
      attackDelay: 1,
      visionRadius: 6,
      protection: 0,
      xp: MONSTER_XP.firePotionThrower,
      // A truthy range routes ordinary AI turns through its ranged branch; the
      // telegraph below replaces those attacks while it is charging.
      range: 6,
      attackTile: 1,
      loot: [false, false, false]
    }, x, y);
  }

  turn(): void {
    if (this.waitWhileSleeping()) return;
    if (this.abilityCooldown > 0) this.abilityCooldown--;

    // Like goblins and cultists, a ranged attacker cannot bring a flask to
    // bear at touching distance. Close-range turns use the melee sidearm
    // instead, abandoning any half-finished telegraph.
    if (this.adjacentToPlayer()) {
      if (this.telegraphStage !== 0) {
        this.log('A Fire Potion Thrower abandons its marked flasks and closes to melee.');
        this.cancelTelegraph();
      }
      super.turn();
      return;
    }

    if (this.telegraphStage === 2) {
      this.burst();
      return;
    }
    if (this.telegraphStage === 1) {
      this.log('Red warning borders snap around the eight tiles next to the target.');
      this.telegraphStage = 2;
      this.spendTime('attack');
      return;
    }
    if (this.abilityCooldown === 0 && this.canStartTelegraph()) {
      const player = this.context.player!;
      this.targetX = player.x!;
      this.targetY = player.y!;
      this.telegraphStage = 1;
      this.log('A Fire Potion Thrower levels a flask at your tile. The marked tiles are fixed.');
      this.spendTime('attack');
      return;
    }
    super.turn();
  }

  private adjacentToPlayer(): boolean {
    const player = this.context.player;
    if (!player || player.healthPoints <= 0 ||
        player.x === undefined || player.y === undefined ||
        this.x === undefined || this.y === undefined) return false;
    return Math.max(Math.abs(player.x - this.x), Math.abs(player.y - this.y)) <= 1;
  }

  private cancelTelegraph(): void {
    this.telegraphStage = 0;
    this.targetX = -1;
    this.targetY = -1;
  }

  private canStartTelegraph(): boolean {
    const player = this.context.player;
    if (!player || player.healthPoints <= 0 ||
        player.x === undefined || player.y === undefined ||
        this.x === undefined || this.y === undefined) return false;
    if (Math.max(Math.abs(player.x - this.x), Math.abs(player.y - this.y)) > 6) return false;
    return enemyCanSeePlayer(this);
  }

  private burst(): void {
    const context = this.context;
    const level = dungeon.getCurrentLevel();
    const cells = FIRE_POTION_TELEGRAPH_OFFSETS
      .map(([dx, dy]) => ({ x: this.targetX + dx, y: this.targetY + dy }))
      .filter((cell) => level[cell.y]?.[cell.x] !== undefined);
    // The flask is thrown; the floor splash follows the flight.
    let arrived = false;
    const splash = () => {
      if (arrived) return;
      arrived = true;
      context.onPotionSplash?.({ cells, kind: 'fire' });
    };
    context.onFirePotionThrown?.({
      from: { x: this.x!, y: this.y! },
      to: { x: this.targetX, y: this.targetY },
      onArrived: splash,
    });
    if (!context.onFirePotionThrown) splash();

    const player = context.player;
    if (player && player.healthPoints > 0 && player.x !== undefined && player.y !== undefined) {
      const body = actorFootprint(player);
      const struck = cells.some((cell) =>
        footprintContains(body, player.x!, player.y!, cell.x, cell.y));
      if (struck) {
        const result = resolveAttack(context, this, player, {
          damageType: 'fire',
          isRanged: true,
          baseDamage: Math.max(1, Math.round(this.attackDamage * 0.75)),
          onHitEffects: [createBurningEffect(12)]
        });
        applyAttackResult(context, this, player, result, {
          applyEffect,
          removeEffect,
          removeEntity,
          onHit: () => dungeon.log(context, 'A flask of liquid flame bursts around you!')
        });
      } else {
        dungeon.log(context, 'Flasks of liquid flame burst across the factory floor.');
      }
    }

    this.telegraphStage = 0;
    this.targetX = -1;
    this.targetY = -1;
    this.abilityCooldown = FIRE_POTION_COOLDOWN;
    this.spendTime('attack');
  }

  // Warnings about an unseen thrower stay generic instead of naming it.
  private log(detail: string): void {
    dungeon.log(this.context,
      isEnemyVisible(this.context, this) ? detail : 'Something in the factory rattles a flask.');
  }
}
