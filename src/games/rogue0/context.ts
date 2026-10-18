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
  visibleTiles: Set<string>;
  inspectMode: boolean;
  // Inspect/throw cursor position (the highlighted tile).
  cursorX?: number;
  cursorY?: number;
  // Throw-targeting mode (entered from the inventory item modal).
  throwMode: boolean;
  throwItem?: Entity;
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
    floor: 1,
    maxFloor: 3,
    kills: 0,
    heroClass: "Wizard",
    stairsX: undefined,
    stairsY: undefined
  };
}
