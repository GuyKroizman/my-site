import type { Entity } from "./entity";
import type BasicHero from "./classes/basicHero";

export type EndResult = {
  victory: boolean;
  floor: number;
  kills: number;
};

export type WandZap = {
  fromX: number; fromY: number; toX: number; toY: number;
  damageType: import('./effects').DamageType;
};

export type PoisonCloud = {
  x: number;
  y: number;
  expiresAt: number;
  nextTick: number;
  // Expansion/dissipation fields. Older saves may omit these; gas.ts treats
  // a missing `nextExpand` as "no further expansion" and a missing `bornAt` as
  // a legacy cloud that renders at full opacity.
  nextExpand?: number;
  radius?: number;
  bornAt?: number;
};

// One entry in the shared-tile inspect list: a visible entity or the terrain
// itself, so an item can never hide a trap (or vice versa).
export type InspectChoice =
  | { kind: "entity"; entity: Entity }
  | { kind: "terrain"; label: string; description: string };

export type GameContext = {
  map: Phaser.Tilemaps.Tilemap | undefined;
  currentLevel?: number[][];
  scene: Phaser.Scene | undefined;
  player?: BasicHero;
  entities: Entity[];
  messages: string[];
  // Discrete-event clock, in normal-action units (not wall-clock seconds).
  simulationTime?: number;
  floor: number;
  // Boss floors whose guardian has already been defeated. The stairs (and every
  // other route below) stay sealed until the current floor is in this set.
  bossesSlain?: Set<number>;
  // The one floor this run gives its chasm room to, rolled at run start from
  // mapgen's CHASM_ROOM_FLOORS and persisted in the run save. Shallower floors
  // never carry a chasm room; deeper floors only roll one rarely.
  chasmRoomFloor?: number;
  // Optional floor lighting override; deeper floors default to dark.
  darkLevel?: boolean;
  maxFloor: number;
  kills: number;
  heroClass: string;
  stairsX?: number;
  stairsY?: number;
  upstairsX?: number;
  upstairsY?: number;
  onAscend?: () => void;
  // Scene owns monster construction; terrain requests one bounded reinforcement.
  onSummonTrap?: (x: number, y: number) => boolean;
  // Fires after a real monster (never an item or decoy) is removed. The scene
  // uses it to keep every floor populated; called after death rewards/loot.
  onMonsterRemoved?: (entity: Entity) => void;
  // Frost effects notify terrain without coupling effect scheduling to rendering.
  onFrostTerrain?: (x: number, y: number) => number;
  onPotionSplash?: (event: { cells: Array<{ x: number; y: number }>; kind: 'fire' | 'frost' }) => void;
  // Called only after a successful shock hit has applied its primary damage.
  onShockWater?: (target: Entity, damage: number) => void;
  // Cosmetic secondary bolts; damage is resolved once by the shock splash.
  onShockArc?: (zap: WandZap) => void;
  poisonClouds?: PoisonCloud[];
  // Items (or an enemy's loot) that fell into a chasm, keyed by the floor they
  // will land on. The scene fills this queue when the receiving floor is built.
  chasmFallenItems?: Map<number, Entity[]>;
  onCreatePoisonGas?: (x: number, y: number) => number;
  onGasContact?: (actor: Entity) => void;
  nextTerrainEvent?: () => number;
  onTerrainEvent?: () => void;
  onSurpriseAttack?: (target: Entity) => void;
  onGrassBurn?: (cells: Array<{ x: number; y: number }>) => void;
  // Fired after the hero walks into tall grass and flattens it. The scene
  // decides whether the disturbed patch hides a glyph stone.
  onGrassTrampled?: (entity: Entity, x: number, y: number) => void;
  // `onImpact`, when provided, fires once the bolt head visually reaches its
  // destination so a wand kill lands on impact instead of on the firing frame.
  onWandZap?: (zap: WandZap, onImpact?: () => void) => void;
  // A shattered Liquid Flame flask may fuse two adjacent floor wands. Called
  // after the logical merge, for the flame/merge presentation only.
  onLiquidFlameShatter?: (event: {
    x: number;
    y: number;
    fusion?: import('./wandFusion').WandFusionResult;
  }) => void;
  // Store inventory lives outside floor entities and persists for the run.
  shop?: import('./store/shopModel').ShopState;
  storeOpen?: boolean;
  portal?: import('./store/portal').StorePortal;
  onPortalBump?: (x: number, y: number) => boolean;
  onStoreOpenChange?: (open: boolean) => void;
  inventoryOpen?: boolean;
  onChooseItemTarget?: (item: Entity) => void;
  heroModalOpen?: boolean;
  logModalOpen?: boolean;
  // Open while the potions/scrolls knowledge modal is showing.
  knowledgeOpen?: boolean;
  // Set by the UI scene; the React game menu uses it to open that modal.
  onOpenKnowledge?: () => void;
  confirmationOpen?: boolean;
  onConfirmChasm?: (warning: string, onConfirm: () => void) => void;
  helpOpen?: boolean;
  inspectChoices?: InspectChoice[];
  inspectedEntity?: Entity;
  // Terrain/tile description currently under the inspect cursor.
  inspectedTerrain?: string;
  visibleTiles: Set<string>;
  terrainActionMode?: boolean;
  inspectMode: boolean;
  // Inspect/throw cursor position (the highlighted tile).
  cursorX?: number;
  cursorY?: number;
  // Throw-targeting mode (entered from the inventory item modal).
  throwMode: boolean;
  throwItem?: Entity;
  // True while a two-finger pinch gesture is in progress (suppresses taps).
  pinching: boolean;
  // True while a one-finger camera pan is in progress (suppresses taps).
  panning: boolean;
  // True from the moment the current pointer gesture pans or pinches the map
  // until the next fresh press. A release at the end of such a gesture is not
  // a tap, even when the finger comes up over a HUD control (see tapGuard).
  mapGesture: boolean;
  // Notifies the React HUD when a Phaser-side keybinding toggles inspect mode.
  onInspectModeChange?: (mode: boolean) => void;
  // Requests a stairs descent (set by scene0; used by tap-to-descend).
  onDescend?: () => void;
  // Resolved by the scene after the current scheduler event, never mid-iteration.
  pendingFall?: boolean;
  // Set with pendingFall when a Stone of Blink pulls the hero through a chasm:
  // the scene descends without fall damage and places the hero elsewhere.
  pendingBlinkFall?: boolean;
  // Count of visible trap arrows still in flight. Their damage lands when the
  // arrow arrives, so the scheduler holds every later event until then.
  pendingTrapArrows?: number;
  // Re-centers the camera on the player after a free pan.
  onResumeFollow?: () => void;
  onEnd?: (result: EndResult) => void;
  savedRun?: import('./saveStorage').RunSave;
  // Phase 17 local-only dev tooling: an authored start state, set by the
  // dev-gated React scenario panel. Never written by the shipped flow, and
  // cleared once the first floor is built (the scenario covers the start only).
  scenario?: import('./scenario').Scenario;
  saveNow?: () => void;
  onSaveStatus?: (message: string) => void;
  onLoadError?: () => void;
};

