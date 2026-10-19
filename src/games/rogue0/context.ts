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
  floor: number;
  maxFloor: number;
  kills: number;
  heroClass: string;
  stairsX?: number;
  stairsY?: number;
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
  // Notifies the React HUD when a Phaser-side keybinding toggles inspect mode.
  onInspectModeChange?: (mode: boolean) => void;
  onEnd?: (result: EndResult) => void;
};

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
    floor: 1,
    maxFloor: 5,
    kills: 0,
    heroClass: "Wizard",
    stairsX: undefined,
    stairsY: undefined
  };
}
