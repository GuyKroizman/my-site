import Phaser from "phaser";
import { showSurpriseVisual, updateSurpriseVisuals, clearSurpriseVisuals } from './surpriseVisuals';
// Vite emits content-hashed URLs, so deployed art cannot reuse an older atlas.
import stoneTilesUrl from '../../../public/rogue0/stone-tiles.png';
import stoneWallUrl from '../../../public/rogue0/stone-wall.png';
import cryptTilesUrl from '../../../public/rogue0/crypt-tiles.png';
import cryptWallUrl from '../../../public/rogue0/crypt-wall.png';
import sandstoneTilesUrl from '../../../public/rogue0/sandstone-tiles.png';
import sandstoneWallUrl from '../../../public/rogue0/sandstone-wall.png';
import crystalTilesUrl from '../../../public/rogue0/crystal-tiles.png';
import crystalWallUrl from '../../../public/rogue0/crystal-wall.png';
import volcanicTilesUrl from '../../../public/rogue0/volcanic-tiles.png';
import volcanicWallUrl from '../../../public/rogue0/volcanic-wall.png';
import { dungeonTheme } from './dungeonTheme';
import heroArtUrl from '../../../public/rogue0/hero-color.png';
import cultistArtUrl from '../../../public/rogue0/monsters/cultist.png';
import goblinArtUrl from '../../../public/rogue0/monsters/goblin.png';
import grass0Url from '../../../public/rogue0/tall-grass-0.png';
import grass1Url from '../../../public/rogue0/tall-grass-1.png';
import grass2Url from '../../../public/rogue0/tall-grass-2.png';
import { updateHeroAnimation } from './heroAnimation';
import { updateHeroBurning, clearHeroBurning } from './heroBurningVisuals';
import { showGrassBurn, updateGrassBurns, clearGrassBurns } from './grassBurnVisuals';
import { WATER_TEXTURE, generateWaterTexture, waterShoreMask, waterFrame } from './waterVisuals';
import { createPoisonGas, exposeToGas, nextGasEvent, tickGas, restoreGas } from "./gas";
import type { PoisonCloud } from "./context";
import { removeEntity, type Entity } from './entity';

type SavedFloor = {
  savedAt: number;
  poisonClouds?: PoisonCloud[];
  map: number[][];
  seen: boolean[][];
  features: FeaturePlacement[];
  entities: Entity[];
  up: { x: number; y: number };
  down: { x: number; y: number };
};
import { createForegroundAtlas, foregroundEntities, UPRIGHT_LIFT, worldDepth, doorPassage, wallOverhang, actorOriginY, fogFeatherRects } from './rendering';
import dungeon from "./dungeon";
import { isModalOpen, type GameContext } from "./context";
import turnManager from "./turnManager";
import Skeleton from "./monsters/skelaton";
import { TieredWeapon, TieredArmor } from "./items/tieredEquipment";
import { floorProgression, lootTier } from "./progression";
import CursedGem from "./items/cursedGem";
import Gem from './items/gem';
import type { Room } from './mapgen';
import HolyPotion from "./items/holyPotion";
import FullHealPotion from "./items/fullHealPotion";
import MinorHealPotion from "./items/minorHealPotion";
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
import Quloptsh from "./monsters/quloptsh";
import Goblin from "./monsters/goblin";
import Ghoul from "./monsters/ghoul";
import Brute from "./monsters/brute";
import Boss from "./monsters/boss";
import Cultist from "./monsters/cultist";
import FireElemental, { IceElemental, ShockElemental } from "./monsters/elemental";
import Mimic from "./monsters/mimic";
import SwarmOfFlies from "./monsters/swarmOfFlies";
import { updateMonsterSleepVisuals, clearMonsterSleepVisuals } from "./monsters/monsterSleepVisuals";
import Wraith from "./monsters/wraith";
import classes from "./classes";
import {
  generateMap,
  findFarthestWalkable,
  randomWalkableTiles
} from "./mapgen";
import { computeFOV, resolveVision } from "./fov";
import { hasEffect } from "./effects";
import { sfx } from "./audio";
import { generatePotionTextures, generateDoorThresholdTexture, generateUnknownItemTextures } from "./potionTextures";
import { resetConsumableAppearances, saveConsumableKnowledge, restoreConsumableKnowledge } from "./entity";
import { encodeGraph, decodeGraph } from './saveCodec';
import { saveRegistry } from './saveRegistry';
import { restoreEffects } from './saveEffects';
import { writeRunSave, clearRunSave } from './saveStorage';
import { generateFireElementalTexture } from './monsters/fireElementalTexture';
import { generateLightningElementalTexture } from './monsters/lightningElementalTexture';
import { generateFlySwarmTexture } from './monsters/flySwarmTexture';
import * as tiles from "./tiles";
import type { FeaturePlacement } from "./tiles";

// Keep the player spawn, stairs and procedural content out of the right-hand
// columns that sit underneath the UI sidebar.
const MAX_VISIBLE_X = 80;

// Map dimensions are read from the current floor so camera bounds follow its size.
// Empty margin added around the map so the camera can pan freely past the
// level edge (bringing the map clear of the bottom HUD) instead of stopping
// hard at the boundary.
const PAN_MARGIN = 16 * 16;

// Weighted SPD-style loot table: [item class, weight].
type LootClass = any;

const LOOT_TABLE: Array<[LootClass, number]> = [
  [Ration, 16],
  [MinorHealPotion, 8],
  [PotionOfHealing, 6],
  [HolyPotion, 4],
  [FullHealPotion, 4],
  [ScrollOfIdentify, 4],
  [TieredWeapon, 11],
  [TieredArmor, 4],
  [ScrollOfRemoveCurse, 3],
  [PotionOfFrost, 3],
  [PotionOfLiquidFlame, 3],
  [PotionOfToxicGas, 2],
  [PotionOfInvisibility, 2],
  [PotionOfLevitation, 2],
  [PotionOfExperience, 2],
  [ScrollOfTeleport, 2],
  [ScrollOfRage, 2],
  [ScrollOfTerror, 2],
  [ScrollOfRecharging, 2],
  [WandOfFirebolt, 2],
  [WandOfFrost, 2],
  [WandOfLightning, 2],
  [RingOfAccuracy, 2],
  [RingOfEvasion, 2],
  [RingOfElements, 2],
  [RingOfHaste, 2],
  [RingOfMight, 2],
  [ChaliceOfBlood, 1],
  [FangOfTheBeast, 1],
  [Shoe, 1]
];

