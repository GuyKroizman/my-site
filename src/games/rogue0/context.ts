// @ts-nocheck
import type { Entity } from "./entity";
import type BasicHero from "./classes/basicHero";

export type EndResult = {
  victory: boolean;
  floor: number;
  kills: number;
};

export type GameContext = {
  map: Phaser.Tilemaps.Tilemap | undefined;
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
  onEnd?: (result: EndResult) => void;
};

export function createGameContext(): GameContext {
  return {
    scene: undefined,
    map: undefined,
    entities: [],
    messages: [],
    floor: 1,
    maxFloor: 3,
    kills: 0,
    heroClass: "Wizard",
    stairsX: undefined,
    stairsY: undefined
  };
}
