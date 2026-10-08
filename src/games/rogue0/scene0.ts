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
import HealthPotion from "./items/healthpotion";
import Sword from "./items/sword";
import Axe from "./items/axe";
import Bow from "./items/bow";
import Shield from "./items/shield";
import Shoe from "./items/Shoe";
import Quloptsh from "./monsters/quloptsh";
import classes from "./classes";
import level1 from "./level";
import {
  generateMap,
  findFarthestWalkable,
  randomWalkableTiles
} from "./mapgen";

// Keep the player spawn, stairs and procedural content out of the right-hand
// columns that sit underneath the UI sidebar.
const MAX_VISIBLE_X = 67;

export class Scene0 extends Phaser.Scene {
  context: GameContext;
  private key: string;
  private active: boolean;
  private ended: boolean = false;
  private stairsLabel?: Phaser.GameObjects.Text;

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
    this.context.floor = 1;
    this.context.kills = 0;
    this.ended = false;

    // Build the first map before creating the hero (its sprite needs the map).
    dungeon.initialize(this.context, level1);

    const HeroClass = classes[this.context.heroClass] ?? classes.Wizard;
    const player = new HeroClass(this.context, 15, 15);
    this.context.player = player;

    this.setupFloor(1, level1, { x: 15, y: 15 });
    this.events.emit("entities-created");

    this.events.on("player-died", () => this.endGame(false));
    this.events.on("player-won", () => this.endGame(true));

    // Set camera, causing the game viewport to shrink on the right side
    // freeing space for the UI scene.
    let camera = this.cameras.main;
    camera.setViewport(0, 0, camera.worldView.width - 200, camera.worldView.height);
    camera.setBounds(0, 0, camera.worldView.width, camera.worldView.height);
    camera.startFollow(this.context.player.sprite!);
  }

  update() {
    if (this.ended) return;

    turnManager.update(this.context.entities);
    this.checkStairs();
  }

  private setupFloor(floor, levelArray, spawn) {
    this.context.floor = floor;

    const player = this.context.player!;
    const kept = new Set([player, ...player.items]);

    // Drop everything from the previous floor except the player and its gear.
    for (const entity of this.context.entities) {
      if (!kept.has(entity)) {
        entity.sprite?.destroy();
        entity.sprite = undefined;
      }
    }

    this.context.entities = [player, ...player.items];

    // Start the new floor with a fresh player turn.
    player.refresh();

    this.placePlayer(spawn.x, spawn.y);

    const stairs = findFarthestWalkable(
      levelArray,
      spawn.x,
      spawn.y,
      MAX_VISIBLE_X
    );
    this.context.stairsX = stairs.x;
    this.context.stairsY = stairs.y;
    this.renderStairs(stairs.x, stairs.y);

    this.spawnFloorContent(floor, levelArray, spawn);

    turnManager.reset();
    this.events.emit("floor-changed", { floor });
  }

  private descend() {
    if (this.ended) return;

    if (this.context.floor >= this.context.maxFloor) {
      this.events.emit("player-won");
      return;
    }

    const next = this.context.floor + 1;
    const generated = generateMap();
    const levelArray = generated.map;
    const spawnRoom =
      generated.rooms.find((r) => r.cx < MAX_VISIBLE_X) ?? generated.rooms[0];
    const spawn = spawnRoom
      ? { x: spawnRoom.cx, y: spawnRoom.cy }
      : this.findSpawn(levelArray);

    dungeon.initialize(this.context, levelArray);
    this.setupFloor(next, levelArray, spawn);
    dungeon.log(this.context, `You descend to floor ${next}.`);
  }

  private checkStairs() {
    const player = this.context.player;
    if (!player || player.x === undefined || player.y === undefined) return;

    if (player.x === this.context.stairsX && player.y === this.context.stairsY) {
      this.descend();
    }
  }

  private findSpawn(levelArray) {
    const h = levelArray.length;
    const w = levelArray[0].length;
    for (let y = Math.floor(h / 2); y < h; y++) {
      for (let x = Math.floor(w / 2); x < Math.min(w, MAX_VISIBLE_X); x++) {
        if (levelArray[y][x] === 0) return { x, y };
      }
    }
    return { x: 15, y: 15 };
  }

  private placePlayer(x, y) {
    const player = this.context.player!;
    player.x = x;
    player.y = y;
    if (player.sprite && this.context.map) {
      player.sprite.setPosition(
        this.context.map.tileToWorldX(x),
        this.context.map.tileToWorldY(y)
      );
    }
  }

  private renderStairs(x, y) {
    this.stairsLabel?.destroy();

    if (!this.context.map) return;

    const isExit = this.context.floor >= this.context.maxFloor;
    const color = isExit ? "#00ff00" : "#00ffff";

    this.stairsLabel = this.add
      .text(
        this.context.map.tileToWorldX(x) + 1,
        this.context.map.tileToWorldY(y) - 2,
        "▼",
        { font: "16px Arial", color, backgroundColor: "#000000" }
      )
      .setOrigin(0);
  }

  private spawnFloorContent(floor, levelArray, spawn) {
    const context = this.context;

    if (floor === 1) {
      // Original handcrafted floor content.
      context.entities.push(new Skeleton(context, 76, 10));
      context.entities.push(new Skeleton(context, 20, 20));
      context.entities.push(new Skeleton(context, 20, 10));
      context.entities.push(new Skeleton(context, 29, 24));
      context.entities.push(new Skeleton(context, 29, 20));
      context.entities.push(new Gem(context, 21, 21));
      context.entities.push(new CursedGem(context, 15, 20));
      context.entities.push(new HolyPotion(context, 18, 18));
      context.entities.push(new LongSword(context, 18, 22));
      context.entities.push(new HealingPotion(context, 18, 23));
      context.entities.push(new Shoe(context, 15, 16));
      context.entities.push(new Quloptsh(context, 12, 17));
      return;
    }

    const exclude = new Set([
      `${spawn.x},${spawn.y}`,
      `${this.context.stairsX},${this.context.stairsY}`
    ]);

    const skeletonCount = 3 + floor * 2;
    const quloptshCount = Math.max(0, floor - 1);
    const itemCount = 3;

    const tiles = randomWalkableTiles(
      levelArray,
      skeletonCount + quloptshCount + itemCount,
      exclude,
      MAX_VISIBLE_X
    );

    let i = 0;

    for (let s = 0; s < skeletonCount && i < tiles.length; s++, i++) {
      context.entities.push(new Skeleton(context, tiles[i].x, tiles[i].y));
    }
    for (let q = 0; q < quloptshCount && i < tiles.length; q++, i++) {
      context.entities.push(new Quloptsh(context, tiles[i].x, tiles[i].y));
    }

    const lootPool = [
      Sword,
      Axe,
      Bow,
      Shield,
      Gem,
      CursedGem,
      HolyPotion,
      HealingPotion,
      HealthPotion,
      Shoe
    ];
    for (let l = 0; l < itemCount && i < tiles.length; l++, i++) {
      const Loot = lootPool[Math.floor(Math.random() * lootPool.length)];
      context.entities.push(new Loot(context, tiles[i].x, tiles[i].y));
    }
  }

  private endGame(victory) {
    if (this.ended) return;
    this.ended = true;
    this.cameras.main.stopFollow();
    this.context.onEnd?.({
      victory,
      floor: this.context.floor,
      kills: this.context.kills
    });
  }
}
