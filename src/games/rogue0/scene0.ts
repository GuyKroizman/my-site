import Phaser from "phaser";
import dungeon from "./dungeon";
import type { GameContext } from "./context";
import turnManager from "./turnManager";
import Skeleton from "./monsters/skelaton";
import LongSword from "./items/longSword";
import Gem from "./items/gem";
import CursedGem from "./items/cursedGem";
import HolyPotion from "./items/holyPotion";
import FullHealPotion from "./items/fullHealPotion";
import MinorHealPotion from "./items/minorHealPotion";
import Sword from "./items/sword";
import Axe from "./items/axe";
import Bow from "./items/bow";
import Shield from "./items/shield";
import Shoe from "./items/Shoe";
import ScrollOfIdentify from "./items/ScrollOfIdentify";
import ScrollOfUpgrade from "./items/ScrollOfUpgrade";
import ScrollOfRemoveCurse from "./items/ScrollOfRemoveCurse";
import PotionOfHealing from "./items/PotionOfHealing";
import PotionOfStrength from "./items/PotionOfStrength";
import PotionOfInvisibility from "./items/PotionOfInvisibility";
import PotionOfToxicGas from "./items/PotionOfToxicGas";
import PotionOfLiquidFlame from "./items/PotionOfLiquidFlame";
import PotionOfFrost from "./items/PotionOfFrost";
import PotionOfLevitation from "./items/PotionOfLevitation";
import PotionOfExperience from "./items/PotionOfExperience";
import ScrollOfTeleport from "./items/ScrollOfTeleport";
import ScrollOfRage from "./items/ScrollOfRage";
import ScrollOfTerror from "./items/ScrollOfTerror";
import ScrollOfRecharging from "./items/ScrollOfRecharging";
import WandOfFirebolt from "./items/WandOfFirebolt";
import WandOfFrost from "./items/WandOfFrost";
import WandOfLightning from "./items/WandOfLightning";
import RingOfAccuracy from "./items/RingOfAccuracy";
import RingOfEvasion from "./items/RingOfEvasion";
import RingOfElements from "./items/RingOfElements";
import RingOfHaste from "./items/RingOfHaste";
import RingOfMight from "./items/RingOfMight";
import ChaliceOfBlood from "./items/ChaliceOfBlood";
import FangOfTheBeast from "./items/FangOfTheBeast";
import Ration from "./items/ration";
import LargeRation from "./items/largeRation";
import Quloptsh from "./monsters/quloptsh";
import Archer from "./monsters/archer";
import Ghoul from "./monsters/ghoul";
import Brute from "./monsters/brute";
import Boss from "./monsters/boss";
import Cultist from "./monsters/cultist";
import FireElemental, { IceElemental, ShockElemental } from "./monsters/elemental";
import Mimic from "./monsters/mimic";
import SwarmOfFlies from "./monsters/swarmOfFlies";
import Wraith from "./monsters/wraith";
import classes from "./classes";
import level1 from "./level";
import {
  generateMap,
  findFarthestWalkable,
  randomWalkableTiles
} from "./mapgen";
import { computeFOV } from "./fov";
import { sfx } from "./audio";
import { generatePotionTextures } from "./potionTextures";
import * as tiles from "./tiles";
import type { FeaturePlacement } from "./tiles";

// Keep the player spawn, stairs and procedural content out of the right-hand
// columns that sit underneath the UI sidebar.
const MAX_VISIBLE_X = 67;

export class Scene0 extends Phaser.Scene {
  context: GameContext;
  private ended: boolean = false;
  private stairsLabel?: Phaser.GameObjects.Graphics;
  private fog!: Phaser.GameObjects.Graphics;
  private seen: boolean[][] = [];
  private visible: Set<string> = new Set();
  private lastFovX?: number;
  private lastFovY?: number;
  private readonly visionRadius = 7;
  private featureSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private cursor!: Phaser.GameObjects.Graphics;

