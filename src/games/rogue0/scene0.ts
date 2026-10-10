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
import Archer from "./monsters/archer";
import Ghoul from "./monsters/ghoul";
import Brute from "./monsters/brute";
import Boss from "./monsters/boss";
import classes from "./classes";
import level1 from "./level";
import {
  generateMap,
  findFarthestWalkable,
  randomWalkableTiles
} from "./mapgen";
import { computeFOV } from "./fov";
import { sfx } from "./audio";

// Keep the player spawn, stairs and procedural content out of the right-hand
// columns that sit underneath the UI sidebar.
const MAX_VISIBLE_X = 67;

export class Scene0 extends Phaser.Scene {
  context: GameContext;
  private key: string;
  private active: boolean;
  private ended: boolean = false;
  private stairsLabel?: Phaser.GameObjects.Graphics;
  private fog!: Phaser.GameObjects.Graphics;
  private seen: boolean[][] = [];
  private visible: Set<string> = new Set();
  private lastFovX?: number;
  private lastFovY?: number;
  private readonly visionRadius = 7;

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

    this.makeSparkTexture();

    // Build the first map before creating the hero (its sprite needs the map).
    dungeon.initialize(this.context, level1);

    // Fog-of-war overlay drawn above tiles and entities.
    this.fog = this.add.graphics().setDepth(100);

    const HeroClass = classes[this.context.heroClass] ?? classes.Wizard;
    const player = new HeroClass(this.context, 15, 15);
    player.sprite!.setDepth(200);
    this.context.player = player;

    this.setupFloor(1, level1, { x: 15, y: 15 });
    this.events.emit("entities-created");

    this.events.on("player-died", () => this.endGame(false));
    this.events.on("player-won", () => this.endGame(true));

