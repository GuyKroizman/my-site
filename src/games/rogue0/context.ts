// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import type { Entity } from "entity";
import type BasicHero from "./classes/basicHero";

export type GameContext = {
  map: Phaser.Tilemaps.Tilemap | undefined;
  scene: Phaser.Scene | undefined;
  player?: BasicHero;
  entities: Entity[];
  messages: string[];
};

export const context: GameContext = { scene: undefined, map: undefined, entities: [], messages: [] };
