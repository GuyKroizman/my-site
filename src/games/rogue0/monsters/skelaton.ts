// TypeScript errors after site migration - ignoring for game functionality
import dungeon from "../dungeon";
import type { GameContext } from "../context";
import { enemyTurn } from "../ai";
import { Entity } from "../entity";
import type { EntityType } from "../entity";
import Gem from "../items/gem";
import HolyPotion from "../items/holyPotion";
import BerserkPotion from "../items/berserkPotion";

export default class Skeleton extends Entity {
  readonly name: string = "Skeleton";
  description: string = "A skeleton";
  type: EntityType = "enemy";
  visionRadius: number = 7;
  tweens: number = 2;

  constructor(context: GameContext, x: number, y: number) {
    super();
    if (
      context.map == undefined ||
      context.scene == undefined ||
      context.player == undefined
    ) {
      throw new Error("Error in Skeleton context is undefined");
    }

    this.movementPoints = 1;
    this.actionPoints = 1;
    this.healthPoints = 4;
    this.maxHealthPoints = 4;
    this.tile = 6 * 49 + 29;
    this.moving = false;

    this.init(context, x, y);
  }

  equip() {
    return;
  }

  refresh() {
    this.movementPoints = 1;
    this.actionPoints = 1;
  }

  turn() {
    enemyTurn(this);
  }

  isOver() {
    return this.movementPoints == 0 && this.actionPoints == 0 && !this.moving;
  }

  attack() {
    return 1;
  }

  damage() {
    return 0;
  }

  onDestroy() {
    this.context.kills = (this.context.kills ?? 0) + 1;
    dungeon.log(this.context, `${this.name} was killed.`);
    if (this.UISprite) {
      this.UISprite.setAlpha(0.2);
    }
    if (this.UIText) {
      this.UIText.setAlpha(0.2);
    }

    // loot
    let x = this.x;
    let y = this.y;

    let possibleLoot = [
      false,
      false,
      false,
      false,
      Gem,
      HolyPotion,
      BerserkPotion
    ];

    let lootIndex = Phaser.Math.Between(0, possibleLoot.length - 1);
    if (possibleLoot[lootIndex]) {
      let item = possibleLoot[lootIndex];
      // ignore the warning that false is not constructable because code is only
      // reachable if item is not false
      // @ts-ignore
      this.context.entities.push(new item(this.context, x, y));
      // @ts-ignore
      dungeon.log(this.context, `${this.name} drops ${item.name}.`);
    }
  }

  protection(): number {
    return 0;
  }

  range(): number {
    return 0;
  }

  createUI({ scene, x, y }: {
    scene: Phaser.Scene;
    x: number;
    y: number
  }) {
    this.UISprite = scene.add.sprite(x, y, "tiles", this.tile).setOrigin(0);
    this.UIText = scene.add.text(x + 20, y, this.name, {
      font: "16px Arial",
      backgroundColor: "#646059"
    });

    return 30;
  }
}
