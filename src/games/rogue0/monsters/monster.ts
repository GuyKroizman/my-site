import Phaser from "phaser";
import { Entity } from "../entity";
import type { EntityType } from "../entity";
import type { GameContext } from "../context";
import type { DamageType } from "../effects";
import dungeon from "../dungeon";
import { enemyTurn, enemyCanSeePlayer } from "../ai";
import Gold from "../items/gold";
import { stashChasmFallen } from "../chasmDrops";

export type MonsterConfig = {
  name: string;
  description: string;
  tile: number;
  tint?: number;
  healthPoints: number;
  movementSpeed: number;
  attackDelay: number;
  visionRadius: number;
  attackDamage: number;
  protection: number;
  range: number;
  attackTile?: number;
  projectileTexture?: string;
  scale?: number;
  textureKey?: string;
  initiallyAwake?: boolean;
  loot?: any[];
  xp?: number;
  gold?: number;
  accuracy?: number;
  evasion?: number;
  resistance?: Partial<Record<DamageType, number>>;
  vulnerability?: Partial<Record<DamageType, number>>;
  // Optional sidearm strength for ranged monsters; defaults to half the
  // primary attack (rounded up, minimum 1).
  meleeDamage?: number;
};

export default class Monster extends Entity {
  type: EntityType = "enemy";
  moving: boolean = false;
  tweens: number = 1;

  name: string;
  description: string;
  healthPoints: number;
  maxHealthPoints: number;
  visionRadius: number;
  attackDamage: number;
  meleeDamage?: number;
  protectionValue: number;
  rangeValue: number;
  loot: any[];
  gold: number;
  // Remaining world ticks, not a wall-clock deadline: saved floors pause sleep.
  sleepTurnsRemaining = 0;
  private spriteScale = 1;

  get sleeping(): boolean {
    // Combat marks awareness even on a miss/fully blocked attack.
    return this.sleepTurnsRemaining > 0 && !this.awareOfPlayer;
  }

  constructor(context: GameContext, config: MonsterConfig, x?: number, y?: number) {
    super();

    this.name = config.name;
    this.description = config.description;
    this.tile = config.tile;
    this.tint = config.tint;
    this.textureKey = config.textureKey;
    this.spriteScale = config.scale ?? 1;
    this.sleepTurnsRemaining = config.initiallyAwake ? 0 : Phaser.Math.Between(4, 12);

    this.healthPoints = config.healthPoints;
    this.maxHealthPoints = config.healthPoints;
    this.movementSpeed = config.movementSpeed;
    this.attackDelay = config.attackDelay;
    this.visionRadius = config.visionRadius;
    this.attackDamage = config.attackDamage;
    this.meleeDamage = config.meleeDamage;
    this.protectionValue = config.protection;
    this.rangeValue = config.range;
    this.attackTile = config.attackTile ?? this.attackTile;
    // Ranged monsters draw `projectileTexture` instead of their tilesheet
    // `attackTile`, which is a full opaque 16x16 frame.
    this.projectileTexture = config.projectileTexture ?? this.projectileTexture;
    this.loot = config.loot ?? [];
    this.gold = config.gold ?? 3;
    this.xpValue = config.xp ?? 5;
    this.accuracy = config.accuracy ?? 95;
    this.evasion = config.evasion ?? 0;
    this.resistance = config.resistance ?? {};
    this.vulnerability = config.vulnerability ?? {};

    this.init(context, x, y);

  }

  init(context: GameContext, x?: number, y?: number) {
    super.init(context, x, y);
    // init is also used when returning to a saved floor. Do not reroll sleep.
    this.sprite?.setScale(this.spriteScale);
  }

  wakeUp() {
    this.sleepTurnsRemaining = 0;
  }

  hearNoise(x: number, y: number): void {
    this.wakeUp();
    super.hearNoise(x, y);
  }

  takeDamage(amount: number, interruptNavigation = true): void {
    super.takeDamage(amount, interruptNavigation);
    if (amount > 0) this.wakeUp();
  }

  protected waitWhileSleeping(): boolean {
    if (this.awareOfPlayer) this.wakeUp();
    if (!this.sleeping) return false;
    const player = this.context.player;
    // Nearby movement wakes a sleeper, but not through walls or invisibility.
    if (player?.x !== undefined && player.y !== undefined &&
        this.x !== undefined && this.y !== undefined &&
        Math.max(Math.abs(this.x - player.x), Math.abs(this.y - player.y)) <= 2 &&
        enemyCanSeePlayer(this)) {
      this.wakeUp();
      return false;
    }
    this.awareOfPlayer = false;
    this.spendTime("wait");
    return true;
  }

  equip() {
    return;
  }

  refresh() {
    // The scheduler calls refresh once per elapsed world-time unit, regardless
    // of movement speed. Idle input/render frames and inactive floors do not tick.
    if (this.sleeping) this.sleepTurnsRemaining--;
  }

  turn() {
    if (this.waitWhileSleeping()) return;
    enemyTurn(this);
  }

  isOver() {
    return !this.actionReady && !this.moving;
  }

  attack() {
    return this.attackDamage;
  }

  // Archers and casters cannot bring their ranged weapon to bear at touching
  // distance, so they fall back to a weaker sidearm (hilt, claw or dagger).
  // Older saves restore without `meleeDamage`, so the derived half-strength
  // strike keeps old goblins consistent.
  meleeAttack() {
    if (this.rangeValue <= 0) return this.attackDamage;
    return this.meleeDamage ?? Math.max(1, Math.round(this.attackDamage / 2));
  }

  hasMeleeSidearm() {
    return this.rangeValue > 0;
  }

  damage() {
    return 0;
  }

  protection() {
    return this.protectionValue;
  }

  range() {
    return this.rangeValue;
  }

  onDestroy() {
    this.context.kills = (this.context.kills ?? 0) + 1;
    this.context.player?.gainXp(this.xpValue);
    this.context.player?.artifact?.onMonsterKilled?.();

    const x = this.x;
    const y = this.y;
    // A corpse dragged over the edge drops its loot into the void; the chasm
    // then delivers it to the floor below instead of leaving it hovering over
    // the hole. `fellIntoChasm` is set by dungeon.fallIntoChasm.
    const drop = (instance: Entity): void => {
      if (this.fellIntoChasm) {
        const landsBelow = stashChasmFallen(this.context, instance);
        dungeon.log(this.context, landsBelow
          ? `${this.name} was killed, dropping ${instance.name} into the chasm.`
          : `${this.name} was killed. ${instance.name} is lost in the abyss.`);
        return;
      }
      this.context.entities.push(instance);
      dungeon.log(this.context, `${this.name} was killed, dropping ${instance.name}.`);
    };

    if (this.loot.length > 0) {
      const lootIndex = Phaser.Math.Between(0, this.loot.length - 1);
      const item = this.loot[lootIndex];
      if (item) {
        drop(new item(this.context, x, y));
        return; // An item or gold, never both.
      }
    }

    // If the item roll produced nothing, give a 25% chance of floor currency.
    // Death never credits the wallet; gold uses the normal floor pickup flow.
    if (this.gold > 0 && Phaser.Math.Between(1, 4) === 1) {
      drop(new Gold(this.context, x, y, this.gold));
    } else {
      dungeon.log(this.context, `${this.name} was killed.`);
    }
  }
}