function weightedPick(table: Array<[LootClass, number]>): LootClass {
  const total = table.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [cls, w] of table) {
    roll -= w;
    if (roll <= 0) return cls;
  }
  return table[0][0];
}

export class Scene0 extends Phaser.Scene {
  context: GameContext;
  private ended: boolean = false;
  private lastSaveCheck = 0;
  private lastSaveTime = -1;
  private lastSaveGraph = '';
  private stairsLabel?: Phaser.GameObjects.Graphics;
  private upstairsLabel?: Phaser.GameObjects.Graphics;
  private floors = new Map<number, SavedFloor>();
  private fog!: Phaser.GameObjects.Graphics;
  private seen: boolean[][] = [];
  private visible: Set<string> = new Set();
  private lastFovX?: number;
  private lastFovY?: number;

  private lastVisionState = "";
  private mindMarkers!: Phaser.GameObjects.Graphics;
  private gasOverlay?: Phaser.GameObjects.Graphics;

  private getVision() {
    const player = this.context.player;
    const active = (id: string) => !!player && hasEffect(player, id);
    return resolveVision({
      dark: this.context.darkLevel ?? this.context.floor > 5,
      torch: active("torch"),
      magicalSight: active("magical-sight"),
      mindVision: active("mind-vision"),
      blinded: active("blinded")
    });
  }
  private featureSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private waterSprites = new Map<string, { sprite: Phaser.GameObjects.Sprite; x: number; y: number; mask: number }>();
  private lastWaterStep = -1;
  private wallSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private secretRoom?: Room;
  private cursor!: Phaser.GameObjects.Graphics;
  private zoom = 2;
  private MIN_ZOOM = 0.2;
  private readonly MAX_ZOOM = 5;
  private activePointers = new Map<number, Phaser.Input.Pointer>();
  private lastPinchDist = 0;
  private stairsHinted = false;
  private panStartX = 0;
  private panStartY = 0;
  private panning = false;

  constructor(context: GameContext) {
    super("scene0");

    this.context = context;
  }

  preload() {
    this.load.image('hero-color', heroArtUrl);
    this.load.image('cultist', cultistArtUrl);
    this.load.image('goblin', goblinArtUrl);
    [grass0Url, grass1Url, grass2Url].forEach((url, i) => this.load.image(`tall-grass-${i}`, url));
    this.load.image('stone-tiles', stoneTilesUrl);
    this.load.image('stone-wall', stoneWallUrl);
    this.load.image('crypt-tiles', cryptTilesUrl);
    this.load.image('crypt-wall', cryptWallUrl);
    this.load.image('sandstone-tiles', sandstoneTilesUrl);
    this.load.image('sandstone-wall', sandstoneWallUrl);
    this.load.image('crystal-tiles', crystalTilesUrl);
    this.load.image('crystal-wall', crystalWallUrl);
    this.load.image('volcanic-tiles', volcanicTilesUrl);
    this.load.image('volcanic-wall', volcanicWallUrl);
    this.load.image("ration", "/rogue0/items/ration.png");
    this.load.image("chalice-of-blood", "/rogue0/items/chalice-of-blood.png");
    this.load.image("fang-of-the-beast", "/rogue0/items/fang-of-the-beast.png");
    for (const kind of ["fireball", "lightning", "identify", "upgrade", "remove-curse", "teleport", "rage", "terror", "recharging"]) {
      this.load.image(`scroll-${kind}`, `/rogue0/items/scroll-${kind}.png`);
    }
    this.load.image("unknown-scroll", "/rogue0/items/scroll.png");
    this.load.spritesheet("tiles", "/colored.png", {
      frameWidth: 16,
      frameHeight: 16,
      spacing: 1
    });
  }

