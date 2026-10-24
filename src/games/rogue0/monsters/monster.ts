import Phaser from "phaser";
import { Entity } from "../entity";
import type { EntityType } from "../entity";
import type { GameContext } from "../context";
import type { DamageType } from "../effects";
import dungeon from "../dungeon";
import { enemyTurn, enemyCanSeePlayer } from "../ai";
import Gold from "../items/gold";

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
    this.protectionValue = config.protection;
    this.rangeValue = config.range;
    this.attackTile = config.attackTile ?? this.attackTile;
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
    dungeon.log(this.context, `${this.name} was killed.`);

    const x = this.x;
    const y = this.y;
    if (this.loot.length > 0) {
      const lootIndex = Phaser.Math.Between(0, this.loot.length - 1);
      const item = this.loot[lootIndex];
      if (item) {
        const instance = new item(this.context, x, y);
        this.context.entities.push(instance);
        dungeon.log(this.context, `${this.name} drops ${instance.name}.`);
        return; // An item or gold, never both.
      }
    }

    // If the item roll produced nothing, give a 25% chance of floor currency.
    // Death never credits the wallet; gold uses the normal floor pickup flow.
    if (this.gold > 0 && Phaser.Math.Between(1, 4) === 1) {
      const pile = new Gold(this.context, x, y, this.gold);
      this.context.entities.push(pile);
      dungeon.log(this.context, `${this.name} drops ${pile.name}.`);
    }
  }
}
