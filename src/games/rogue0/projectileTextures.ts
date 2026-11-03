import type Phaser from "phaser";

// Ranged hazards share one slim 10x3 arrow silhouette and differ only in
// palette. Both textures are fully transparent around the art: the old
// projectiles came from a 16x16 tilesheet frame, so a shot covered a whole
// floor tile with an opaque purple square while it flew.
export const ARROW_PIXELS = [
  ".FF...SS..",
  "FfwwwwSSSS",
  ".ff...sss."
];

// Goblin archers: dark-green fletching and bright iron, matching goblin art.
export const GOBLIN_ARROW_TEXTURE = "monster-goblin-arrow";
export const GOBLIN_ARROW_PALETTE: Record<string, number> = {
  F: 0x606a54, // fletching
  f: 0x3a4238, // fletching shadow
  w: 0xb0814c, // shaft
  S: 0xe9e8d6, // iron head
  s: 0x969f90 // iron head shadow
};

// Cultists hurl a bolt of necromantic light: violet fletching, corpse-green head
// echoing the glow inside the cultist's hood.
export const CULTIST_BOLT_TEXTURE = "monster-cultist-bolt";
export const CULTIST_BOLT_PALETTE: Record<string, number> = {
  F: 0x643b78, // violet fletching
  f: 0x392744, // fletching shadow
  w: 0x8a6ba0, // pale violet shaft
  S: 0x78db94, // necromantic light
  s: 0x3f8f5c // necromantic shadow
};

// Arrow and dart traps fire the paler bow arrow of the original tileset art.
export const TRAP_ARROW_TEXTURE = "bow-arrow";
export const TRAP_ARROW_PALETTE: Record<string, number> = {
  F: 0xb9cbd4,
  f: 0x8fa4b0,
  w: 0xc99554,
  S: 0xe8e1d5,
  s: 0xa8a294
};

function drawArrow(scene: Phaser.Scene, key: string, palette: Record<string, number>): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics(undefined, false);
  ARROW_PIXELS.forEach((row, y) => [...row].forEach((pixel, x) => {
    const color = palette[pixel];
    if (color === undefined) return;
    g.fillStyle(color, 1);
    g.fillRect(x, y, 1, 1);
  }));
  g.generateTexture(key, ARROW_PIXELS[0].length, ARROW_PIXELS.length);
  g.destroy();
}

// The projectile sprite is rotated toward its victim when it launches, so the
// art points right and the arrowhead is the front third of the texture.
export function generateGoblinArrowTexture(scene: Phaser.Scene): void {
  drawArrow(scene, GOBLIN_ARROW_TEXTURE, GOBLIN_ARROW_PALETTE);
}

export function generateCultistBoltTexture(scene: Phaser.Scene): void {
  drawArrow(scene, CULTIST_BOLT_TEXTURE, CULTIST_BOLT_PALETTE);
}

export function generateTrapArrowTexture(scene: Phaser.Scene): void {
  drawArrow(scene, TRAP_ARROW_TEXTURE, TRAP_ARROW_PALETTE);
}