  constructor(context: GameContext) {
    super("scene0");

    this.context = context;
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
    generatePotionTextures(this);

    // Floor 1 is handcrafted and must not receive terrain features.
    tiles.clearAllFeatures();

    // Build the first map before creating the hero (its sprite needs the map).
    dungeon.initialize(this.context, level1);

    // Fog-of-war overlay drawn above tiles and entities.
    this.fog = this.add.graphics().setDepth(100);

    // Inspect/throw cursor, drawn above entities and fog.
    this.cursor = this.add.graphics().setDepth(300);

    // Door opens / grass burns / trap reveals all need to re-sync the overlay.
    dungeon.onTerrainChanged = () => this.syncFeatures();

    const HeroClass = (classes as any)[this.context.heroClass] ?? classes.Wizard;
    const player = new HeroClass(this.context, 15, 15);
    player.sprite!.setDepth(200);
    this.context.player = player;

    this.setupFloor(1, level1, { x: 15, y: 15 });
    this.events.emit("entities-created");

    this.events.on("player-died", () => this.endGame(false));
    this.events.on("player-won", () => this.endGame(true));

    // Hovering over a visible creature shows its status in the sidebar.
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.inspectAtPointer(pointer));

    // Set camera, causing the game viewport to shrink on the right side
    // freeing space for the UI scene.
    let camera = this.cameras.main;
    camera.setViewport(0, 0, camera.worldView.width - 200, camera.worldView.height);
    camera.setBounds(0, 0, camera.worldView.width, camera.worldView.height);
    camera.startFollow(this.context.player!.sprite!);
  }

  update() {
    if (this.ended) return;

    turnManager.update(this.context.entities);
    this.checkStairs();
    this.refreshFovIfNeeded();

    // Fast-forward animations while the player is waiting on buffered input.
    const p = this.context.player;
    this.tweens.timeScale = p && p.inputBuffer && p.inputBuffer.length > 0 ? 2 : 1;

    this.updateCursor();
  }

  private updateCursor(): void {
    const ctx = this.context;
    if (!ctx.map) return;

    const active = ctx.inspectMode || ctx.throwMode;
    this.cursor.clear();
    if (!active) return;

    if (ctx.cursorX === undefined || ctx.cursorY === undefined) {
      ctx.cursorX = ctx.player?.x;
      ctx.cursorY = ctx.player?.y;
    }

    const x = ctx.cursorX;
    const y = ctx.cursorY;
    if (x === undefined || y === undefined) return;

    // Only highlight tiles currently in view (targeting needs line of sight).
    if (!this.visible.has(`${x},${y}`)) return;

    const wx = ctx.map.tileToWorldX(x)!;
    const wy = ctx.map.tileToWorldY(y)!;
    const color = ctx.throwMode ? 0xff6a6a : 0xf0b429;
    this.cursor.lineStyle(2, color, 1);
    this.cursor.strokeRect(wx + 1, wy + 1, 14, 14);
    this.cursor.fillStyle(color, 0.18);
    this.cursor.fillRect(wx, wy, 16, 16);
  }

  private setupFloor(
    floor: number,
    levelArray: number[][],
    spawn: { x: number; y: number },
    stairs?: { x: number; y: number }
  ) {
    this.context.floor = floor;

    this.seen = [];
    this.visible = new Set();
    this.lastFovX = undefined;
    this.lastFovY = undefined;

    const player = this.context.player!;
    const kept = new Set([player, ...player.getAllItems()]);

    // Drop everything from the previous floor except the player and its gear.
    for (const entity of this.context.entities) {
      if (!kept.has(entity)) {
        entity.sprite?.destroy();
        entity.sprite = undefined;
      }
    }

    this.context.entities = [player, ...player.getAllItems()];

    // Start the new floor with a fresh player turn.
    player.refresh();

    this.placePlayer(spawn.x, spawn.y);

    const stairsPos =
      stairs ?? findFarthestWalkable(levelArray, spawn.x, spawn.y, MAX_VISIBLE_X);
    this.context.stairsX = stairsPos.x;
    this.context.stairsY = stairsPos.y;
    this.renderStairs(stairsPos.x, stairsPos.y);

    this.syncFeatures();

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

    this.applyFeatures(generated.features);

    const spawnRoom =
      generated.rooms.find((r) => r.cx < MAX_VISIBLE_X) ?? generated.rooms[0];
    const spawn = spawnRoom
      ? { x: spawnRoom.cx, y: spawnRoom.cy }
      : this.findSpawn(levelArray);
    const stairs = findFarthestWalkable(levelArray, spawn.x, spawn.y, MAX_VISIBLE_X);

    // Spawn and stairs must never sit on a terrain feature.
    tiles.clearFeature(spawn.x, spawn.y);
    tiles.clearFeature(stairs.x, stairs.y);

    dungeon.initialize(this.context, levelArray);
    this.setupFloor(next, levelArray, spawn, stairs);
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

  private inspectAtPointer(pointer: Phaser.Input.Pointer) {
    if (!this.context.map || !pointer) return;

    const x = this.context.map.worldToTileX(pointer.worldX)!;
    const y = this.context.map.worldToTileY(pointer.worldY)!;
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
    const unseen: Array<[number, number]> = [];
    const remembered: Array<[number, number]> = [];

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

  private findSpawn(levelArray: number[][]): { x: number; y: number } {
    const h = levelArray.length;
    const w = levelArray[0].length;
    for (let y = Math.floor(h / 2); y < h; y++) {
      for (let x = Math.floor(w / 2); x < Math.min(w, MAX_VISIBLE_X); x++) {
        if (levelArray[y][x] === 0) return { x, y };
      }
    }
    return { x: 15, y: 15 };
  }

  private placePlayer(x: number, y: number) {
    const player = this.context.player!;
    player.x = x;
    player.y = y;
    if (player.sprite && this.context.map) {
      player.sprite.setPosition(
        this.context.map.tileToWorldX(x)!,
        this.context.map.tileToWorldY(y)!
      );
    }
  }

  private applyFeatures(features: FeaturePlacement[]) {
    // Recreate feature sprites on the new floor so they are added to the
    // display list after the freshly-built tilemap layer.
    this.clearFeatureSprites();

    tiles.clearAllFeatures();
    for (const f of features) {
      tiles.setFeature(f.x, f.y, f.feature, {
        door: f.door,
        trap: f.trap,
        trapKind: f.trapKind
      });
    }
  }

  private clearFeatureSprites() {
    for (const sprite of this.featureSprites.values()) {
      sprite.destroy();
    }
    this.featureSprites.clear();
  }

  private featureVisual(state: tiles.TileState): { tile: number; tint?: number } {
    switch (state.feature) {
      case "door":
        return state.door === "open"
          ? { tile: tiles.FeatureTiles.doorOpen, tint: 0x9a8b7a }
          : { tile: tiles.FeatureTiles.doorClosed, tint: 0x9a5b2b };
      case "grass":
        return { tile: tiles.FeatureTiles.grass, tint: 0x55aa55 };
      case "water":
        return { tile: tiles.FeatureTiles.water, tint: 0x4488cc };
      case "chasm":
        return { tile: tiles.FeatureTiles.chasm, tint: 0x111111 };
      case "trap":
        return {
          tile: tiles.FeatureTiles.trap,
          tint: state.trap === "triggered" ? 0x666666 : 0xff4444
        };
      default:
        throw new Error(`Unknown terrain feature: ${state.feature}`);
    }
  }

  private syncFeatures() {
    const map = this.context.map;
    if (!map) return;

    const seen = new Set<string>();

    tiles.forEachFeature((x, y, state) => {
      const key = `${x},${y}`;
      seen.add(key);

      let sprite = this.featureSprites.get(key);
      const visual = this.featureVisual(state);
      const visible = state.feature !== "trap" || state.trap !== "hidden";

      if (!sprite) {
        sprite = this.add
          .sprite(map.tileToWorldX(x)!, map.tileToWorldY(y)!, "tiles", visual.tile)
          .setOrigin(0);
        sprite.setDepth(0);
        this.featureSprites.set(key, sprite);
      } else {
        sprite.setTexture("tiles", visual.tile);
      }

      if (visual.tint !== undefined) {
        sprite.setTint(visual.tint);
      } else {
        sprite.clearTint();
      }
      sprite.setVisible(visible);
    });

    for (const [key, sprite] of this.featureSprites) {
      if (!seen.has(key)) {
        sprite.destroy();
        this.featureSprites.delete(key);
      }
    }
  }

  private makeSparkTexture() {
    if (this.textures.exists("spark")) return;

    const g = this.make.graphics(undefined, false);
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 6, 6);
    g.generateTexture("spark", 6, 6);
    g.destroy();
  }

  private renderStairs(x: number, y: number) {
    this.stairsLabel?.destroy();

    if (!this.context.map) return;

    const isExit = this.context.floor >= this.context.maxFloor;
    const color = isExit ? 0x00ff00 : 0x00ffff;
    const wx = this.context.map.tileToWorldX(x)!;
    const wy = this.context.map.tileToWorldY(y)!;

    const g = this.add.graphics();
    g.fillStyle(color, 1);
    // Descending staircase drawn as narrowing steps.
    g.fillRect(wx + 1, wy + 1, 14, 3);
    g.fillRect(wx + 1, wy + 5, 11, 3);
    g.fillRect(wx + 1, wy + 9, 8, 3);
    g.fillRect(wx + 1, wy + 13, 5, 3);
    this.stairsLabel = g;
  }

  private spawnFloorContent(floor: number, levelArray: number[][], spawn: { x: number; y: number }) {
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
      context.entities.push(new FullHealPotion(context, 18, 23));
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
    const swarmCount = floor >= 2 ? 1 : 0;
    const mimicCount = floor >= 2 ? 1 : 0;
    const cultistCount = floor >= 3 ? 1 : 0;
    const elementalCount = floor >= 3 ? 1 : 0;
    const wraithCount = floor >= 3 ? 1 : 0;
    const itemCount = 3;

    const tiles = randomWalkableTiles(
      levelArray,
      skeletonCount + archerCount + ghoulCount + bruteCount + bossCount + quloptshCount +
        swarmCount + mimicCount + cultistCount + elementalCount + wraithCount + itemCount,
      exclude,
      MAX_VISIBLE_X
    );

    let i = 0;

    const spawnGroup = (Cls: any, count: number) => {
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
    spawnGroup(SwarmOfFlies, swarmCount);
    spawnGroup(Mimic, mimicCount);
    spawnGroup(Cultist, cultistCount);
    spawnGroup(Wraith, wraithCount);

    // Elementals: pick a random variant per spawn.
    for (let n = 0; n < elementalCount && i < tiles.length; n++, i++) {
      const Elemental = [FireElemental, IceElemental, ShockElemental][
        Math.floor(Math.random() * 3)
      ];
      context.entities.push(new Elemental(context, tiles[i].x, tiles[i].y));
    }

    const lootPool = [
      Sword,
      Axe,
      Bow,
      Shield,
      Gem,
      CursedGem,
      HolyPotion,
      FullHealPotion,
      MinorHealPotion,
      Shoe,
      ScrollOfIdentify,
      ScrollOfUpgrade,
      ScrollOfRemoveCurse,
      PotionOfHealing,
      PotionOfStrength,
      PotionOfInvisibility,
      PotionOfToxicGas,
      PotionOfLiquidFlame,
      PotionOfFrost,
      PotionOfLevitation,
      PotionOfExperience,
      ScrollOfTeleport,
      ScrollOfRage,
      ScrollOfTerror,
      ScrollOfRecharging,
      WandOfFirebolt,
      WandOfFrost,
      WandOfLightning,
      RingOfAccuracy,
      RingOfEvasion,
      RingOfElements,
      RingOfHaste,
      RingOfMight,
      ChaliceOfBlood,
      FangOfTheBeast,
      Ration,
      LargeRation
    ];
    for (let l = 0; l < itemCount && i < tiles.length; l++, i++) {
      const Loot = lootPool[Math.floor(Math.random() * lootPool.length)];
      context.entities.push(new Loot(context, tiles[i].x, tiles[i].y));
    }
  }

  private endGame(victory: boolean) {
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
