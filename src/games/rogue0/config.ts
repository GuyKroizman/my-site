// TypeScript errors after site migration - ignoring for game functionality
import Phaser from "phaser";
import { Scene0 } from "./scene0";
import type { GameContext } from "./context";

export function createRogue0Config(context: GameContext): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: "phaser",
    width: 80 * 16,
    height: 50 * 16,
    backgroundColor: "#000000",
    pixelArt: true,
    scene: [new Scene0(context)],
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
      }
    }
  };
}
