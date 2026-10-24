import type { Entity } from "./entity";
import type BasicHero from "./classes/basicHero";

export type EndResult = {
  victory: boolean;
  floor: number;
  kills: number;
};

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
  inventoryOpen?: boolean;
  onChooseEnchantment?: (gem: Entity) => void;
  heroModalOpen?: boolean;
  logModalOpen?: boolean;
  helpOpen?: boolean;
  inspectChoices?: Entity[];
  inspectedEntity?: Entity;
  // Terrain/tile description currently under the inspect cursor.
  inspectedTerrain?: string;
  visibleTiles: Set<string>;
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
  // Notifies the React HUD when a Phaser-side keybinding toggles inspect mode.
  onInspectModeChange?: (mode: boolean) => void;
  // Requests a stairs descent (set by scene0; used by tap-to-descend).
  onDescend?: () => void;
  // Resolved by the scene after the current scheduler event, never mid-iteration.
  pendingFall?: boolean;
  // Re-centers the camera on the player after a free pan.
  onResumeFollow?: () => void;
  onEnd?: (result: EndResult) => void;
};

export function isModalOpen(context: GameContext): boolean {
  return !!(context.inventoryOpen || context.heroModalOpen || context.logModalOpen || context.helpOpen ||
    context.inspectChoices?.length || context.inspectedEntity || context.inspectedTerrain);
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
    simulationTime: 0,
    floor: 1,
    maxFloor: 5,
    kills: 0,
    heroClass: "Wizard",
    stairsX: undefined,
    stairsY: undefined
  };
}
