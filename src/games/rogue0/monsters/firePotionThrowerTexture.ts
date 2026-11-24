import type Phaser from "phaser";

export const FIRE_POTION_THROWER_TEXTURE = "monster-fire-potion-thrower";

// Brass-goggled factory worker with a flame flask: 16x16, generated at 1:1.
export const FIRE_POTION_THROWER_PIXELS = [
  "................",
  ".....bbbbbb.....",
  "....bccccccb....",
  "...bcsssssscb...",
  "...bsgwwwwgsb...",
  "...bcsssssscb...",
  "....bkkkkkkb....",
  "...bkkffffkkb...",
  "..bkfwwwwfkkb...",
  "..bkfwwwwfkkb...",
  "...bkkffffkkb...",
  "....bkkkkkkb....",
  ".....kkkkkk.....",
  "....kk....kk....",
  "...kk......kk...",
  "................"
];

export const FIRE_POTION_THROWER_PALETTE: Record<string, number> = {
  b: 0xb08d57, // brass
  c: 0xc9713a, // copper
  s: 0xc9a17a, // skin
  g: 0x9bd6d6, // goggle glass
  w: 0xffe6a8, // hot highlight
  k: 0x3b3a4a, // work clothes
  f: 0xff8a2b // liquid flame
};

export function generateFirePotionThrowerTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(FIRE_POTION_THROWER_TEXTURE)) return;
  const g = scene.make.graphics(undefined, false);
  FIRE_POTION_THROWER_PIXELS.forEach((row, y) => [...row].forEach((pixel, x) => {
    const color = FIRE_POTION_THROWER_PALETTE[pixel];
    if (color === undefined) return;
    g.fillStyle(color, 1);
    g.fillRect(x, y, 1, 1);
  }));
  g.generateTexture(FIRE_POTION_THROWER_TEXTURE, 16, 16);
  g.destroy();
}