    // Hovering over a visible creature shows its status in the sidebar.
    this.input.on("pointermove", (pointer) => this.inspectAtPointer(pointer));

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
    this.refreshFovIfNeeded();
  }

  private setupFloor(floor, levelArray, spawn) {
    this.context.floor = floor;

    this.seen = [];
    this.visible = new Set();
    this.lastFovX = undefined;
    this.lastFovY = undefined;

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
    this.recomputeFOV();
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
    sfx.stairs();
    dungeon.log(this.context, `You descend to floor ${next}.`);
  }

  private checkStairs() {
    const player = this.context.player;
    if (!player || player.x === undefined || player.y === undefined) return;

    if (player.x === this.context.stairsX && player.y === this.context.stairsY) {
      this.descend();
    }
  }

  private refreshFovIfNeeded() {
    const p = this.context.player;
    if (!p || p.x === undefined || p.y === undefined) return;

    if (p.x !== this.lastFovX || p.y !== this.lastFovY) {
      this.recomputeFOV();
    }
  }

  private inspectAtPointer(pointer) {
    if (!this.context.map || !pointer) return;

    const x = this.context.map.worldToTileX(pointer.worldX);
    const y = this.context.map.worldToTileY(pointer.worldY);
    const entity = dungeon.entityAtTile(this.context, x, y);

    if (entity && entity.type !== "player" && this.visible.has(`${x},${y}`)) {
      this.context.inspectedEntity = entity;
    } else {
      this.context.inspectedEntity = undefined;
    }
  }

  private recomputeFOV() {
    const p = this.context.player;
    if (!p || p.x === undefined || p.y === undefined) return;

    const map = dungeon.getCurrentLevel();
    this.visible = computeFOV(map, p.x, p.y, this.visionRadius);
    this.context.visibleTiles = this.visible;

    for (const key of this.visible) {
      const [x, y] = key.split(",").map(Number);
      if (!this.seen[y]) this.seen[y] = [];
      this.seen[y][x] = true;
    }

    this.lastFovX = p.x;
    this.lastFovY = p.y;

    this.redrawFog();
    this.applyEntityVisibility();
  }

  private redrawFog() {
    const map = dungeon.getCurrentLevel();
    const t = 16;
    const unseen = [];
    const remembered = [];

    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[0].length; x++) {
        if (this.visible.has(`${x},${y}`)) continue;
        if (this.seen[y] && this.seen[y][x]) {
          remembered.push([x, y]);
        } else {
          unseen.push([x, y]);
        }
      }
    }

    this.fog.clear();

    this.fog.fillStyle(0x000000, 1);
    for (const [x, y] of unseen) {
      this.fog.fillRect(x * t, y * t, t, t);
    }

    this.fog.fillStyle(0x000000, 0.55);
    for (const [x, y] of remembered) {
      this.fog.fillRect(x * t, y * t, t, t);
    }
  }

  private applyEntityVisibility() {
    const player = this.context.player;

    for (const entity of this.context.entities) {
      if (entity === player) continue;

      if (entity.x === undefined || entity.y === undefined) {
        entity.sprite?.setVisible(false);
        continue;
      }

      const key = `${entity.x},${entity.y}`;
      const seen = this.seen[entity.y]?.[entity.x] === true;
      const visible = this.visible.has(key);

      // Monsters are only shown while actually visible; items stay
      // remembered (dimmed by fog) once discovered.
      entity.sprite?.setVisible(entity.type === "enemy" ? visible : seen);
    }

    if (
      this.stairsLabel &&
      this.context.stairsX !== undefined &&
      this.context.stairsY !== undefined
    ) {
      const sx = this.context.stairsX;
      const sy = this.context.stairsY;
      this.stairsLabel.setVisible(this.seen[sy]?.[sx] === true);
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

  private makeSparkTexture() {
    if (this.textures.exists("spark")) return;

    const g = this.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 6, 6);
    g.generateTexture("spark", 6, 6);
    g.destroy();
  }

  private renderStairs(x, y) {
    this.stairsLabel?.destroy();

    if (!this.context.map) return;

    const isExit = this.context.floor >= this.context.maxFloor;
    const color = isExit ? 0x00ff00 : 0x00ffff;
    const wx = this.context.map.tileToWorldX(x);
    const wy = this.context.map.tileToWorldY(y);

    const g = this.add.graphics();
    g.fillStyle(color, 1);
    // Descending staircase drawn as narrowing steps.
    g.fillRect(wx + 1, wy + 1, 14, 3);
    g.fillRect(wx + 1, wy + 5, 11, 3);
    g.fillRect(wx + 1, wy + 9, 8, 3);
    g.fillRect(wx + 1, wy + 13, 5, 3);
    this.stairsLabel = g;
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

    const skeletonCount = 2 + floor;
    const archerCount = Math.max(0, floor - 1);
    const ghoulCount = floor >= 3 ? 1 : 0;
    const bruteCount = floor >= 3 ? 1 : 0;
    const bossCount = floor === this.context.maxFloor ? 1 : 0;
    const quloptshCount = Math.max(0, floor - 2);
    const itemCount = 3;

    const tiles = randomWalkableTiles(
      levelArray,
      skeletonCount + archerCount + ghoulCount + bruteCount + bossCount + quloptshCount + itemCount,
      exclude,
      MAX_VISIBLE_X
    );

    let i = 0;

    const spawnGroup = (Cls, count) => {
      for (let n = 0; n < count && i < tiles.length; n++, i++) {
        context.entities.push(new Cls(context, tiles[i].x, tiles[i].y));
      }
    };

    spawnGroup(Skeleton, skeletonCount);
    spawnGroup(Quloptsh, quloptshCount);
    spawnGroup(Archer, archerCount);
    spawnGroup(Ghoul, ghoulCount);
    spawnGroup(Brute, bruteCount);
    spawnGroup(Boss, bossCount);

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

    if (victory) {
      sfx.victory();
    } else {
      sfx.gameover();
    }

    this.cameras.main.stopFollow();
    this.context.onEnd?.({
      victory,
      floor: this.context.floor,
      kills: this.context.kills
    });
  }
}
