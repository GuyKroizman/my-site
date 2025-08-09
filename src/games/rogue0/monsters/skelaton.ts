// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import dungeon from "../dungeon";
import type { GameContext } from "../context";
import PF from "pathfinding";
import level from "../level.js";
import { Entity } from "../entity";
import type { EntityType } from "../entity";
import Gem from "../items/gem";
import HolyPotion from "../items/holyPotion";
import BerserkPotion from "../items/berserkPotion";

export default class Skeleton extends Entity {
  private movementPoints: number;
  tile: number;
  moving: boolean;
  readonly name: string = "Skeleton";
  description: string = "A skeleton";
  type: EntityType = "enemy";
  actionPoints: number;
  healthPoints: number;
  tweens: number = 2;
  UISprite?: Phaser.GameObjects.Sprite;
  UIText?: Phaser.GameObjects.Text;

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
    this.tile = 6 * 49 + 29;
    this.moving = false;

    this.init(context, x, y);
  }

  equip(itemNumber: number) {
    return;
  }

  refresh() {
    this.movementPoints = 1;
    this.actionPoints = 1;
  }

  turn() {
    if (!this.context.player) {
      throw new Error("Error in Skeleton context.player is undefined");
    }
    let oldX = this.x;
    let oldY = this.y;

    if (this.movementPoints > 0) {
      let pX = this.context.player!.x!;
      let pY = this.context.player!.y!;

      const grid = new PF.Grid(level);
      const finder = new PF.AStarFinder();
      const path = finder.findPath(oldX!, oldY!, pX, pY, grid);

      if (path.length > 2) {
        dungeon.moveEntityTo(this.context, this, path[1][0], path[1][1]);
      }

      this.movementPoints -= 1;

      if (this.actionPoints > 0) {
        if (path.length <= 2) {
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

  damage() {
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