export function isModalOpen(context: GameContext): boolean {
  return !!(context.storeOpen || context.inventoryOpen || context.heroModalOpen || context.logModalOpen || context.confirmationOpen || context.helpOpen ||
    context.knowledgeOpen ||
    context.inspectChoices?.length || context.inspectedEntity || context.inspectedTerrain);
}

// Resolves a pick from the inspect list into the modal's detail view.
export function applyInspectChoice(context: GameContext, choice: InspectChoice): void {
  context.inspectChoices = undefined;
  if (choice.kind === "terrain") {
    context.inspectedEntity = undefined;
    context.inspectedTerrain = choice.description;
    return;
  }
  context.inspectedTerrain = undefined;
  context.inspectedEntity = choice.entity;
}

// Removes one entity from an open inspect list (it may die while still listed).
export function forgetInspectedEntity(context: GameContext, entity: Entity): void {
  if (context.inspectedEntity === entity) {
    context.inspectedEntity = undefined;
  }
  const choices = context.inspectChoices;
  if (!choices?.some(choice => choice.kind === "entity" && choice.entity === entity)) return;
  const remaining = choices.filter(choice => choice.kind !== "entity" || choice.entity !== entity);
  context.inspectChoices = remaining.length ? remaining : undefined;
}

export function createGameContext(): GameContext {
  return {
    scene: undefined,
    map: undefined,
    currentLevel: undefined,
    entities: [],
    messages: [],
    visibleTiles: new Set(),
    inspectMode: false,
    throwMode: false,
    pinching: false,
    panning: false,
    mapGesture: false,
    simulationTime: 0,
    floor: 1,
    bossesSlain: new Set(),
    maxFloor: 25,
    kills: 0,
    heroClass: "Warrior",
    scenario: undefined,
    stairsX: undefined,
    stairsY: undefined
  };
}
