import Phaser from "phaser";
import { showSurpriseVisual, updateSurpriseVisuals, clearSurpriseVisuals } from './surpriseVisuals';
// Vite emits content-hashed URLs, so deployed art cannot reuse an older atlas.
import stoneTilesUrl from './assets/stone-tiles.png';
import stoneWallUrl from './assets/stone-wall.png';
import cryptTilesUrl from './assets/crypt-tiles.png';
import cryptWallUrl from './assets/crypt-wall.png';
import sandstoneTilesUrl from './assets/sandstone-tiles.png';
import sandstoneWallUrl from './assets/sandstone-wall.png';
import crystalTilesUrl from './assets/crystal-tiles.png';
import crystalWallUrl from './assets/crystal-wall.png';
import volcanicTilesUrl from './assets/volcanic-tiles.png';
import volcanicWallUrl from './assets/volcanic-wall.png';
import { dungeonThemeName } from './dungeonTheme';
import heroArtUrl from './assets/hero-color.png';
import cultistArtUrl from './assets/monsters/cultist.png';
import goblinArtUrl from './assets/monsters/goblin.png';
import grass0Url from './assets/tall-grass-0.png';
import grass1Url from './assets/tall-grass-1.png';
import grass2Url from './assets/tall-grass-2.png';
import { updateHeroAnimation } from './heroAnimation';
import { updateHeroBurning, clearHeroBurning } from './heroBurningVisuals';
import { updateHeroChilled, clearHeroChilled } from './heroChilledVisuals';
import { showWandZap, updateWandZaps, clearWandZaps } from './wandZapVisuals';
import { showGrassBurn, updateGrassBurns, clearGrassBurns } from './grassBurnVisuals';
import { showLiquidFlameShatter, clearWandFusionVisuals } from './wandFusionVisuals';
import { WATER_TEXTURE, generateWaterTexture, waterShoreMask, waterFrame } from './waterVisuals';
import {
  CHASM_TEXTURE, CHASM_MARGIN, CHASM_SIZE, CHASM_DEEP_TEXTURE, CHASM_DEEP_DEPTH,
  CHASM_SURFACE_DEPTH, chasmParallaxOffset, generateChasmTexture, generateChasmDeepTexture,
  chasmMask, chasmFrame
} from './chasmVisuals';
import { TRAP_ALPHA, TRAP_TEXTURE, generateTrapTextures, trapFrame } from './trapVisuals';
import { createPoisonGas, exposeToGas, nextGasEvent, tickGas, restoreGas } from "./gas";
import { updateGasVisuals, clearGasVisuals } from './gasVisuals';
import { removeEntity } from './entity';
import { decodeRunSave, restoreRunState, type RunState, type SavedFloor } from './runPersistence';
import { createForegroundAtlas, foregroundEntities, UPRIGHT_LIFT, worldDepth, doorPassage, wallOverhang, actorOriginY, fogFeatherRects, occludesPlayer } from './rendering';
import dungeon from "./dungeon";
import { isModalOpen, type GameContext } from "./context";
import { TurnManager } from "./turnManager";
import Skeleton from "./monsters/skelaton";
import { TieredWeapon, TieredArmor } from "./items/tieredEquipment";
import { bossSealsFloor, floorProgression, isBossFloor, lootTier } from "./progression";
import { createEquipmentFind, rollFloorEquipment, NON_REMAINS_EQUIPMENT_SCALE } from './equipmentFinds';
import { generateRemainsTexture } from './remainsTexture';
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
import { TILE_FOOTPRINT, footprintContains } from './footprint';
import type { Footprint } from './footprint';
import { actorFootprint } from './actorBodies';
import { actorIsVisible } from './actorVisibility';
import {
  firstFreeFootprintAnchor, footprintIsFree, nearestFreeFootprintAnchor,
  reserveFootprint, takeFootprintPlacement
} from './placement';
import Cultist from "./monsters/cultist";
import FireElemental, { IceElemental, ShockElemental } from "./monsters/elemental";
import Mimic from "./monsters/mimic";
import Chest from "./items/chest";
import SkeletalRemains from "./items/skeletalRemains";
import SwarmOfFlies from "./monsters/swarmOfFlies";
import DeadlyFrog from "./monsters/deadlyFrog";
import { updateMonsterSleepVisuals, clearMonsterSleepVisuals } from "./monsters/monsterSleepVisuals";
import Wraith from "./monsters/wraith";
import classes from "./classes";
import type Monster from "./monsters/monster";
import { reinforceFloor, type ReinforcementKind } from "./monsterReinforcements";
import {
  generateMap,
  findFarthestWalkable,
  randomWalkableTiles,
  floorRollsLevitationLoot
} from "./mapgen";
import type { ChasmRoom } from "./mapgen";
import { computeFOV, resolveVision } from "./fov";
import { hasEffect, removeEffect } from "./effects";
import { sfx } from "./audio";
import { generatePotionTextures, generateDoorThresholdTexture, generateUnknownItemTextures } from "./potionTextures";
import { generateGlyphStoneTextures } from './glyphStoneTextures';
import { dropTrampledGlyphStone } from './glyphStoneDrop';
import { decalFrameFor, flatDecalFrameFor, generateWallDecalTextures, DECAL_TEXTURE } from './wallDecals';
import { generateArmorTextures } from "./armorTextures";
import { prewarmConsumableAppearances, resetConsumableAppearances, saveConsumableKnowledge } from "./entity";
import type { Entity } from "./entity";
import { maybeCurse } from "./curses";
import { rollFoundUpgrade } from "./foundUpgrades";
import {
  applyScenarioHero,
  applyScenarioInventory,
  expandScenarioMonsters,
  finishScenarioInventory,
  scenarioReplacesPopulation,
  scenarioSummary,
} from './scenario';
import { encodeGraph } from './saveCodec';
import { saveRegistry } from './saveRegistry';
import { writeRunSave, clearRunSave } from './saveStorage';
import { generateFireElementalTexture } from './monsters/fireElementalTexture';
import { generateLightningElementalTexture } from './monsters/lightningElementalTexture';
import { generateIceElementalTexture } from './monsters/iceElementalTexture';
import { generateFlySwarmTexture } from './monsters/flySwarmTexture';
import { generateDeadlyFrogTexture } from './monsters/deadlyFrogTexture';
import { generateBossTexture } from './monsters/bossTexture';
import { generateWraithTexture } from './monsters/wraithTexture';
import { generateCultistBoltTexture, generateGoblinArrowTexture, generateTrapArrowTexture } from './projectileTextures';
import * as tiles from "./tiles";
import { terrainFor } from './terrain';
import { placeChasmFallen } from './chasmDrops';
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
  // Bone piles are the main gear source; random armor and weapons are a third
  // as likely as before.
  [TieredWeapon, 11 * NON_REMAINS_EQUIPMENT_SCALE],
  [TieredArmor, 4 * NON_REMAINS_EQUIPMENT_SCALE],
  [ScrollOfRemoveCurse, 3],
  [PotionOfFrost, 3],
  [PotionOfLiquidFlame, 3],
  [PotionOfToxicGas, 2],
  [PotionOfInvisibility, 2],
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

