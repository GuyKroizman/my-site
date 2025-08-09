// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import Phaser from "phaser";
import { Scene0 } from "./scene0";
import { context } from "./context";

export const rogue0Config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "phaser",
  width: 80 * 16,
  height: 50 * 16,
  backgroundColor: "#472d3c",
  pixelArt: true,
  scene: [new Scene0(context)],
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
    }
  }
};
