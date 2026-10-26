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
  // Enough distinct colors for every potion name, including legacy potions.
  // Entity assigns these randomly without replacement for each run.
  const colors = [
    POTION_COLORS.red, POTION_COLORS.green, POTION_COLORS.blue,
    POTION_COLORS.gold, POTION_COLORS.purple, 0x28d9da,
    0xff8c32, 0xf276bb, 0xb7e342, 0xf0eee0, 0x82502e, 0x686878
  ];

  colors.forEach((color, i) => {
    const key = `potion-${i}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const g = scene.make.graphics(undefined, false);
    drawFlask(g, color);
    g.generateTexture(key, 16, 16);
    g.destroy();
  });
}

// Generic "unidentified" icons — one per item category, so the inventory can
// tell a potion from a scroll (etc.) without revealing what it actually is.
export function generateUnknownItemTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists("unknown-potion")) {
    const g = scene.make.graphics(undefined, false);
    drawFlask(g, 0x9a9a9a);
    g.generateTexture("unknown-potion", 16, 16);
    g.destroy();
  }
  if (!scene.textures.exists("unknown-scroll")) {
    const g = scene.make.graphics(undefined, false);
    g.fillStyle(0xd8d0c0, 1);
    g.fillRect(3, 3, 10, 10);
    g.fillStyle(0x8a8274, 1);
    g.fillRect(3, 3, 10, 2);
    g.fillRect(3, 11, 10, 2);
    g.generateTexture("unknown-scroll", 16, 16);
    g.destroy();
  }
  // Keep the same wand silhouette before and after identification.
  const wandColors: Record<string, number> = {
    "unknown-wand": 0x9a9a9a,
    "wand-fire": 0xff793f,
    "wand-ice": 0x80dfff,
    "wand-shock": 0xffe36b
  };
  for (const [key, color] of Object.entries(wandColors)) {
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics(undefined, false);
    g.lineStyle(2, 0x8a5a2b, 1);
    g.lineBetween(3, 13, 12, 4);
    g.fillStyle(color, 1);
    g.fillCircle(13, 3, 2);
    g.generateTexture(key, 16, 16);
    g.destroy();
  }
  if (!scene.textures.exists("unknown-ring")) {
    const g = scene.make.graphics(undefined, false);
    g.lineStyle(2, 0xc9a227, 1);
    g.strokeCircle(8, 8, 5);
    g.generateTexture("unknown-ring", 16, 16);
    g.destroy();
  }
  if (!scene.textures.exists("unknown-artifact")) {
    const g = scene.make.graphics(undefined, false);
    g.fillStyle(0x8b6fae, 1);
    g.fillTriangle(8, 1, 15, 8, 8, 15);
    g.fillTriangle(8, 1, 1, 8, 8, 15);
    g.generateTexture("unknown-artifact", 16, 16);
    g.destroy();
  }
  if (!scene.textures.exists("unknown-item")) {
    const g = scene.make.graphics(undefined, false);
    g.fillStyle(0x6a6a6a, 1);
    g.fillRect(5, 3, 6, 10);
    g.generateTexture("unknown-item", 16, 16);
    g.destroy();
  }
}

// An open door is just a brown dotted line on the floor (a doorstep).
export function generateDoorThresholdTexture(scene: Phaser.Scene): void {
  // 21px panels reach the floor at local y=16 with a 5px wall-height rise.
  if (!scene.textures.exists('door-front')) {
    const front = scene.make.graphics(undefined, false);
    front.fillStyle(0x292b28, 1);
    front.fillRect(1, 0, 14, 21);
    front.fillStyle(0x73502d, 1);
    front.fillRect(2, 1, 12, 19);
    front.fillStyle(0x936b38, 1);
    for (const x of [3, 7, 11]) front.fillRect(x, 2, 2, 17);
    front.fillStyle(0x4a3525, 1);
    for (const x of [6, 10]) front.fillRect(x, 1, 1, 19);
    front.fillStyle(0x424640, 1);
    front.fillRect(2, 5, 12, 2);
    front.fillRect(2, 15, 12, 2);
    front.fillStyle(0xb69c60, 1);
    front.fillRect(11, 10, 2, 2);
    front.generateTexture('door-front', 16, 21);
    front.destroy();
  }
  // Side-on panel for an east–west passage. Keep it narrow rather than
  // rotating the front sprite (which would put its handle/planks sideways).
  if (!scene.textures.exists('door-side')) {
    const side = scene.make.graphics(undefined, false);
    side.fillStyle(0x292525, 1);
    side.fillRect(5, 0, 6, 21);
    side.fillStyle(0x67401f, 1);
    side.fillRect(6, 1, 4, 19);
    side.fillStyle(0xa17435, 1);
    side.fillRect(6, 2, 1, 17);
    side.fillStyle(0x402c1e, 1);
    side.fillRect(7, 4, 3, 1);
    side.fillRect(7, 16, 3, 1);
    side.generateTexture('door-side', 16, 21);
    side.destroy();
  }
  if (!scene.textures.exists('door-threshold-side')) {
    const side = scene.make.graphics(undefined, false);
    side.fillStyle(0x8a5a2b, 1);
    for (let y = 1; y <= 13; y += 3) side.fillRect(7, y, 2, 2);
    side.generateTexture('door-threshold-side', 16, 16);
    side.destroy();
  }
  if (scene.textures.exists("door-threshold")) return;
  const g = scene.make.graphics(undefined, false);
  g.fillStyle(0x8a5a2b, 1);
  for (let x = 1; x <= 13; x += 3) {
    g.fillRect(x, 12, 2, 2);
  }
  g.generateTexture("door-threshold", 16, 16);
  g.destroy();
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