// The floor's random loot table. Levitation is deliberately absent while the
// dungeon still teaches the chasm rule through a chasm room: floors 1-7 only
// ever hand it out as that floor's guaranteed room reward. Once the teaching
// floors are behind the hero it joins ordinary loot, room or no room.
function floorLootTable(floor: number): Array<[LootClass, number]> {
  return floorRollsLevitationLoot(floor)
    ? [...LOOT_TABLE, [PotionOfLevitation, 2] as [LootClass, number]]
    : LOOT_TABLE;
}

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
  private readonly turnManager = new TurnManager({ hasEffect, removeEffect,
    log: (context, message) => dungeon.log(context, message) });
  private fog!: Phaser.GameObjects.Graphics;
  private seen: boolean[][] = [];
  private visible: Set<string> = new Set();
  private lastFovX?: number;
  private lastFovY?: number;

  private lastVisionState = "";
  private mindMarkers!: Phaser.GameObjects.Graphics;

  private getVision() {
    const player = this.context.player;
    const active = (id: string) => !!player && hasEffect(player, id);
    return resolveVision({
      dark: this.context.darkLevel ?? this.context.floor > 15,
      torch: active("torch"),
      magicalSight: active("magical-sight"),
      mindVision: active("mind-vision"),
      blinded: active("blinded")
    });
  }
  private featureSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private waterSprites = new Map<string, { sprite: Phaser.GameObjects.Sprite; x: number; y: number; mask: number }>();
  private lastWaterStep = -1;
  // Masked floor glimpsed at the bottom of chasms. It slides slower than the
  // world (parallax), so it is a sibling layer, not part of the rim sprites.
  private deepLayer?: Phaser.GameObjects.TileSprite;
  private chasmMaskGraphics?: Phaser.GameObjects.Graphics;
  private chasmMaskSignature = '';
  private wallSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  // Sparse wall decoration, keyed like the raised wall sprites above. Raised
  // faces (corridor side) and flat wall tops share the map; the flag keeps
  // their different anchoring and depth in sync when terrain changes.
  private wallDecals = new Map<string, { sprite: Phaser.GameObjects.Sprite; raised: boolean }>();
  private secretRoom?: Room;
  private chasmRoom?: ChasmRoom;
  // Middle of a boss floor's arena. The guardian is placed here, asleep, so the
  // hall stays a single open fight instead of a loot scatter.
  private bossArena?: { x: number; y: number };
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
      clearHeroChilled(this);
      clearWandZaps(this);
      clearWandFusionVisuals(this);
      clearGasVisuals(this);
      this.context.onGrassBurn = undefined;
      this.context.onWandZap = undefined;
      this.context.onLiquidFlameShatter = undefined;
      this.context.onMonsterRemoved = undefined;
      this.chasmMaskGraphics?.destroy();
      this.chasmMaskGraphics = undefined;
      this.deepLayer = undefined;
      this.chasmMaskSignature = '';
    });
    this.context.scene = this;
    resetConsumableAppearances(this.context);
    // Fix every potion/scroll appearance before loot exists, so a found item's
    // label always matches the knowledge page (a resumed run restores its own
    // saved mapping over this).
    prewarmConsumableAppearances(this.context);
    // Phase 17 dev tooling: an authored start state. `context.scenario` is only
    // ever set by the dev-gated React panel; the shipped flow leaves it
    // undefined and every branch below is the normal one.
    const scenario = this.context.scenario;
    this.context.floor = scenario
      ? Math.max(1, Math.min(this.context.maxFloor, Math.floor(scenario.floor)))
      : 1;
    this.context.kills = 0;
    this.context.chasmFallenItems = undefined;
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
    generateGoblinArrowTexture(this);
    generateCultistBoltTexture(this);
    generatePotionTextures(this);
    generateGlyphStoneTextures(this);
    generateArmorTextures(this);
    generateRemainsTexture(this);
    generateDoorThresholdTexture(this);
    generateWallDecalTextures(this);
    generateUnknownItemTextures(this);
    generateWaterTexture(this);
    generateChasmTexture(this);
    generateChasmDeepTexture(this);
    generateTrapTextures(this);

    // Restoring must not generate a floor or construct a hero: both reroll loot.
    let resumed: RunState | undefined;
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
      ? { levelArray: active.map, spawn: { x: resumed!.player.x!, y: resumed!.player.y! }, stairs: active.down }
      : this.generateLevel(this.context.floor);
    if (active) {
      this.context.floor = resumed!.floor;
      this.applyFeatures(active.features);
    }

    // Build the first map before creating the hero (its sprite needs the map).
    dungeon.initialize(this.context, levelArray);

    // Fog-of-war overlay drawn above tiles and entities.
    this.fog = this.add.graphics().setDepth(100);
    this.mindMarkers = this.add.graphics().setDepth(101);

    // Inspect/throw cursor, drawn above entities and fog.
    this.cursor = this.add.graphics().setDepth(300);

    // Door opens / grass burns / trap reveals all need to re-sync the overlay.
    dungeon.onTerrainChanged = () => this.syncFeatures();
    // Trampled grass can hide a glyph stone. It is left lying on the flattened
    // tile rather than stowed: moving off and back onto that tile picks it up
    // through the normal walk-onto-item flow.
    this.context.onGrassTrampled = (entity, x, y) => {
      const player = this.context.player;
      if (!player || entity !== player) return;
      const stone = dropTrampledGlyphStone(this.context, x, y);
      if (!stone) return;
      dungeon.log(this.context,
        `You uncover a ${stone.displayName} in the trampled grass. Step off and back onto the tile to pick it up.`);
    };
    this.context.onSurpriseAttack = (target) => showSurpriseVisual(this, target);
    this.context.onGrassBurn = cells => showGrassBurn(this, this.context, cells);
    this.context.onWandZap = (zap, onImpact) => showWandZap(this, this.context, zap, onImpact);
    this.context.onLiquidFlameShatter = event => {
      // Sound follows the drawn animation, so an off-screen shatter stays silent.
      if (showLiquidFlameShatter(this, this.context, event) && event.fusion) sfx.wandFusion();
    };

    const HeroClass = classes[this.context.heroClass as keyof typeof classes] ?? classes.Warrior;
    const player = resumed?.player ?? new HeroClass(this.context, spawn.x, spawn.y);
    this.context.player = player;
    // Scenario loadout is applied before setupFloor builds the floor: setupFloor
    // keeps `player` plus `player.getAllItems()` and drops everything else, and
    // its scheduler reset clears the equip action cost. A resumed run restores
    // its own hero instead, so a scenario never mixes with a saved run.
    if (scenario && !resumed) {
      applyScenarioHero(player, scenario);
      for (const warning of applyScenarioInventory(player, scenario)) {
        dungeon.log(this.context, `Scenario: ${warning}`);
      }
      finishScenarioInventory(this.context, player);
    }
    if (resumed) {
      this.floors = resumed.floors;
      restoreRunState(this.context, resumed);
      generateFireElementalTexture(this);
      generateLightningElementalTexture(this);
      generateIceElementalTexture(this);
      generateFlySwarmTexture(this);
      generateWraithTexture(this);
      generateDeadlyFrogTexture(this);
      generateBossTexture(this);
      player.bindInput();
      player.init(this.context, spawn.x, spawn.y);
      this.turnManager.time = resumed.time;
      this.turnManager.nextTick = resumed.nextTick;
    }
    player.sprite!.setDepth(worldDepth(player.sprite!.y, 'actor'));
    // setupFloor resets scheduler readiness for stair travel; a browser resume
    // restores exact deadlines instead, including fractional-speed actions.
    const deadlines = resumed ? [player, ...active!.entities].map(entity =>
      [entity, entity.nextActionTime, entity.actionReady] as const) : [];
    this.setupFloor(resumed?.floor ?? this.context.floor, levelArray, spawn, stairs, active);
    for (const [entity, time, ready] of deadlines) {
      entity.nextActionTime = time;
      entity.actionReady = ready;
    }
    if (scenario && !resumed) {
      // The scenario describes the starting floor only; descending from it
      // builds normal floors.
      this.context.scenario = undefined;
      dungeon.log(this.context, scenarioSummary(scenario,
        this.context.entities.filter(entity => entity.type === 'enemy').length));
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
    // Boss state is always tracked; only the normal (non-scenario) flow adds
    // the empty-floor reinforcement wave.
    this.context.onMonsterRemoved = entity => this.handleMonsterRemoved(entity, !scenario);
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
    this.updateDeepParallax();
    this.updateWater(this.time.now);
    updateWandZaps(this, this.context, this.time.now, isModalOpen(this.context));
    updateGrassBurns(this, this.context, this.time.now, isModalOpen(this.context));
    updateGasVisuals(this, this.context, this.time.now, isModalOpen(this.context));
    // Use interpolated sprite positions so walking/lunging actors swap order
    // smoothly, including monsters and items spawned after floor creation.
    const player = this.context.player;
    const playerSprite = player?.sprite;
    const playerBounds = playerSprite?.getBounds();
    const playerDepth = playerSprite ? worldDepth(playerSprite.y, 'actor') : 0;
    for (const entity of this.context.entities) {
      const sprite = entity.sprite;
      if (!sprite) continue;
      sprite.setDepth(worldDepth(sprite.y, entity.type === 'item' ? 'item' : 'actor'));
      // The scaled guardian's art can completely cover the hero. Fade only
      // the front actor so the player stays visible underneath it.
      if (entity === player || entity.type === 'item' || !playerSprite || !playerBounds) continue;
      const baseAlpha = hasEffect(entity, 'invisible') ? 0.4 : 1;
      const occluding = occludesPlayer(sprite.getBounds(), sprite.depth, playerBounds, playerDepth);
      sprite.setAlpha(occluding ? Math.min(baseAlpha, 0.45) : baseAlpha);
    }
    updateHeroAnimation(this.context.player, this.time.now);
    updateHeroBurning(this, this.context.player, this.time.now);
    updateHeroChilled(this, this.context.player, this.time.now);
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

    this.turnManager.update(this.context.entities);
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

  private decodeRun(): RunState {
    return decodeRunSave(this.context.savedRun!, this.context);
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
        (context.pendingTrapArrows ?? 0) > 0 ||
        context.entities.some(entity => entity.moving)) return;
    const now = performance.now();
    if (!force && this.lastSaveTime === context.simulationTime && now - this.lastSaveCheck < 250) return;
    this.lastSaveCheck = now;
    this.lastSaveTime = context.simulationTime ?? 0;
    try {
      this.saveFloor();
      const graph = encodeGraph({ player: context.player, floors: this.floors,
        floor: context.floor, kills: context.kills, messages: context.messages,
        time: this.turnManager.time, nextTick: this.turnManager.nextTick,
        knowledge: saveConsumableKnowledge(context),
        bossesSlain: context.bossesSlain ?? new Set(),
        // Items still falling toward a lower floor survive the checkpoint.
        chasmFallen: context.chasmFallenItems ?? new Map() }, saveRegistry);
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

    // Wands may be aimed past the edge of sight, so keep the cursor visible
    // even on an unlit tile; dim it to show that it lies outside current FOV.
    const inSight = this.visible.has(`${x},${y}`);
    const wx = ctx.map.tileToWorldX(x)!;
    const wy = ctx.map.tileToWorldY(y)!;
    const color = ctx.throwMode || ctx.terrainActionMode ? 0xff6a6a : 0xf0b429;
    this.cursor.lineStyle(2, color, inSight ? 1 : 0.4);
    this.cursor.strokeRect(wx + 1, wy + 1, 14, 14);
    this.cursor.fillStyle(color, inSight ? 0.18 : 0.08);
    this.cursor.fillRect(wx, wy, 16, 16);
  }

  private setupFloor(
    floor: number,
    levelArray: number[][],
    spawn: { x: number; y: number },
    stairs?: { x: number; y: number },
    restored?: SavedFloor
  ) {
    const tiles = terrainFor(this.context);
    clearMonsterSleepVisuals(this);
    clearSurpriseVisuals(this);
    clearGrassBurns(this);
    clearHeroBurning(this);
    clearHeroChilled(this);
    clearWandZaps(this);
    clearWandFusionVisuals(this);
    this.context.floor = floor;
    // A restored floor brings its own chasm-room population back from the
    // save; the generation-time room only describes the floor being built.
    if (restored) this.chasmRoom = undefined;
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
      stairs ??
      findFarthestWalkable(levelArray, spawn.x, spawn.y, MAX_VISIBLE_X, (x, y) =>
        tiles.getFeature(x, y) === "chasm");
    this.context.stairsX = stairsPos.x;
    this.context.stairsY = stairsPos.y;
    const up = restored?.up ?? spawn;
    this.context.upstairsX = up.x;
    this.context.upstairsY = up.y;
    this.renderStairs(stairsPos.x, stairsPos.y);

    this.syncFeatures();

    if (restored) {
      for (const entity of restored.entities) {
        // A saved creature may overlap the arrival point, a reshaped floor or
        // another restored body (older saves, resized content). Repair the
        // whole footprint to the nearest valid anchor instead of only checking
        // the exact spawn cell.
        if (entity.type !== 'item' && (entity.healthPoints ?? 0) > 0 &&
            entity.x !== undefined && entity.y !== undefined) {
          const footprint = actorFootprint(entity);
          const occupiedByActor = (tx: number, ty: number): boolean =>
            (this.context.entities ?? []).some(other =>
              other !== entity && other.type !== 'item' &&
              (other.healthPoints ?? 0) > 0 &&
              other.x !== undefined && other.y !== undefined &&
              footprintContains(actorFootprint(other), other.x, other.y, tx, ty));
          if (!footprintIsFree(levelArray, footprint, entity.x, entity.y,
              MAX_VISIBLE_X, tiles, occupiedByActor)) {
            const spot = nearestFreeFootprintAnchor(levelArray, footprint,
              entity.x, entity.y, MAX_VISIBLE_X, tiles, occupiedByActor);
            if (spot) {
              entity.x = spot.x;
              entity.y = spot.y;
            }
          }
        }
        const pausedTime = (this.context.simulationTime ?? 0) - restored.savedAt;
        for (const effect of entity.effects) {
          if (effect.nextTick !== undefined) effect.nextTick += pausedTime;
        }
        entity.init(this.context, entity.x, entity.y);
        this.context.entities.push(entity);
      }
    } else {
      if (this.context.scenario) this.spawnScenarioContent(floor, levelArray, spawn);
      else this.spawnFloorContent(floor, levelArray, spawn);
    }

    // A chasm is a chute: anything that fell in on the floor above lands at a
    // random walkable spot here, clear of the stairs and generated content.
    const reserved = new Set<string>();
    for (const entity of this.context.entities) {
      if (entity.x !== undefined && entity.y !== undefined) {
        reserveFootprint(reserved, actorFootprint(entity), entity.x, entity.y);
      }
    }
    for (const spot of [[this.context.stairsX, this.context.stairsY],
      [this.context.upstairsX, this.context.upstairsY]]) {
      if (spot[0] !== undefined && spot[1] !== undefined) reserved.add(`${spot[0]},${spot[1]}`);
    }
    // Loot dropped into the chasm above must not land on the chasm room's
    // island: that reward stays the chest the room placed there.
    this.reserveChasmRoomTiles(reserved);
    for (const item of placeChasmFallen(this.context, levelArray, reserved, MAX_VISIBLE_X)) {
      dungeon.log(this.context, `${item.displayName} lies on the floor, fallen from the chasm above.`);
    }

    // A boss floor with no guardian (a legacy save or an authored scenario)
    // was cleared before this rule existed. Never seal its stairs behind an
    // absent boss.
    if (isBossFloor(floor) && !this.context.entities.some(entity => entity instanceof Boss)) {
      if (!this.context.bossesSlain) this.context.bossesSlain = new Set();
      this.context.bossesSlain.add(floor);
    }

    this.turnManager.reset(this.context.entities, !!restored || floor > 1);
    this.recomputeFOV();
    // Older saves and saves from before this guard can contain a cleared floor.
    // Refill it on arrival rather than leaving the player with nothing to fight.
    if (restored) this.reinforceEmptyFloor();
    this.events.emit("floor-changed", { floor });
  }

  private generateLevel(floor = 1): {
    levelArray: number[][];
    spawn: { x: number; y: number };
    stairs: { x: number; y: number };
  } {
    const tiles = terrainFor(this.context);
    const generated = generateMap(floor);
    this.secretRoom = generated.secretRoom;
    this.chasmRoom = generated.chasmRoom;
    this.bossArena = generated.bossArena;
    const levelArray = generated.map;

    this.applyFeatures(generated.features);

    const spawnRoom =
      generated.rooms.find((r) => r.cx < MAX_VISIBLE_X) ?? generated.rooms[0];
    const spawn = generated.spawn ?? (spawnRoom
      ? { x: spawnRoom.cx, y: spawnRoom.cy }
      : this.findSpawn(levelArray));
    // A boss arena states its exit, so the stairs sit in the hall itself rather
    // than in the stub of the hidden branch above the north wall.
    const stairs = generated.stairs ?? findFarthestWalkable(
      levelArray, spawn.x, spawn.y, MAX_VISIBLE_X,
      (x, y) => tiles.getFeature(x, y) === "chasm");

    // Spawn and stairs must never sit on a terrain feature.
    tiles.clearFeature(spawn.x, spawn.y);
    tiles.clearFeature(stairs.x, stairs.y);

    return { levelArray, spawn, stairs };
  }

  private resolveFall() {
    if (!this.context.pendingFall) {
      this.context.pendingBlinkFall = false;
      return;
    }
    this.context.pendingFall = false;
    const blinkFall = this.context.pendingBlinkFall === true;
    this.context.pendingBlinkFall = false;
    this.context.terrainActionMode = false;
    const player = this.context.player;
    if (!player || player.healthPoints <= 0 || this.ended) return;
    player.inputBuffer = [];
    player.walkPath = [];
    player.cancelThrow();
    if (bossSealsFloor(this.context)) {
      player.actionReady = true;
      dungeon.log(this.context, blinkFall
        ? "The guardian's seal repels the Stone of Blink."
        : "The guardian's seal holds you above the abyss.");
      return;
    }
    if (this.context.floor >= this.context.maxFloor) {
      if (blinkFall) {
        dungeon.log(this.context, "The Stone of Blink vanishes into the abyss. There is no floor below.");
        return;
      }
      dungeon.log(this.context, "You fall into the abyss. There is no floor below!");
      player.takeDamage(player.healthPoints);
      removeEntity(this.context, player);
      return;
    }
    if (blinkFall) {
      // The stone is consumed by the throw; the hero is carried through the
      // chasm unharmed and set down at a random walkable spot below.
      this.descend();
      if (this.ended) return;
      const tile = player.x !== undefined && player.y !== undefined
        ? dungeon.randomWalkableTile(this.context, player.x, player.y)
        : null;
      if (tile) this.placePlayer(tile.x, tile.y);
      dungeon.log(this.context,
        `The Stone of Blink carries you unharmed to floor ${this.context.floor}.`);
      return;
    }
    const damage = Math.max(1, Math.ceil(player.maxHealthPoints / 3));
    this.descend();
    dungeon.log(this.context, `You fall to floor ${this.context.floor} and take ${damage} damage!`);
    player.takeDamage(damage);
    if (player.healthPoints <= 0) removeEntity(this.context, player);
  }

  private descend() {
    if (this.ended) return;

    if (bossSealsFloor(this.context)) {
      dungeon.log(this.context, this.context.floor >= this.context.maxFloor
        ? "The final guardian still lives. The dungeon will not release you."
        : "The way down is sealed. Slay this floor's guardian first.");
      return;
    }

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

    // Build the tilemap under the new floor's theme, not the floor we just
    // left. setupFloor re-assigns context.floor as well, but dungeon.initialize
    // reads it here to pick the tileset.
    this.context.floor = next;
    dungeon.initialize(this.context, levelArray);
    this.setupFloor(next, levelArray, spawn, stairs);
    sfx.stairs();
    dungeon.log(this.context, `You descend to floor ${next}.`);
  }

  private summonFromTrap(x: number, y: number): boolean {
    const tiles = terrainFor(this.context);
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

  private reinforcementActor(kind: ReinforcementKind, x: number, y: number): Monster {
    const context = this.context;
    switch (kind) {
      case "goblin": return new Goblin(context, x, y);
      case "swarm": return new SwarmOfFlies(context, x, y);
      case "frog": return new DeadlyFrog(context, x, y);
      case "quloptsh": return new Quloptsh(context, x, y);
      case "ghoul": return new Ghoul(context, x, y);
      case "brute": return new Brute(context, x, y);
      case "cultist": return new Cultist(context, x, y);
      case "wraith": return new Wraith(context, x, y);
      case "elemental": {
        const Elemental = [FireElemental, IceElemental, ShockElemental][
          Math.floor(Math.random() * 3)
        ];
        return new Elemental(context, x, y);
      }
      default: return new Skeleton(context, x, y);
    }
  }

  private handleMonsterRemoved(entity: Entity, reinforce: boolean): void {
    if (entity instanceof Boss) this.markBossSlain();
    if (reinforce && !this.ended) this.reinforceEmptyFloor();
  }

  private markBossSlain(): void {
    const context = this.context;
    const floor = context.floor;
    if (!context.bossesSlain) context.bossesSlain = new Set();
    context.bossesSlain.add(floor);
    if (floor >= context.maxFloor) {
      dungeon.log(context, "The final guardian falls. You have conquered the dungeon!");
      this.events.emit("player-won");
      return;
    }
    dungeon.log(context, "The guardian falls. The way down is no longer sealed.");
    if (context.stairsX !== undefined && context.stairsY !== undefined) {
      this.renderStairs(context.stairsX, context.stairsY);
    }
  }

  // A floor never stays empty. The death that removes the last monster draws a
  // small wave onto distant walkable tiles, preferably outside the hero's view.
  private reinforceEmptyFloor(): void {
    const context = this.context;
    if (this.ended || !context.player) return;
    // A boss floor stays empty once its guardian falls: the arena is never
    // repopulated behind the hero's back, matching its generated population.
    if (isBossFloor(context.floor)) return;
    const level = dungeon.getCurrentLevel();
    if (!level?.length) return;

    const exclude = new Set<string>();
    for (const entity of context.entities) {
      if (entity.x !== undefined && entity.y !== undefined) exclude.add(`${entity.x},${entity.y}`);
    }
    if (context.stairsX !== undefined && context.stairsY !== undefined) {
      exclude.add(`${context.stairsX},${context.stairsY}`);
    }
    if (context.upstairsX !== undefined && context.upstairsY !== undefined) {
      exclude.add(`${context.upstairsX},${context.upstairsY}`);
    }
    // Never repopulate the chasm room: its island is meant to be empty of
    // pursuers and its band is the only clean path to the guaranteed potion.
    this.reserveChasmRoomTiles(exclude);

    const candidates = randomWalkableTiles(
      level,
      Number.MAX_SAFE_INTEGER,
      exclude,
      MAX_VISIBLE_X,
      terrainFor(context)
    );
    // Do not drop a wave into an active gas cloud: exposure deaths would just
    // trigger another wave and could keep the scheduler cycling.
    const gasTiles = new Set((context.poisonClouds ?? []).map(cloud => `${cloud.x},${cloud.y}`));
    const spawned = reinforceFloor(context, candidates, (kind, x, y) => {
      const monster = this.reinforcementActor(kind, x, y);
      // Join the current timeline instead of arriving with overdue actions.
      monster.nextActionTime = context.simulationTime ?? 0;
      context.entities.push(monster);
    }, { floor: context.floor, blocked: (x, y) => gasTiles.has(`${x},${y}`) });

    if (spawned === 1) {
      dungeon.log(context, "Something stirs in the darkness elsewhere on this floor.");
    }
  }

  private saveFloor() {
    const player = this.context.player!;
    const carried = new Set([player, ...player.getAllItems()]);
    const features = terrainFor(this.context).snapshot();
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
    // dungeon.initialize chooses the tileset from context.floor, so switch to
    // the restored floor before rebuilding the tilemap.
    this.context.floor = floor;
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
          bossSealsFloor(this.context)
            ? "You stand on sealed stairs. The guardian of this floor still lives."
            : isExit
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
        (this.context.pendingTrapArrows ?? 0) > 0 ||
        this.context.entities.some(entity => entity.moving)) return;

    if (p.x === this.context.stairsX && p.y === this.context.stairsY) {
      this.descend();
    } else {
      dungeon.log(this.context, "You are not standing on the stairs.");
    }
  }

  private refreshFovIfNeeded() {
    const tiles = terrainFor(this.context);
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
    this.visible = computeFOV(map, p.x, p.y, vision.radius, vision.ignoreObstacles, terrainFor(this.context));
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

    this.fog.fillStyle(0x000000, this.context.floor <= 15 ? 0.3 : 0.55);
    for (const [x, y] of remembered) {
      this.fog.fillRect(x * t, y * t, t, t);
    }

    for (const edge of fogFeatherRects(this.seen)) {
      this.fog.fillStyle(0x000000, edge.alpha);
      this.fog.fillRect(edge.x, edge.y, edge.width, edge.height);
    }
  }

  private applyEntityVisibility() {
    const tiles = terrainFor(this.context);
    const player = this.context.player;
    const mindVision = this.getVision().mindVision;
    this.mindMarkers.clear();
    for (const [key, sprite] of this.wallSprites) {
      const [x, y] = key.split(',').map(Number);
      sprite.setVisible(this.seen[y]?.[x] === true);
    }
    // Decals follow their wall: remembered walls keep theirs, unknowns hide.
    for (const [key, decal] of this.wallDecals ?? []) {
      const [x, y] = key.split(',').map(Number);
      decal.sprite.setVisible(this.seen[y]?.[x] === true);
    }
    const foreground = foregroundEntities(this.context.entities, player);

    for (const entity of this.context.entities) {
      if (entity === player) continue;

      if (entity.x === undefined || entity.y === undefined) {
        entity.sprite?.setVisible(false);
        continue;
      }

      const seen = this.seen[entity.y]?.[entity.x] === true;
      // A wide body is concealed only when every occupied cell is hidden by
      // tall grass. Its exposed edge can be adjacent to the hero while its
      // centre is out of sight, so anchor-only checks made melee invisible.
      const visible = entity.type === 'enemy'
        ? actorIsVisible(entity, this.visible,
            (x, y) => tiles.isGrassConcealed(x, y, player?.x, player?.y))
        : this.visible.has(`${entity.x},${entity.y}`) &&
          !tiles.isGrassConcealed(entity.x, entity.y, player?.x, player?.y);

      // Monsters are only shown while actually visible; items stay
      // remembered (dimmed by fog) once discovered.
      const itemConcealed = tiles.isGrassConcealed(entity.x, entity.y, player?.x, player?.y);
      entity.sprite?.setVisible(foreground.has(entity) &&
        (entity.type === "enemy" ? visible : seen && !itemConcealed));
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

    terrainFor(this.context).restore(features);
  }

  private clearFeatureSprites() {
    this.waterSprites?.clear();
    // Scene instances built through the prototype (tests, save restore) skip
    // field initializers, so allocate lazily like waterSprites above.
    this.wallDecals ??= new Map();
    for (const sprite of this.featureSprites.values()) {
      sprite.destroy();
    }
    this.featureSprites.clear();
    for (const sprite of this.wallSprites.values()) sprite.destroy();
    this.wallSprites.clear();
    for (const decal of this.wallDecals.values()) decal.sprite.destroy();
    this.wallDecals.clear();
  }

  private featureVisual(state: tiles.TileState): {
    tile?: number;
    textureKey?: string;
    frame?: number;
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
        // Rim, cliff face and floor shadow atlas; the cell interior stays void.
        return { textureKey: CHASM_TEXTURE };
      case "trap":
        // One shared pressure plate; the glyph and its accent colour say which
        // kind it is, and a spent plate keeps the same silhouette drained of
        // colour. Hidden traps are simply not drawn (see syncFeatures).
        return {
          textureKey: TRAP_TEXTURE,
          frame: trapFrame(state.trapKind ?? 'dart', state.trap === 'triggered')
        };
      default:
        throw new Error(`Unknown terrain feature: ${state.feature}`);
    }
  }

  private syncFeatures() {
    const tiles = terrainFor(this.context);
    const map = this.context.map;
    if (!map) return;

    // Keep the opaque wall base in the tilemap. A raised copy extends its
    // north edge into the corridor and sorts in front of actors behind it.
    // Reconcile on terrain changes too (e.g. a secret wall becoming a door).
    const level = dungeon.getCurrentLevel();
    const theme = dungeonThemeName(this.context.floor);
    this.wallDecals ??= new Map();
    const wallKeys = new Set<string>();
    const raisedKeys = new Set<string>();
    for (let y = 0; y < level.length; y++) {
      for (let x = 0; x < level[y].length; x++) {
        if (level[y][x] !== 1) continue;
        const key = `${x},${y}`;
        wallKeys.add(key);
        const raised = wallOverhang(level, x, y);
        if (raised) {
          raisedKeys.add(key);
          if (!this.wallSprites.has(key)) {
            const sprite = this.add.sprite(x * 16, y * 16, `${theme}-wall`)
              .setOrigin(0, UPRIGHT_LIFT / 16)
              .setDepth(worldDepth(y * 16, 'terrain'));
            this.wallSprites.set(key, sprite);
          }
          this.wallSprites.get(key)!.setVisible(this.seen[y]?.[x] === true);
        }
        this.syncWallDecal(key, x, y, theme, raised);
      }
    }
    for (const [key, sprite] of this.wallSprites) {
      if (!raisedKeys.has(key)) { sprite.destroy(); this.wallSprites.delete(key); }
    }
    for (const [key, decal] of this.wallDecals) {
      if (!wallKeys.has(key)) { decal.sprite.destroy(); this.wallDecals.delete(key); }
    }

    const seen = new Set<string>();
    const chasmCells = new Set<string>();
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
        ? waterShoreMask(x, y, (nx, ny) => tiles.getFeature(nx, ny) === 'water')
        : state.feature === 'chasm'
          ? chasmMask(x, y, (nx, ny) => tiles.getFeature(nx, ny) === 'chasm')
          : 0;
      const frame = state.feature === 'water' ? waterFrame(mask, x, y, this.time.now)
        : state.feature === 'chasm' ? chasmFrame(mask)
        : visual.frame ?? (visual.textureKey ? 0 : (visual.tile ?? 0));

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
      if (state.feature === 'chasm') chasmCells.add(key);

      // Water, ice, traps and open thresholds remain flat. Grass and closed
      // doors have transparent silhouettes that overlap the preceding row.
      // All upright artwork is feet/root anchored, including doors. Moving
      // a 16px panel up by 5px left its bottom floating above the threshold.
      // The chasm atlas carries a 4px margin for its rim shadow, so its cell
      // is inset and the sprite origin must be shifted to match.
      const flatOrigin = state.feature === 'chasm' ? CHASM_MARGIN / CHASM_SIZE : 0;
      sprite.setOrigin(flatOrigin, upright ? actorOriginY(sprite.height) : flatOrigin);
      sprite.setDepth(upright ? worldDepth(sprite.y, 'terrain')
        : state.feature === 'chasm' ? CHASM_SURFACE_DEPTH : 0);
      if (visual.tint !== undefined) {
        sprite.setTint(visual.tint);
      } else {
        sprite.clearTint();
      }
      // Traps sit mostly transparent in the floor; every other feature is opaque.
      sprite.setAlpha(state.feature === 'trap' ? TRAP_ALPHA : 1);
      sprite.setVisible(visible);
    });

    for (const [key, sprite] of this.featureSprites) {
      if (!seen.has(key)) {
        sprite.destroy();
        this.featureSprites.delete(key);
      }
    }

    this.syncDeepLayer(chasmCells);
  }

  /** One mask per floor clipped to the chasm cells. Chasms never change, so
   * the mask is rebuilt only when the set changes (a new floor). */
  private syncDeepLayer(cells: Set<string>): void {
    if (cells.size === 0) {
      this.deepLayer?.setVisible(false);
      return;
    }
    const map = this.context.map;
    if (!map) return;

    if (!this.deepLayer) {
      this.deepLayer = this.add
        .tileSprite(0, 0, map.widthInPixels, map.heightInPixels, CHASM_DEEP_TEXTURE)
        .setOrigin(0, 0)
        .setDepth(CHASM_DEEP_DEPTH);
    } else if (this.deepLayer.width !== map.widthInPixels || this.deepLayer.height !== map.heightInPixels) {
      this.deepLayer.setPosition(0, 0).setSize(map.widthInPixels, map.heightInPixels);
    }
    this.deepLayer.setVisible(true);

    const signature = [...cells].sort().join('|');
    if (signature === this.chasmMaskSignature) return;
    this.chasmMaskSignature = signature;
    this.chasmMaskGraphics?.destroy();
    const mask = this.make.graphics({ x: 0, y: 0 }, false);
    mask.fillStyle(0xffffff, 1);
    for (const key of cells) {
      const [x, y] = key.split(',').map(Number);
      mask.fillRect(x * 16, y * 16, 16, 16);
    }
    this.chasmMaskGraphics = mask;
    this.deepLayer.setMask(mask.createGeometryMask());
    this.updateDeepParallax();
  }

  /** The hole is fixed in the world; the floor below slides at a fraction of
   * the camera speed, which is the whole depth illusion. */
  private updateDeepParallax(): void {
    const layer = this.deepLayer;
    if (!layer || !layer.visible) return;
    layer.tilePositionX = chasmParallaxOffset(this.cameras.main.scrollX);
    layer.tilePositionY = chasmParallaxOffset(this.cameras.main.scrollY);
  }

  /** One decal sprite per decorated wall cell. Raised faces share the wall
   * copy's lift and sit just above it (below actors north of it). Flat wall
   * tops sit just above the tilemap layer, under every actor and prop. */
  private syncWallDecal(key: string, x: number, y: number, theme: string, raised: boolean): void {
    this.wallDecals ??= new Map();
    const frame = raised ? decalFrameFor(theme, x, y) : flatDecalFrameFor(theme, x, y);
    const existing = this.wallDecals.get(key);
    if (frame === undefined) {
      if (existing) { existing.sprite.destroy(); this.wallDecals.delete(key); }
      return;
    }
    if (existing && existing.raised === raised) {
      // Theme swaps rebuild the wall sprites; keep the decal frame in step.
      if (existing.sprite.frame.name !== String(frame)) existing.sprite.setFrame(frame);
      return;
    }
    if (existing) { existing.sprite.destroy(); this.wallDecals.delete(key); }
    const sprite = this.add.sprite(x * 16, y * 16, DECAL_TEXTURE, frame)
      .setOrigin(0, raised ? UPRIGHT_LIFT / 16 : 0)
      .setDepth(raised ? worldDepth(y * 16, 'terrain') + 0.02 : 0.3)
      .setVisible(this.seen[y]?.[x] === true);
    this.wallDecals.set(key, { sprite, raised });
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
    // Arrow and dart traps fire the pale bow arrow; goblin archers use the same
    // 10x3 silhouette in their own palette.
    generateTrapArrowTexture(this);
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

    const sealed = isBossFloor(this.context.floor) &&
      !(this.context.bossesSlain?.has(this.context.floor) ?? false);
    const color = sealed ? 0xd9534f : 0x918b94;
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

  // Phase 17 dev tooling. "replace" skips the default spawner entirely rather
  // than deleting entities, so no loot or reinforcement guard ever runs for the
  // default population. "append" builds the normal floor and adds the list.
  private spawnScenarioContent(
    floor: number,
    levelArray: number[][],
    spawn: { x: number; y: number }
  ) {
    const scenario = this.context.scenario!;
    if (!scenarioReplacesPopulation(scenario)) {
      this.spawnFloorContent(floor, levelArray, spawn);
    }

    const placements = expandScenarioMonsters(scenario);
    if (!placements.length) return;

    const exclude = new Set([
      `${spawn.x},${spawn.y}`,
      `${this.context.stairsX},${this.context.stairsY}`,
      `${this.context.upstairsX},${this.context.upstairsY}`
    ]);
    for (const entity of this.context.entities) {
      if (entity.x !== undefined && entity.y !== undefined) exclude.add(`${entity.x},${entity.y}`);
    }
    // Reserve the hidden room: a boss parked behind a secret door is not a
    // test anyone asked for.
    if (this.secretRoom) {
      const room = this.secretRoom;
      for (let y = room.y; y < room.y + room.h + 2; y++) {
        for (let x = 0; x < levelArray[y].length; x++) exclude.add(`${x},${y}`);
      }
    }

    const terrain = terrainFor(this.context);
    const free = randomWalkableTiles(levelArray, placements.length * 3 + 12, exclude,
      MAX_VISIBLE_X, terrain);
    const used = new Set(exclude);

    // "near hero" is a ring search around the spawn, not a filter over random
    // tiles: a random sample of a whole floor almost never lands within six.
    // The inner radius keeps a monster from starting on top of the hero.
    const nearCell = (footprint: Footprint): { x: number; y: number } | undefined => {
      for (let radius = 2; radius <= 6; radius++) {
        const ring: Array<{ x: number; y: number }> = [];
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
            const x = spawn.x + dx;
            const y = spawn.y + dy;
            if (!footprintIsFree(levelArray, footprint, x, y, MAX_VISIBLE_X, terrain,
                (tx, ty) => used.has(`${tx},${ty}`))) continue;
            ring.push({ x, y });
          }
        }
        if (ring.length) return ring[Math.floor(Math.random() * ring.length)];
      }
      return undefined;
    };

    let placed = 0;
    for (const placement of placements) {
      const footprint = placement.footprint ?? TILE_FOOTPRINT;
      let cell = placement.near ? nearCell(footprint) : undefined;
      while (!cell && free.length) {
        const candidate = free.shift()!;
        if (footprintIsFree(levelArray, footprint, candidate.x, candidate.y,
            MAX_VISIBLE_X, terrain, (tx, ty) => used.has(`${tx},${ty}`))) cell = candidate;
      }
      if (!cell) break;
      reserveFootprint(used, footprint, cell.x, cell.y);
      const monster = new placement.cls(this.context, cell.x, cell.y) as Monster;
      if (placement.awake) {
        // Skip the 8–24 tick dormancy and let it hunt from the first frame.
        monster.sleepTurnsRemaining = 0;
        monster.awareOfPlayer = true;
      }
      this.context.entities.push(monster);
      placed += 1;
    }
    if (placed < placements.length) {
      dungeon.log(this.context,
        `Scenario: only ${placed} of ${placements.length} monsters found room on this floor.`);
    }
  }

  // The chasm room is reserved as a unit: its band must stay clear for the
  // approach potion, and nothing may be stranded on the island or route a
  // spawn onto the moat.
  private reserveChasmRoomTiles(reserved: Set<string>): void {
    const room = this.chasmRoom?.room;
    if (!room) return;
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) reserved.add(`${x},${y}`);
    }
  }

  private spawnFloorContent(floor: number, levelArray: number[][], spawn: { x: number; y: number }) {
    const context = this.context;

    const exclude = new Set([
      `${spawn.x},${spawn.y}`,
      `${this.context.stairsX},${this.context.stairsY}`
    ]);

    // A chasm room's island holds a chest that only levitation can reach, and
    // the walkable band carries the guaranteed Potion of Levitation that pays
    // for the crossing. The whole chamber is reserved so random loot, monsters
    // and terrain never crowd the approach or spill onto the island.
    if (this.chasmRoom) {
      const room = this.chasmRoom;
      this.reserveChasmRoomTiles(exclude);
      exclude.add(`${room.approach.x},${room.approach.y}`);
      exclude.add(`${room.reward.x},${room.reward.y}`);
      context.entities.push(new PotionOfLevitation(context, room.approach.x, room.approach.y));
      context.entities.push(new Chest(context, room.reward.x, room.reward.y));
    }

    // The hidden room holds a single ordinary upgrade gem at its center.
    // Reserve the whole room and its two-tile access corridor from random
    // content, so supplies/bosses cannot be stranded behind the secret or
    // overlap the gem. This method runs only on first generation; revisits
    // restore entities.
    if (this.secretRoom) {
      const room = this.secretRoom;
      for (let y = room.y; y < room.y + room.h + 2; y++) {
        for (let x = 0; x < levelArray[y].length; x++) exclude.add(`${x},${y}`);
      }
      context.entities.push(new Gem(context, room.cx, room.cy));
    }

    // Preserve the existing maximum encounter density rather than inflating
    // floor 25 to dozens of extra enemies just because the test run was shorter.
    const density = Math.min(floor, 5);
    const progression = floorProgression(floor);
    const progressionCount = progression.strengthPotions + progression.upgradeScrolls
      + Number(progression.weapon) + Number(progression.armor);
    // A boss floor is the guardian's arena: no other monster shares it, and no
    // scattered loot (random items, cursed gems or a bone pile) clutters it. The
    // guardian, the treasure chests, one ration and the hidden room's gem are
    // the floor's whole population, so the fight stays the floor's only event.
    const bossFloor = isBossFloor(floor);
    const roster = (count: number) => (bossFloor ? 0 : count);
    const skeletonCount = roster(2 + density);
    const goblinCount = roster(Math.max(0, density - 1));
    const ghoulCount = roster(floor >= 3 ? 1 : 0);
    const bruteCount = roster(floor >= 3 ? 1 : 0);
    const quloptshCount = roster(Math.max(0, density - 2));
    const swarmCount = roster(floor >= 2 ? 1 : 0);
    const mimicCount = roster(floor >= 2 ? 1 : 0);
    const chestCount = 2;
    const remainsCount = bossFloor ? 0 : 1;
    const equipmentCount = Number(rollFloorEquipment(floor));
    const cultistCount = roster(floor >= 3 ? 1 : 0);
    const elementalCount = roster(floor >= 3 ? 1 : 0);
    const wraithCount = roster(floor >= 3 ? 1 : 0);
    const frogCount = roster(floor >= 4 ? 1 : 0);
    const itemCount = bossFloor ? 0 : 3;
    const cursedGemCount = bossFloor ? 0 : (Math.random() < 0.2 ? 1 : 0);
    const foodCount = 1;

    // The guardian's own tile is reserved before anything else rolls: it waits
    // in the middle of the arena, and nothing else may stand there.
    const bossHome = bossFloor ? this.bossArena : undefined;
    // Legacy fixtures can load scene0 with a placeholder Boss class; fall back
    // to one tile when it carries no static footprint.
    const bossFootprint: Footprint = Boss.footprint ?? TILE_FOOTPRINT;
    if (bossHome) {
      // Reserve the guardian's full footprint so chests and the ration cannot
      // spawn inside the space the hero is not allowed to enter either. The
      // same helper reserves any future large creature's rectangle.
      reserveFootprint(exclude, bossFootprint, bossHome.x, bossHome.y);
    }

    const terrain = terrainFor(this.context);
    const tiles = randomWalkableTiles(
      levelArray,
      skeletonCount + goblinCount + ghoulCount + bruteCount + quloptshCount +
        swarmCount + mimicCount + cultistCount + elementalCount + wraithCount +
        frogCount +
        cursedGemCount + foodCount + itemCount + progressionCount + chestCount + remainsCount + equipmentCount,
      exclude,
      MAX_VISIBLE_X,
      terrain
    );

    const usedCells = new Set<string>();
    for (const entity of context.entities) {
      if (entity.x !== undefined && entity.y !== undefined) {
        reserveFootprint(usedCells, actorFootprint(entity), entity.x, entity.y);
      }
    }
    const blockedCell = (tx: number, ty: number): boolean =>
      usedCells.has(`${tx},${ty}`) || exclude.has(`${tx},${ty}`);

    const cursor = { index: 0 };
    // Only the shuffle of `tiles` is random; the quota is not. If a map cannot
    // fit the full roster, fall back to a deterministic row-major scan so
    // progression items (especially Scrolls of Upgrade) are never dropped.
    // Every anchor is validated for its whole footprint, then all of its cells
    // are reserved so two large bodies can never overlap.
    const takeCell = (footprint: Footprint = TILE_FOOTPRINT): { x: number; y: number } | undefined => {
      const cell = takeFootprintPlacement(tiles, cursor, footprint, levelArray,
        MAX_VISIBLE_X, terrain, blockedCell);
      if (cell) {
        reserveFootprint(usedCells, footprint, cell.x, cell.y);
        return cell;
      }
      const fallback = firstFreeFootprintAnchor(levelArray, footprint, MAX_VISIBLE_X,
        terrain, blockedCell);
      if (fallback) {
        reserveFootprint(usedCells, footprint, fallback.x, fallback.y);
        return fallback;
      }
      return undefined;
    };

    const spawnGroup = (Cls: any, count: number, footprint: Footprint = TILE_FOOTPRINT) => {
      for (let n = 0; n < count; n++) {
        const cell = takeCell(footprint);
        if (!cell) return;
        context.entities.push(new Cls(context, cell.x, cell.y));
      }
    };

    const spawnOne = (
      make: (x: number, y: number) => Entity, footprint: Footprint = TILE_FOOTPRINT
    ) => {
      const cell = takeCell(footprint);
      if (cell) context.entities.push(make(cell.x, cell.y));
    };

    // Reserve progression, food and the final boss before optional enemies.
    // This only runs on first generation; revisits restore the saved entities.
    spawnGroup(PotionOfStrength, progression.strengthPotions);
    const beforeScrolls = context.entities.length;
    spawnGroup(ScrollOfUpgrade, progression.upgradeScrolls);
    if (context.entities.length - beforeScrolls !== progression.upgradeScrolls) {
      dungeon.log(context, 'This floor could not fit all of its guaranteed Scrolls of Upgrade.');
    }
    for (const [Cls, enabled] of [[TieredWeapon, progression.weapon], [TieredArmor, progression.armor]] as const) {
      if (enabled) spawnOne((x, y) => {
        const item = new Cls(context, x, y, progression.tier);
        rollFoundUpgrade(item);
        return item;
      });
    }
    spawnGroup(Ration, foodCount);
    // The guardian stands in the middle of its arena rather than on a random
    // floor tile, and the Boss class keeps it asleep until it is disturbed.
    if (bossFloor) {
      const centerFree = bossHome !== undefined &&
        footprintIsFree(levelArray, bossFootprint, bossHome.x, bossHome.y,
          MAX_VISIBLE_X, terrain, (tx, ty) => usedCells.has(`${tx},${ty}`));
      const cell = centerFree ? bossHome : takeCell(bossFootprint);
      if (cell) {
        reserveFootprint(usedCells, bossFootprint, cell.x, cell.y);
        context.entities.push(new Boss(context, cell.x, cell.y));
      }
    }
    spawnGroup(Chest, chestCount);
    spawnGroup(SkeletalRemains, remainsCount);
    if (equipmentCount) spawnOne((x, y) => createEquipmentFind(context, x, y));

    spawnGroup(Skeleton, skeletonCount);
    spawnGroup(Quloptsh, quloptshCount);
    spawnGroup(Goblin, goblinCount);
    spawnGroup(Ghoul, ghoulCount);
    spawnGroup(Brute, bruteCount);
    spawnGroup(SwarmOfFlies, swarmCount);
    spawnGroup(Mimic, mimicCount);
    spawnGroup(Cultist, cultistCount);
    spawnGroup(Wraith, wraithCount);
    spawnGroup(DeadlyFrog, frogCount);

    // Elementals: pick a random variant per spawn.
    for (let n = 0; n < elementalCount; n++) {
      const Elemental = [FireElemental, IceElemental, ShockElemental][
        Math.floor(Math.random() * 3)
      ];
      spawnOne((x, y) => new Elemental(context, x, y));
    }

    // Cursed gem: can appear throughout the run.
    spawnGroup(CursedGem, cursedGemCount);

    // Random loot drawn from a weighted, SPD-style table. Upgrade scrolls are
    // deliberately absent from this table; their 15-per-run budget is fixed.
    const lootTable = floorLootTable(floor);
    for (let l = 0; l < itemCount; l++) {
      const Loot = weightedPick(lootTable);
      spawnOne((x, y) => {
        const item = Loot === TieredWeapon || Loot === TieredArmor
          ? new Loot(context, x, y, lootTier(floor))
          : new Loot(context, x, y);
        rollFoundUpgrade(item);
        maybeCurse(item);
        return item;
      });
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