  create() {
    createForegroundAtlas(this);
    this.events.once("shutdown", () => {
      clearMonsterSleepVisuals(this);
      clearSurpriseVisuals(this);
      clearGrassBurns(this);
      clearHeroBurning(this);
      this.context.onGrassBurn = undefined;
    });
    this.context.scene = this;
    resetConsumableAppearances(this.context);
    this.context.floor = 1;
    this.context.kills = 0;
    this.ended = false;

    if (!this.textures.exists("gold-pile")) {
      const coins = this.make.graphics({ x: 0, y: 0 });
      for (const [x, y] of [[5, 10], [11, 10], [8, 6]]) {
        coins.fillStyle(0x805018).fillEllipse(x, y + 1, 7, 5);
        coins.fillStyle(0xf0b429).fillEllipse(x, y, 7, 4);
        coins.fillStyle(0xffe49a).fillRect(x - 1, y - 1, 2, 1);
      }
      coins.generateTexture("gold-pile", 16, 16);
      coins.destroy();
    }

    this.makeSparkTexture();
    this.makeArrowTexture();
    generatePotionTextures(this);
    generateDoorThresholdTexture(this);
    generateUnknownItemTextures(this);
    generateWaterTexture(this);

    // Restoring must not generate a floor or construct a hero: both reroll loot.
    let resumed: any;
    if (this.context.savedRun) {
      try {
        resumed = this.decodeRun();
      } catch (error) {
        console.error('Cannot restore Rogue0 run', error);
        this.context.onSaveStatus?.('This saved run could not be loaded. Start a new game to replace it.');
        this.context.onLoadError?.();
        return;
      }
    }
    const active: SavedFloor | undefined = resumed?.floors.get(resumed.floor);
    const { levelArray, spawn, stairs } = active
      ? { levelArray: active.map, spawn: { x: resumed.player.x, y: resumed.player.y }, stairs: active.down }
      : this.generateLevel();
    if (active) {
      this.context.floor = resumed.floor;
      this.applyFeatures(active.features);
    }

    // Build the first map before creating the hero (its sprite needs the map).
    dungeon.initialize(this.context, levelArray);

    // Fog-of-war overlay drawn above tiles and entities.
    this.fog = this.add.graphics().setDepth(100);
    this.mindMarkers = this.add.graphics().setDepth(101);
    this.gasOverlay = this.add.graphics().setDepth(99);

    // Inspect/throw cursor, drawn above entities and fog.
    this.cursor = this.add.graphics().setDepth(300);

    // Door opens / grass burns / trap reveals all need to re-sync the overlay.
    dungeon.onTerrainChanged = () => this.syncFeatures();
    this.context.onCoverChanged = () => this.syncFeatures();
    this.context.onSurpriseAttack = (target) => showSurpriseVisual(this, target);
    this.context.onGrassBurn = cells => showGrassBurn(this, this.context, cells);

    const HeroClass = (classes as any)[this.context.heroClass] ?? classes.Wizard;
    const player = resumed?.player ?? new HeroClass(this.context, spawn.x, spawn.y);
    this.context.player = player;
    if (resumed) {
      this.floors = resumed.floors;
      this.context.floor = resumed.floor;
      this.context.kills = resumed.kills;
      this.context.messages = resumed.messages;
      this.context.simulationTime = resumed.time;
      restoreConsumableKnowledge(this.context, resumed.knowledge);
      generateFireElementalTexture(this);
      generateLightningElementalTexture(this);
      generateFlySwarmTexture(this);
      player.bindInput();
      player.init(this.context, spawn.x, spawn.y);
      turnManager.time = resumed.time;
      turnManager.nextTick = resumed.nextTick;
    }
    player.sprite!.setDepth(worldDepth(player.sprite!.y, 'actor'));
    // setupFloor resets scheduler readiness for stair travel; a browser resume
    // restores exact deadlines instead, including fractional-speed actions.
    const deadlines = resumed ? [player, ...active!.entities].map(entity =>
      [entity, entity.nextActionTime, entity.actionReady] as const) : [];
    this.setupFloor(resumed?.floor ?? 1, levelArray, spawn, stairs, active);
    for (const [entity, time, ready] of deadlines) {
      entity.nextActionTime = time;
      entity.actionReady = ready;
    }
    for (const entity of this.context.entities) {
      if (hasEffect(entity, 'invisible')) entity.sprite?.setAlpha(0.4);
    }
    this.context.savedRun = undefined;
    this.installAutosave();
    this.events.emit("entities-created");

    this.events.on("player-died", () => this.endGame(false));
    this.events.on("player-won", () => this.endGame(true));

    // Full-screen camera with empty panning margin around the map.
    this.cameras.main.startFollow(this.context.player!.sprite!);
    this.resizeCamera();
    this.scale.on("resize", () => this.resizeCamera());

    // Enable multi-touch (two-finger pinch zoom).
    this.input.addPointer(2);

    this.setupZoomControls();

    // Mobile/tap descend hook.
    this.context.onDescend = () => this.tryDescend();
    this.context.onAscend = () => this.tryAscend();
    this.context.onSummonTrap = (x, y) => this.summonFromTrap(x, y);
    this.context.onFrostTerrain = (x, y) => dungeon.freezeWater(this.context, x, y);
    this.context.onShockWater = (target, damage) => dungeon.conductShock(this.context, target, damage);
    this.context.onCreatePoisonGas = (x, y) => createPoisonGas(this.context, dungeon.getCurrentLevel(), x, y);
    this.context.onGasContact = actor => exposeToGas(this.context, actor);
    this.context.nextTerrainEvent = () => nextGasEvent(this.context);
    this.context.onTerrainEvent = () => tickGas(this.context);
    // Re-center the camera on the player after a free pan.
    this.context.onResumeFollow = () => this.resumeFollow();
  }

