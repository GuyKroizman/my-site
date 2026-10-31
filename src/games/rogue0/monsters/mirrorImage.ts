// A fragile illusion created by the Multiplicity armor curse. It looks like
// the hero, never moves, grants no XP/loot, and fades on its own. Enemies may
// waste attacks on it (see ai.ts), but it is never a valid target for the hero.

import { Entity, removeEntity } from "../entity";
import type { EntityType } from "../entity";
import type { GameContext } from "../context";

export default class MirrorImage extends Entity {
  type: EntityType = "enemy";
  isDecoy = true;
  // Remaining world-time units before the illusion fades on its own.
  lifetime = 8;

  constructor(context: GameContext, x: number, y: number, hero: Entity) {
    super();
    this.name = "Mirror Image";
    this.description = "An illusory copy of you. Enemies may waste attacks on it.";
    this.tile = hero.tile;
    this.textureKey = hero.textureKey;
    this.tint = hero.tint;
    this.healthPoints = 1;
    this.maxHealthPoints = 1;
    this.movementSpeed = 1;
    this.attackDelay = 1;
    this.visionRadius = 0;
    this.accuracy = 0;
    this.evasion = 0;
    this.init(context, x, y);
  }

  equip() {}

  refresh() {
    this.lifetime -= 1;
    if (this.lifetime <= 0 && this.healthPoints > 0) {
      removeEntity(this.context, this);
    }
  }

  turn() {
    this.spendTime("wait");
  }

  isOver() {
    return true;
  }

  attack() {
    return 0;
  }

  protection() {
    return 0;
  }

  range() {
    return 0;
  }

  damage() {
    return 0;
  }

  onDestroy() {
    // Illusions grant no XP, kills or loot.
  }
}
