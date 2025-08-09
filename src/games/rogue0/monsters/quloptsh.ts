// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import { Entity } from "../entity";
import type { EntityType } from "../entity";
import type { GameContext } from "../context";
import PF from "pathfinding";
import level from "../level.js";
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
  tweens: number = 1;
  UISprite?: Phaser.GameObjects.Sprite;
  UIText?: Phaser.GameObjects.Text;

  constructor(context: GameContext, x: number, y: number) {
    super();
    this.init(context, x, y);
  }

  equip(itemNumber: number) {
    return;
  }

  refresh() {
    if (this.context.player?.items.find(item => item.name === "Shoe")) {
      this.movementPoints = 1;
      this.actionPoints = 1;
    }
  }

  turn() {
    if (!this.context.player) {
      throw new Error("Error in Quloptsh context.player is undefined");
    }
    let oldX = this.x;
    let oldY = this.y;

    if (this.movementPoints > 0) {
      let pX = this.context.player!.x!;
      let pY = this.context.player!.y!;

      const grid = new PF.Grid(level);
      const finder = new PF.AStarFinder();
      const path = finder.findPath(oldX!, oldY!, pX, pY, grid);

      if (this.movementPoints > 0) {
        if (path.length > 2) {
          dungeon.moveEntityTo(this.context, this, path[1][0], path[1][1]);
        }

        this.movementPoints -= 1;
      }

      if (this.actionPoints > 0) {
        if (dungeon.distanceBetweenEntities(this, this.context.player) <= 2) {
          const NOT_RANGED_ATTACK = 0;
          const WEAPON_TINT = undefined;
          dungeon.attackEntity(this.context, this, this.context.player, NOT_RANGED_ATTACK, WEAPON_TINT);
        }
        this.actionPoints -= 1;
      }
    }
  }

  isOver() {
    const isOver =
      this.movementPoints == 0 && this.actionPoints == 0 && !this.moving;

    if (this.UIText) {
      if (isOver) {
        this.UIText.setColor("#cfc6b8");
      } else {
        this.UIText.setColor("#fff");
      }
    }

    return isOver;
  }

  attack() {
    return 1;
  }

  damage(): number {
    return 0;
  }

  onDestroy() {
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