  private setupZoomControls(): void {
    // Mouse wheel (desktop): scroll up zooms in, down zooms out.
    this.input.on(
      "wheel",
      (_p: Phaser.Input.Pointer, _o: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
        this.zoomBy(dy > 0 ? 0.9 : 1.1);
      }
    );

    // Keyboard +/- as a convenience.
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") this.zoomBy(1.1);
      else if (e.key === "-" || e.key === "_") this.zoomBy(0.9);
    });

    // "." / ">" descends (or escapes) only while standing on the stairs.
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (e.key === ">" || e.key === ".") this.tryDescend();
      if (e.key === "<" || e.key === ",") this.tryAscend();
    });

    // Pinch zoom + one-finger pan (mobile).
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (isModalOpen(this.context)) return;
      this.activePointers.set(p.id, p);
      if (this.activePointers.size === 1) {
        this.panStartX = p.x;
        this.panStartY = p.y;
      }
      this.context.pinching = this.activePointers.size >= 2;
      this.lastPinchDist = 0;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (isModalOpen(this.context) || !this.activePointers.has(p.id)) return;
      if (this.activePointers.size >= 2) {
        this.updatePinch();
        return;
      }
      // Single finger: pan the camera once the drag exceeds a threshold.
      const dx = p.x - this.panStartX;
      const dy = p.y - this.panStartY;
      if (!this.panning && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        this.panning = true;
        this.context.panning = true;
        this.cameras.main.stopFollow();
      }
      if (this.panning) {
        this.cameras.main.scrollX -= dx / this.zoom;
        this.cameras.main.scrollY -= dy / this.zoom;
        this.panStartX = p.x;
        this.panStartY = p.y;
      }
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      this.activePointers.delete(p.id);
      this.lastPinchDist = 0;
      if (this.activePointers.size < 2) {
        this.time.delayedCall(150, () => (this.context.pinching = false));
      }
      if (this.activePointers.size === 0 && this.panning) {
        this.panning = false;
        this.context.panning = false;
        // Leave the camera where the player panned it.
      }
    });
    this.input.on("pointerout", (p: Phaser.Input.Pointer) => {
      if (this.activePointers.delete(p.id)) {
        this.lastPinchDist = 0;
        if (this.activePointers.size < 2) {
          this.time.delayedCall(150, () => (this.context.pinching = false));
        }
        if (this.activePointers.size === 0 && this.panning) {
          this.panning = false;
          this.context.panning = false;
          // Leave the camera where the player panned it.
        }
      }
    });
  }

  private resumeFollow(): void {
    if (!this.panning) {
      this.cameras.main.startFollow(this.context.player!.sprite!);
    }
  }

  private resizeCamera(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // Full-screen camera: the map renders underneath the HUD overlay.
    this.cameras.main.setViewport(0, 0, w, h);

    // Minimum zoom fits the whole floor (the margin is not required to fit).
    const map = dungeon.getCurrentLevel();
    const mapWidth = map[0].length * 16;
    const mapHeight = map.length * 16;
    this.cameras.main.setBounds(
      -PAN_MARGIN,
      -PAN_MARGIN,
      mapWidth + PAN_MARGIN * 2,
      mapHeight + PAN_MARGIN * 2
    );
    this.MIN_ZOOM = Math.max(0.15, Math.min(w / mapWidth, h / mapHeight));
    this.setZoom(this.zoom);
  }

  private updatePinch(): void {
    const pts = [...this.activePointers.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    if (this.lastPinchDist > 0 && dist > 0) {
      this.zoomBy(dist / this.lastPinchDist);
    }
    this.lastPinchDist = dist;
  }

  private zoomBy(factor: number): void {
    if (isModalOpen(this.context)) return;
    this.setZoom(this.zoom * factor);
  }

  private setZoom(value: number): void {
    this.zoom = Phaser.Math.Clamp(value, this.MIN_ZOOM, this.MAX_ZOOM);
    this.cameras.main.setZoom(this.zoom);
  }

  update() {
    if (this.ended) return;
    this.updateWater(this.time.now);
    updateGrassBurns(this, this.context, this.time.now, isModalOpen(this.context));
    // Use interpolated sprite positions so walking/lunging actors swap order
    // smoothly, including monsters and items spawned after floor creation.
    for (const entity of this.context.entities) {
      if (entity.sprite) entity.sprite.setDepth(worldDepth(entity.sprite.y, entity.type === 'item' ? 'item' : 'actor'));
    }
    updateHeroAnimation(this.context.player, this.time.now);
    updateHeroBurning(this, this.context.player, this.time.now);
    if (isModalOpen(this.context)) {
      this.autosave();
      if (this.context.player) {
        this.context.player.inputBuffer = [];
        this.context.player.walkPath = [];
      }
      this.activePointers.clear();
      this.lastPinchDist = 0;
      this.panning = false;
      this.context.panning = false;
      this.context.pinching = false;
      return;
    }

    turnManager.update(this.context.entities);
    if (this.context.pendingFall) {
      this.resolveFall();
      return;
    }
    this.checkStairs();
    this.refreshFovIfNeeded();
    updateMonsterSleepVisuals(this, this.context.entities, this.time.now);
    updateSurpriseVisuals(this, this.context, this.time.now);

    // Fast-forward animations while the player is waiting on buffered input.
    const p = this.context.player;
    this.tweens.timeScale = p && p.inputBuffer && p.inputBuffer.length > 0 ? 2 : 1;

    this.updateCursor();
    this.autosave();
  }

  private decodeRun() {
    const save = this.context.savedRun!;
    const run = decodeGraph(save.graph, saveRegistry, entity => {
      entity.context = this.context;
      // Older saves stored the scroll's former auto-use flags and description.
      // Refresh behavior metadata without changing its count or identification.
      if (entity instanceof ScrollOfUpgrade) {
        const defaults = new ScrollOfUpgrade(this.context);
        Object.assign(entity, {
          requiresItemTarget: defaults.requiresItemTarget,
          itemTargetTitle: defaults.itemTargetTitle,
          noItemTargetsMessage: defaults.noItemTargetsMessage,
          description: defaults.description,
        });
      }
      entity.effects = restoreEffects(entity.effects ?? [], entity.artifact);
      entity.moving = false;
      entity.tweens = 0;
      if (entity.type === 'player') {
        entity.inputBuffer = [];
        entity.walkPath = [];
        entity.acknowledgedWalkEnemies = new Set();
        entity.zapping = false;
      }
    });
    const Hero = (classes as any)[save.heroClass];
    if (!run || !(run.player instanceof Hero) || run.player.healthPoints <= 0 ||
        !(run.floors instanceof Map) || !run.floors.has(save.floor) || run.floor !== save.floor ||
        !Number.isFinite(run.time) || run.time < 0 || !Number.isFinite(run.nextTick) ||
        !Array.isArray(run.messages) || !Array.isArray(run.knowledge?.appearances) ||
        !Array.isArray(run.knowledge?.known)) throw new Error('Invalid saved run');
    for (const [floor, data] of run.floors) {
      if (!Number.isInteger(floor) || floor < 1 || floor > 25 ||
          !Array.isArray(data.map) || !data.map.length || data.map.length > 256 ||
          !data.map.every((row: unknown) => Array.isArray(row) && row.length === data.map[0].length && row.length <= 256 && row.every(Number.isFinite)) ||
          !Array.isArray(data.features) || !Array.isArray(data.entities) || !Array.isArray(data.seen) ||
          !Number.isFinite(data.savedAt) || !data.up || !data.down) throw new Error('Invalid saved floor');
    }
    const active = run.floors.get(run.floor);
    if (!Number.isInteger(run.player.x) || !Number.isInteger(run.player.y) ||
        active.map[run.player.y]?.[run.player.x] === undefined) throw new Error('Invalid saved position');
    return run;
  }

  private installAutosave() {
    const flush = () => this.autosave(true);
    const hidden = () => { if (document.visibilityState === 'hidden') flush(); };
    this.context.saveNow = flush;
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hidden);
    this.events.once('shutdown', () => {
      flush();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hidden);
      this.context.saveNow = undefined;
    });
    flush();
  }

  private autosave(force = false) {
    const context = this.context;
    // Animation callbacks may still land attacks or drops. Keep the previous
    // complete checkpoint rather than persisting a half-applied action.
    if (this.ended || !context.player || context.player.healthPoints <= 0 || context.pendingFall ||
        context.entities.some(entity => entity.moving)) return;
    const now = performance.now();
    if (!force && this.lastSaveTime === context.simulationTime && now - this.lastSaveCheck < 250) return;
    this.lastSaveCheck = now;
    this.lastSaveTime = context.simulationTime ?? 0;
    try {
      this.saveFloor();
      const graph = encodeGraph({ player: context.player, floors: this.floors,
        floor: context.floor, kills: context.kills, messages: context.messages,
        time: turnManager.time, nextTick: turnManager.nextTick,
        knowledge: saveConsumableKnowledge(context) }, saveRegistry);
      const serialized = JSON.stringify(graph);
      if (serialized === this.lastSaveGraph) return;
      if (!writeRunSave({ version: 1, heroClass: context.heroClass, floor: context.floor,
          savedAt: new Date().toISOString(), graph })) throw new Error('Browser storage unavailable');
      this.lastSaveGraph = serialized;
      context.onSaveStatus?.('Progress saved automatically on this browser.');
    } catch (error) {
      console.warn('Rogue0 autosave failed', error);
      context.onSaveStatus?.('Progress could not be saved. Browser storage may be full or blocked.');
    }
  }

  private updateCursor(): void {
    const ctx = this.context;
    if (!ctx.map) return;

    const active = ctx.inspectMode || ctx.throwMode || ctx.terrainActionMode;
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
    const color = ctx.throwMode || ctx.terrainActionMode ? 0xff6a6a : 0xf0b429;
    this.cursor.lineStyle(2, color, 1);
    this.cursor.strokeRect(wx + 1, wy + 1, 14, 14);
    this.cursor.fillStyle(color, 0.18);
    this.cursor.fillRect(wx, wy, 16, 16);
  }

  private setupFloor(
    floor: number,
    levelArray: number[][],
    spawn: { x: number; y: number },
    stairs?: { x: number; y: number },
    restored?: SavedFloor
  ) {
    clearMonsterSleepVisuals(this);
    clearSurpriseVisuals(this);
    clearGrassBurns(this);
    clearHeroBurning(this);
    this.context.floor = floor;
    this.context.poisonClouds = restoreGas(restored?.poisonClouds,
      restored ? (this.context.simulationTime ?? 0) - restored.savedAt : 0);
    this.resizeCamera();
    this.stairsHinted = false;

    this.seen = restored?.seen ?? [];
    this.visible = new Set();
    this.lastFovX = undefined;
    this.lastFovY = undefined;

    const player = this.context.player!;
    const kept = new Set([player, ...player.getAllItems()]);

    // Drop everything from the previous floor except the player and its gear.
    for (const entity of this.context.entities) {
      if (!kept.has(entity)) {
        if (entity.sprite) this.tweens.killTweensOf(entity.sprite);
        entity.sprite?.destroy();
        entity.sprite = undefined;
      }
    }

    this.context.entities = [player, ...player.getAllItems()];

    // The scheduler resets readiness below; floor changes do not tick hunger
    // or cooldowns without any elapsed simulation time.
    player.walkPath = [];
    player.inputBuffer = [];

    this.placePlayer(spawn.x, spawn.y);

    const stairsPos =
      stairs ?? findFarthestWalkable(levelArray, spawn.x, spawn.y, MAX_VISIBLE_X);
    this.context.stairsX = stairsPos.x;
    this.context.stairsY = stairsPos.y;
    const up = restored?.up ?? spawn;
    this.context.upstairsX = up.x;
    this.context.upstairsY = up.y;
    this.renderStairs(stairsPos.x, stairsPos.y);

    this.syncFeatures();

    if (restored) {
      for (const entity of restored.entities) {
        // A creature may have ended its last turn on the arrival staircase.
        // Move it to the nearest free floor cell rather than overlap the hero.
        if (entity.type === 'enemy' && entity.x === spawn.x && entity.y === spawn.y) {
          const candidates: { x: number; y: number }[] = [];
          levelArray.forEach((row, y) => row.forEach((cell, x) => {
            if (cell === 0 && !tiles.isBlocking(x, y) && (x !== spawn.x || y !== spawn.y) &&
                !restored.entities.some(other => other.type === 'enemy' && other !== entity && other.x === x && other.y === y)) {
              candidates.push({ x, y });
            }
          }));
          candidates.sort((a, b) => Math.hypot(a.x - spawn.x, a.y - spawn.y) - Math.hypot(b.x - spawn.x, b.y - spawn.y));
          if (candidates[0]) { entity.x = candidates[0].x; entity.y = candidates[0].y; }
        }
        const pausedTime = (this.context.simulationTime ?? 0) - restored.savedAt;
        for (const effect of entity.effects) {
          if (effect.nextTick !== undefined) effect.nextTick += pausedTime;
        }
        entity.init(this.context, entity.x, entity.y);
        this.context.entities.push(entity);
      }
    } else {
      this.spawnFloorContent(floor, levelArray, spawn);
    }

    turnManager.reset(this.context.entities, !!restored || floor > 1);
    this.recomputeFOV();
    this.events.emit("floor-changed", { floor });
  }

  private generateLevel(floor = 1): {
    levelArray: number[][];
    spawn: { x: number; y: number };
    stairs: { x: number; y: number };
  } {
    const generated = generateMap(floor);
    this.secretRoom = generated.secretRoom;
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

    return { levelArray, spawn, stairs };
  }

  private resolveFall() {
    if (!this.context.pendingFall) return;
    this.context.pendingFall = false;
    this.context.terrainActionMode = false;
    const player = this.context.player;
    if (!player || player.healthPoints <= 0 || this.ended) return;
    player.inputBuffer = [];
    player.walkPath = [];
    player.cancelThrow();
    if (this.context.floor >= this.context.maxFloor) {
      dungeon.log(this.context, "You fall into the abyss. There is no floor below!");
      player.takeDamage(player.healthPoints);
      removeEntity(this.context, player);
      return;
    }
    const damage = Math.max(1, Math.ceil(player.maxHealthPoints / 3));
    this.descend();
    dungeon.log(this.context, `You fall to floor ${this.context.floor} and take ${damage} damage!`);
    player.takeDamage(damage);
    if (player.healthPoints <= 0) removeEntity(this.context, player);
    else player.refreshUI();
  }

  private descend() {
    if (this.ended) return;

    if (this.context.floor >= this.context.maxFloor) {
      this.events.emit("player-won");
      return;
    }

    this.saveFloor();
    const next = this.context.floor + 1;
    const saved = this.floors.get(next);
    if (saved) {
      this.restoreFloor(next, saved, saved.up);
      sfx.stairs();
      dungeon.log(this.context, `You descend to floor ${next}.`);
      return;
    }
    const { levelArray, spawn, stairs } = this.generateLevel(next);

    dungeon.initialize(this.context, levelArray);
    this.setupFloor(next, levelArray, spawn, stairs);
    sfx.stairs();
    dungeon.log(this.context, `You descend to floor ${next}.`);
  }

  private summonFromTrap(x: number, y: number): boolean {
    const context = this.context;
    const map = dungeon.getCurrentLevel();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      const feature = tiles.getFeature(nx, ny);
      if (map[ny]?.[nx] !== 0 || (feature && feature !== "grass" && feature !== "water") ||
          (nx === context.stairsX && ny === context.stairsY) ||
          (nx === context.upstairsX && ny === context.upstairsY) ||
          context.entities.some(e => e.x === nx && e.y === ny)) continue;
      const skeleton = new Skeleton(context, nx, ny);
      skeleton.hearNoise(x, y);
      // Spawn on the current timeline, never with overdue actions from time zero.
      skeleton.nextActionTime = context.simulationTime ?? 0;
      context.entities.push(skeleton);
      return true;
    }
    return false;
  }

  private saveFloor() {
    const player = this.context.player!;
    const carried = new Set([player, ...player.getAllItems()]);
    const features: FeaturePlacement[] = [];
    tiles.forEachFeature((x, y, state) => features.push({ ...state, x, y }));
    this.floors.set(this.context.floor, {
      savedAt: this.context.simulationTime ?? 0,
      poisonClouds: (this.context.poisonClouds ?? []).map(cloud => ({ ...cloud })),
      map: dungeon.getCurrentLevel().map(row => [...row]),
      seen: this.seen.map(row => [...(row ?? [])]), features,
      entities: this.context.entities.filter(entity => !carried.has(entity)),
      up: { x: this.context.upstairsX!, y: this.context.upstairsY! },
      down: { x: this.context.stairsX!, y: this.context.stairsY! }
    });
  }

  private restoreFloor(floor: number, saved: SavedFloor, arrival: { x: number; y: number }) {
    this.applyFeatures(saved.features);
    dungeon.initialize(this.context, saved.map);
    this.setupFloor(floor, saved.map, arrival, saved.down, saved);
  }

  private tryAscend() {
    const p = this.context.player;
    if (this.ended || isModalOpen(this.context) || !p?.canAct() ||
        this.context.entities.some(entity => entity.moving)) return;
    if (p.x !== this.context.upstairsX || p.y !== this.context.upstairsY) {
      dungeon.log(this.context, 'You are not standing on the upstairs.');
      return;
    }
    const previous = this.context.floor - 1;
    const saved = this.floors.get(previous);
    if (!saved) {
      dungeon.log(this.context, 'The entrance is sealed. Find the exit below.');
      return;
    }
    this.saveFloor();
    this.restoreFloor(previous, saved, saved.down);
    sfx.stairs();
    dungeon.log(this.context, `You ascend to floor ${previous}.`);
  }

  private checkStairs() {
    const player = this.context.player;
    if (!player || player.x === undefined || player.y === undefined) return;

    // Standing on the stairs no longer descends automatically — just hint.
    if (player.x === this.context.stairsX && player.y === this.context.stairsY) {
      if (!this.stairsHinted) {
        this.stairsHinted = true;
        const isExit = this.context.floor >= this.context.maxFloor;
        dungeon.log(
          this.context,
          isExit
            ? "You stand on the exit. Press > (or .) to escape the dungeon."
            : "You stand on the stairs. Press > (or .) to descend."
        );
      }
    }
  }

  private tryDescend(): void {
    if (this.ended || isModalOpen(this.context)) return;
    const p = this.context.player;
    if (!p || p.x === undefined || p.y === undefined || !p.canAct() ||
        this.context.entities.some(entity => entity.moving)) return;

    if (p.x === this.context.stairsX && p.y === this.context.stairsY) {
      this.descend();
    } else {
      dungeon.log(this.context, "You are not standing on the stairs.");
    }
  }

  private refreshFovIfNeeded() {
    const p = this.context.player;
    if (!p || p.x === undefined || p.y === undefined) return;

    // Include effects, time and terrain: waiting, opening a door, burning grass,
    // and buff expiry must refresh sight even when the hero does not move.
    const terrain: string[] = [];
    tiles.forEachFeature((x, y, state) => terrain.push(`${x},${y}:${JSON.stringify(state)}`));
    const state = JSON.stringify([this.getVision(), this.context.simulationTime, terrain]);
    if (p.x !== this.lastFovX || p.y !== this.lastFovY || state !== this.lastVisionState) {
      this.lastVisionState = state;
      this.recomputeFOV();
    }
    this.applyEntityVisibility();
  }

  private recomputeFOV() {
    const p = this.context.player;
    if (!p || p.x === undefined || p.y === undefined) return;

    const map = dungeon.getCurrentLevel();
    const vision = this.getVision();
    this.visible = computeFOV(map, p.x, p.y, vision.radius, vision.ignoreObstacles);
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

    this.fog.fillStyle(0x000000, this.context.floor <= 5 ? 0.3 : 0.55);
    for (const [x, y] of remembered) {
      this.fog.fillRect(x * t, y * t, t, t);
    }

    for (const edge of fogFeatherRects(this.seen)) {
      this.fog.fillStyle(0x000000, edge.alpha);
      this.fog.fillRect(edge.x, edge.y, edge.width, edge.height);
    }
  }

  private applyEntityVisibility() {
    const player = this.context.player;
    const mindVision = this.getVision().mindVision;
    this.mindMarkers.clear();
    for (const [key, sprite] of this.wallSprites) {
      const [x, y] = key.split(',').map(Number);
      sprite.setVisible(this.seen[y]?.[x] === true);
    }
    this.gasOverlay?.clear();
    for (const cloud of this.context.poisonClouds ?? []) {
      if (cloud.expiresAt <= (this.context.simulationTime ?? 0) + 1e-9 || !this.visible.has(`${cloud.x},${cloud.y}`)) continue;
      this.gasOverlay?.fillStyle(0x88bb44, 0.4);
      this.gasOverlay?.fillRect(cloud.x * 16, cloud.y * 16, 16, 16);
    }
    const foreground = foregroundEntities(this.context.entities, player);

    for (const entity of this.context.entities) {
      if (entity === player) continue;

      if (entity.x === undefined || entity.y === undefined) {
        entity.sprite?.setVisible(false);
        continue;
      }

      const key = `${entity.x},${entity.y}`;
      const seen = this.seen[entity.y]?.[entity.x] === true;
      const concealed = tiles.isGrassConcealed(entity.x, entity.y, player?.x, player?.y);
      const visible = this.visible.has(key) && !concealed;

      // Monsters are only shown while actually visible; items stay
      // remembered (dimmed by fog) once discovered.
      entity.sprite?.setVisible(foreground.has(entity) && (entity.type === "enemy" ? visible : seen && !concealed));
      // Mark minds, not terrain: never add these cells to visible/seen or
      // targeting LOS. Markers sit above opaque fog, unlike normal sprites.
      if (mindVision && entity.type === "enemy" && entity.healthPoints > 0 && !visible) {
        this.mindMarkers.lineStyle(1, 0xd99bff, 1);
        this.mindMarkers.strokeCircle(entity.x * 16 + 8, entity.y * 16 + 8, 5);
        this.mindMarkers.fillStyle(0xd99bff, 1);
        this.mindMarkers.fillCircle(entity.x * 16 + 8, entity.y * 16 + 8, 2);
      }
    }

    if (this.context.upstairsX !== undefined && this.context.upstairsY !== undefined) {
      this.upstairsLabel?.setVisible(this.seen[this.context.upstairsY]?.[this.context.upstairsX] === true);
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
        blocksSight: f.blocksSight,
        trap: f.trap,
        trapKind: f.trapKind,
        trapReusable: f.trapReusable
      });
    }
  }

  private clearFeatureSprites() {
    this.waterSprites?.clear();
    for (const sprite of this.featureSprites.values()) {
      sprite.destroy();
    }
    this.featureSprites.clear();
    for (const sprite of this.wallSprites.values()) sprite.destroy();
    this.wallSprites.clear();
  }

  private featureVisual(state: tiles.TileState): {
    tile?: number;
    textureKey?: string;
    tint?: number;
  } {
    switch (state.feature) {
      case "secretDoor":
        return {};
      case "door":
        return state.door === "open"
          ? { textureKey: "door-threshold" }
          : { textureKey: 'door-front' };
      case "grass":
        return { textureKey: 'tall-grass-0' };
      case "water":
        return { textureKey: WATER_TEXTURE };
      case "ice":
        return { tile: tiles.FeatureTiles.water, tint: 0xbbeeff };
      case "chasm":
        return { tile: tiles.FeatureTiles.chasm, tint: 0x111111 };
      case "trap":
        return {
          tile: tiles.FeatureTiles.trap,
          tint: state.trap === "triggered" ? 0x666666 : state.trapKind === "arrow" ? 0xe8b34d : 0xff4444
        };
      default:
        throw new Error(`Unknown terrain feature: ${state.feature}`);
    }
  }

  private syncFeatures() {
    const map = this.context.map;
    if (!map) return;

    // Keep the opaque wall base in the tilemap. A raised copy extends its
    // north edge into the corridor and sorts in front of actors behind it.
    // Reconcile on terrain changes too (e.g. a secret wall becoming a door).
    const level = dungeon.getCurrentLevel();
    const wallKeys = new Set<string>();
    for (let y = 0; y < level.length; y++) {
      for (let x = 0; x < level[y].length; x++) {
        if (!wallOverhang(level, x, y)) continue;
        const key = `${x},${y}`;
        wallKeys.add(key);
        if (!this.wallSprites.has(key)) {
          const sprite = this.add.sprite(x * 16, y * 16, dungeonTheme(this.context.floor).wall)
            .setOrigin(0, UPRIGHT_LIFT / 16)
            .setDepth(worldDepth(y * 16, 'terrain'));
          this.wallSprites.set(key, sprite);
        }
        this.wallSprites.get(key)!.setVisible(this.seen[y]?.[x] === true);
      }
    }
    for (const [key, sprite] of this.wallSprites) {
      if (!wallKeys.has(key)) { sprite.destroy(); this.wallSprites.delete(key); }
    }

    const seen = new Set<string>();
    this.waterSprites ??= new Map();
    this.waterSprites.clear();

    tiles.forEachFeature((x, y, state) => {
      const key = `${x},${y}`;
      seen.add(key);

      let sprite = this.featureSprites.get(key);
      const sideDoor = state.feature === 'door' && doorPassage(dungeon.getCurrentLevel(), x, y) === 'horizontal';
      const visual = sideDoor
        ? { textureKey: state.door === 'open' ? 'door-threshold-side' : 'door-side' }
        : this.featureVisual(state);
      const visible = state.feature !== "secretDoor" && (state.feature !== "trap" || state.trap !== "hidden");
      const upright = state.feature === 'grass' || (state.feature === 'door' && state.door !== 'open');
      // Stable visual variation without consuming gameplay randomness.
      const texKey = state.feature === 'grass' ? `tall-grass-${(x * 7 + y * 11) % 3}`
        : visual.textureKey ?? (upright ? 'foreground-tiles' : 'tiles');
      const mask = state.feature === 'water'
        ? waterShoreMask(x, y, (nx, ny) => tiles.getFeature(nx, ny) === 'water') : 0;
      const frame = state.feature === 'water' ? waterFrame(mask, x, y, this.time.now)
        : visual.textureKey ? 0 : (visual.tile ?? 0);

      if (!sprite) {
        sprite = this.add
          .sprite(map.tileToWorldX(x)!, map.tileToWorldY(y)!, texKey, frame)
          .setOrigin(0);
        sprite.setDepth(0);
        this.featureSprites.set(key, sprite);
      } else {
        sprite.setTexture(texKey, frame);
      }

      if (state.feature === 'water') this.waterSprites.set(key, { sprite, x, y, mask });

      // Water, ice, traps and open thresholds remain flat. Grass and closed
      // doors have transparent silhouettes that overlap the preceding row.
      // All upright artwork is feet/root anchored, including doors. Moving
      // a 16px panel up by 5px left its bottom floating above the threshold.
      sprite.setOrigin(0, upright ? actorOriginY(sprite.height) : 0);
      sprite.setDepth(upright ? worldDepth(sprite.y, 'terrain') : 0);
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

  private updateWater(time: number): void {
    const step = Math.floor(time / 180);
    if (step === this.lastWaterStep) return;
    this.lastWaterStep = step;
    for (const { sprite, x, y, mask } of this.waterSprites.values()) {
      // Never change visibility or depth: fog and actors remain above the water.
      if (sprite.visible) sprite.setFrame(waterFrame(mask, x, y, time));
    }
  }

  private makeArrowTexture() {
    if (this.textures.exists("bow-arrow")) return;
    // Points right; the projectile rotates toward its target at launch.
    const g = this.make.graphics(undefined, false);
    g.fillStyle(0x30251c, 1);
    g.fillRect(2, 3, 12, 4);
    g.fillStyle(0xc99554, 1);
    g.fillRect(2, 4, 11, 2);
    g.fillStyle(0xe8e1d5, 1);
    g.fillTriangle(10, 1, 16, 5, 10, 9);
    g.fillStyle(0xb9cbd4, 1);
    g.fillTriangle(0, 1, 5, 4, 2, 4);
    g.fillTriangle(0, 9, 5, 6, 2, 6);
    g.generateTexture("bow-arrow", 16, 10);
    g.destroy();
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
    this.upstairsLabel?.destroy();

    if (!this.context.map) return;

    const color = 0x918b94;
    const wx = this.context.map.tileToWorldX(x)!;
    const wy = this.context.map.tileToWorldY(y)!;

    const g = this.add.graphics();
    g.fillStyle(color, 1);
    // Descending staircase drawn as narrowing steps.
    g.fillRect(wx + 3, wy + 3, 10, 2);
    g.fillRect(wx + 3, wy + 6, 8, 2);
    g.fillRect(wx + 3, wy + 9, 6, 2);
    g.fillRect(wx + 3, wy + 12, 4, 1);
    g.setDepth(0.5);
    this.stairsLabel = g;
    const ux = this.context.map.tileToWorldX(this.context.upstairsX!)!;
    const uy = this.context.map.tileToWorldY(this.context.upstairsY!)!;
    const up = this.add.graphics().setDepth(0.5);
    up.fillStyle(color, 1);
    up.fillRect(ux + 3, uy + 3, 4, 1);
    up.fillRect(ux + 3, uy + 5, 6, 2);
    up.fillRect(ux + 3, uy + 8, 8, 2);
    up.fillRect(ux + 3, uy + 11, 10, 2);
    this.upstairsLabel = up;
  }

  private spawnFloorContent(floor: number, levelArray: number[][], spawn: { x: number; y: number }) {
    const context = this.context;

    const exclude = new Set([
      `${spawn.x},${spawn.y}`,
      `${this.context.stairsX},${this.context.stairsY}`
    ]);

    // The hidden room has exactly four ordinary upgrade gems. Reserve the
    // whole room and its two-tile access corridor from random content, so
    // supplies/bosses cannot be stranded behind the secret or overlap gems.
    // This method runs only on first generation; revisits restore entities.
    if (this.secretRoom) {
      const room = this.secretRoom;
      for (let y = room.y; y < room.y + room.h + 2; y++) {
        for (let x = 0; x < levelArray[y].length; x++) exclude.add(`${x},${y}`);
      }
      for (const x of [room.x, room.x + room.w - 1]) {
        for (const y of [room.y, room.y + room.h - 1]) {
          context.entities.push(new Gem(context, x, y));
        }
      }
    }

    // Preserve the existing maximum encounter density rather than inflating
    // floor 25 to dozens of extra enemies just because the test run was shorter.
    const density = Math.min(floor, 5);
    const progression = floorProgression(floor);
    const progressionCount = progression.strengthPotions + progression.upgradeScrolls
      + Number(progression.weapon) + Number(progression.armor);
    const skeletonCount = 2 + density;
    const goblinCount = Math.max(0, density - 1);
    const ghoulCount = floor >= 3 ? 1 : 0;
    const bruteCount = floor >= 3 ? 1 : 0;
    const bossCount = floor === this.context.maxFloor ? 1 : 0;
    const quloptshCount = Math.max(0, density - 2);
    const swarmCount = floor >= 2 ? 1 : 0;
    const mimicCount = floor >= 2 ? 1 : 0;
    const cultistCount = floor >= 3 ? 1 : 0;
    const elementalCount = floor >= 3 ? 1 : 0;
    const wraithCount = floor >= 3 ? 1 : 0;
    const itemCount = 3;
    const cursedGemCount = Math.random() < 0.2 ? 1 : 0;
    const foodCount = 1;

    const tiles = randomWalkableTiles(
      levelArray,
      skeletonCount + goblinCount + ghoulCount + bruteCount + bossCount + quloptshCount +
        swarmCount + mimicCount + cultistCount + elementalCount + wraithCount +
        cursedGemCount + foodCount + itemCount + progressionCount,
      exclude,
      MAX_VISIBLE_X
    );

    let i = 0;

    const spawnGroup = (Cls: any, count: number) => {
      for (let n = 0; n < count && i < tiles.length; n++, i++) {
        context.entities.push(new Cls(context, tiles[i].x, tiles[i].y));
      }
    };

    // Reserve progression, food and the final boss before optional enemies.
    // This only runs on first generation; revisits restore the saved entities.
    spawnGroup(PotionOfStrength, progression.strengthPotions);
    spawnGroup(ScrollOfUpgrade, progression.upgradeScrolls);
    for (const [Cls, enabled] of [[TieredWeapon, progression.weapon], [TieredArmor, progression.armor]] as const) {
      if (enabled && i < tiles.length) {
        context.entities.push(new Cls(context, tiles[i].x, tiles[i].y, progression.tier));
        i++;
      }
    }
    spawnGroup(Ration, foodCount);
    spawnGroup(Boss, bossCount);

    spawnGroup(Skeleton, skeletonCount);
    spawnGroup(Quloptsh, quloptshCount);
    spawnGroup(Goblin, goblinCount);
    spawnGroup(Ghoul, ghoulCount);
    spawnGroup(Brute, bruteCount);
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

    // Cursed gem: can appear throughout the run.
    spawnGroup(CursedGem, cursedGemCount);

    // Random loot drawn from a weighted, SPD-style table.
    for (let l = 0; l < itemCount && i < tiles.length; l++, i++) {
      const Loot = weightedPick(LOOT_TABLE);
      context.entities.push(Loot === TieredWeapon || Loot === TieredArmor
        ? new Loot(context, tiles[i].x, tiles[i].y, lootTier(floor))
        : new Loot(context, tiles[i].x, tiles[i].y));
    }
  }

  private endGame(victory: boolean) {
    if (this.ended) return;
    this.ended = true;
    if (!clearRunSave()) this.context.onSaveStatus?.('Unable to clear the completed save. Browser storage is blocked.');

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
