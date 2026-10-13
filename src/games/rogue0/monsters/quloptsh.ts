// TypeScript errors after site migration - ignoring for game functionality
import { Entity } from "../entity";
import type { EntityType } from "../entity";
import type { GameContext } from "../context";
import { enemyTurn } from "../ai";
import dungeon from "../dungeon";
import Shoe from "../items/Shoe";

export default class Quloptsh extends Entity {
  movementPoints: number = 1;
  tile: number = 6 * 49 + 30;
  moving: boolean = false;
  name: string = "Quloptsh";
  description: string = "A calm Quloptsh";
  type: EntityType = "enemy";
  actionPoints: number = 0;
  healthPoints: number = 10;
  maxHealthPoints: number = 10;
  visionRadius: number = 7;
  tweens: number = 1;
  xpValue: number = 4;

  constructor(context: GameContext, x: number, y: number) {
    super();
    this.init(context, x, y);
  }

  equip() {
    return;
  }

  refresh() {
    if (this.context.player?.items.find(item => item.name === "Shoe")) {
      this.movementPoints = 1;
      this.actionPoints = 1;
    }
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

  damage(): number {
    return 0;
  }

  onDestroy() {
    this.context.kills = (this.context.kills ?? 0) + 1;
    this.context.player?.gainXp(this.xpValue);
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
      Shoe
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

