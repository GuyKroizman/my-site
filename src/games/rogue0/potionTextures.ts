// Runtime-generated potion flask textures.
//
// The Kenney tilesheet only has a green potion flask (and a heart that reads
// as an apple), so we draw crisp, colored flasks ourselves and store them as
// named single-frame textures. Potion items point at these via `textureKey`.
import Phaser from "phaser";

export const POTION_COLORS = {
  red: 0xe04a3a,
  green: 0x35c75f,
  blue: 0x3d8bff,
  gold: 0xf0b429,
  purple: 0x9b59ff
} as const;

export function generatePotionTextures(scene: Phaser.Scene): void {
  const entries: Array<[string, number]> = [
    ["potion-red", POTION_COLORS.red],
    ["potion-green", POTION_COLORS.green],
    ["potion-blue", POTION_COLORS.blue],
    ["potion-gold", POTION_COLORS.gold],
    ["potion-purple", POTION_COLORS.purple]
  ];

  for (const [key, color] of entries) {
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics(undefined, false);
    drawFlask(g, color);
    g.generateTexture(key, 16, 16);
    g.destroy();
  }
}

// Draws a 16x16 round-bottom flask: cork, glass neck + bulb, colored liquid,
// a dark outline, and a glass shine.
function drawFlask(g: Phaser.GameObjects.Graphics, liquid: number): void {
  // Cork.
  g.fillStyle(0x8a5a2b, 1);
  g.fillRect(6, 0, 4, 2);

  // Glass neck + bulb (light, translucent blue-gray).
  g.fillStyle(0xdceaf2, 1);
  g.fillRect(6, 2, 4, 2);
  g.fillCircle(8, 9, 6);

  // Colored liquid inside the bulb.
  g.fillStyle(liquid, 1);
  g.fillCircle(8, 10, 4);

  // Outline for definition.
  g.lineStyle(1, 0x5a707e, 1);
  g.strokeCircle(8, 9, 6);
  g.strokeRect(6, 2, 4, 2);

  // Shine highlight.
  g.fillStyle(0xffffff, 0.55);
  g.fillRect(6, 7, 2, 3);
}
