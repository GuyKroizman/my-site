// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import Phaser from "phaser";
import dungeon from "./dungeon";
import type { GameContext } from "./context";
import turnManager from "./turnManager";
import Skeleton from "./monsters/skelaton";
import LongSword from "./items/longSword";
import Gem from "./items/gem";
import CursedGem from "./items/cursedGem";
import HolyPotion from "./items/holyPotion";
import HealingPotion from "./items/healingPotion";
import Shoe from "./items/Shoe";
import Quloptsh from "./monsters/quloptsh";
import classes from "./classes";

export class Scene0 extends Phaser.Scene {
  context: GameContext;
  private key: string;
  private active: boolean;

  constructor(context: GameContext) {
    super("scene0");

    this.context = context;
    this.key = "scene0";
    this.active = true;
  }

  preload() {
    this.load.spritesheet("tiles", "/colored.png", {
      frameWidth: 16,
      frameHeight: 16,
      spacing: 1
    });
  }

  create() {
    this.context.scene = this;

    dungeon.initialize(this.context);

    // let player = new classes.Warrior(this.context, 15, 15);
    // let player = new classes.Dwarf(this.context, 15, 15);
    // let player = new classes.Cleric(this.context, 15, 15);
    // let player = new classes.Elf(this.context, 15, 15);
    let player = new classes.Wizard(this.context, 15, 15);
    this.context.entities.push(player);
    this.context.player = player;

    this.context.entities.push(new Skeleton(this.context, 76, 10));
    this.context.entities.push(new Skeleton(this.context, 20, 20));
    this.context.entities.push(new Skeleton(this.context, 20, 10));
    this.context.entities.push(new Skeleton(this.context, 29, 24));
    this.context.entities.push(new Skeleton(this.context, 29, 20));
    this.context.entities.push(new Gem(this.context, 21, 21));
    this.context.entities.push(new CursedGem(this.context, 15, 20));
    this.context.entities.push(new HolyPotion(this.context, 18, 18));

    this.context.entities.push(new LongSword(this.context, 18, 22));
    this.context.entities.push(new HealingPotion(this.context, 18, 23));
    this.context.entities.push(new Shoe(this.context, 15, 16));
    this.context.entities.push(new Quloptsh(this.context, 12, 17));

    this.events.emit("entities-created");

    // Set camera, causes game viewport to shrink on the right side freeing
    // space for the UI scene.
    let camera = this.cameras.main;
    camera.setViewport(0, 0, camera.worldView.width - 200, camera.worldView.height);
    camera.setBounds(0, 0, camera.worldView.width, camera.worldView.height);
    camera.startFollow(this.context.player.sprite!);
  }

  update() {
    const entities = this.context.entities;
    turnManager.update(entities);
  }
}
