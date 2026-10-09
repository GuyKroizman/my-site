// @ts-nocheck
import Phaser from "phaser";
import { Entity } from "../entity";
import type { EntityType } from "../entity";
import type { GameContext } from "../context";
import dungeon from "../dungeon";
import { enemyTurn } from "../ai";

export type MonsterConfig = {
  name: string;
  description: string;
  tile: number;
  tint?: number;
  healthPoints: number;
  movementPoints: number;
  actionPoints: number;
  visionRadius: number;
  attackDamage: number;
  protection: number;
  range: number;
  attackTile?: number;
  scale?: number;
  loot?: any[];
};

export default class Monster extends Entity {
  type: EntityType = "enemy";
  moving: boolean = false;
  tweens: number = 1;

  name: string;
  description: string;
  movementPoints: number;
  actionPoints: number;
  healthPoints: number;
  maxHealthPoints: number;
  visionRadius: number;
  attackDamage: number;
  protectionValue: number;
  rangeValue: number;
  baseMovementPoints: number;
  baseActionPoints: number;
  loot: any[];

  constructor(context: GameContext, config: MonsterConfig, x?: number, y?: number) {
    super();

    this.name = config.name;
    this.description = config.description;
    this.tile = config.tile;
    this.tint = config.tint;

    this.healthPoints = config.healthPoints;
    this.maxHealthPoints = config.healthPoints;
    this.baseMovementPoints = config.movementPoints;
    this.baseActionPoints = config.actionPoints;
    this.movementPoints = config.movementPoints;
    this.actionPoints = config.actionPoints;
    this.visionRadius = config.visionRadius;
    this.attackDamage = config.attackDamage;
    this.protectionValue = config.protection;
    this.rangeValue = config.range;
    this.attackTile = config.attackTile ?? this.attackTile;
    this.loot = config.loot ?? [];

    this.init(context, x, y);

    if (config.scale) {
      this.sprite?.setScale(config.scale);
    }
  }

  equip() {
    return;
  }

  refresh() {
    this.movementPoints = this.baseMovementPoints;
    this.actionPoints = this.baseActionPoints;
  }

  turn() {
    enemyTurn(this);
  }

  isOver() {
    return this.movementPoints == 0 && this.actionPoints == 0 && !this.moving;
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
      }
    }
  }
}
