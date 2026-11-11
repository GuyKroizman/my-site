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

// Wand and scroll attacks used to fly as opaque 16x16 tilesheet frames. These
// bolts are transparent and palette-matched to each element, and they point
// right because the sprite is rotated toward the victim.
export const FIREBOLT_TEXTURE = "projectile-firebolt";
export const FROSTBOLT_TEXTURE = "projectile-frostbolt";
export const SHOCKBOLT_TEXTURE = "projectile-shockbolt";

const FIREBOLT_PALETTE: Record<string, number> = {
  o: 0x7a2f16, F: 0xd8562a, f: 0xa13f20, w: 0xf6c05a, S: 0xfff3c4, s: 0xe8913a
};
const FROSTBOLT_PALETTE: Record<string, number> = {
  o: 0x2d5470, F: 0x5fa8d6, f: 0x3f7ba3, w: 0xa8e0f2, S: 0xf2fbff, s: 0x77c6e6
};
const SHOCKBOLT_PALETTE: Record<string, number> = {
  o: 0x4a3c78, F: 0x8f7bea, f: 0x6351b5, w: 0xcbb9ff, S: 0xffffff, s: 0x9a86f0
};

const FIREBOLT_PIXELS = [
  "oo....", "oFFo..", "oFfwwo", "oFfSSo", "oFfwwo", "oFFo..", "oo...."
];
const FROSTBOLT_PIXELS = [
  "..o...", ".oFo..", "oFfwwo", "oFSSwo", "oFfwwo", ".oFo..", "..o..."
];
const SHOCKBOLT_PIXELS = [
  "o.....", "oFo...", "oFFwo.", "oFfSSo", "oFFwo.", "oFo...", "o....."
];

function drawBolt(scene: Phaser.Scene, key: string, rows: string[], palette: Record<string, number>): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics(undefined, false);
  rows.forEach((row, y) => [...row].forEach((pixel, x) => {
    const color = palette[pixel];
    if (color === undefined) return;
    g.fillStyle(color, 1);
    g.fillRect(x, y, 1, 1);
  }));
  g.generateTexture(key, rows[0].length, rows.length);
  g.destroy();
}

/** Pixels for one of the three bolts, used by the visual tests. */
export function boltPixels(element: "fire" | "frost" | "shock"): number[] {
  const [rows, palette] = element === "fire" ? [FIREBOLT_PIXELS, FIREBOLT_PALETTE]
    : element === "frost" ? [FROSTBOLT_PIXELS, FROSTBOLT_PALETTE]
      : [SHOCKBOLT_PIXELS, SHOCKBOLT_PALETTE];
  return rows.flatMap(row => [...row].map(pixel => palette[pixel] ?? -1));
}

export function generateWandProjectileTextures(scene: Phaser.Scene): void {
  drawBolt(scene, FIREBOLT_TEXTURE, FIREBOLT_PIXELS, FIREBOLT_PALETTE);
  drawBolt(scene, FROSTBOLT_TEXTURE, FROSTBOLT_PIXELS, FROSTBOLT_PALETTE);
  drawBolt(scene, SHOCKBOLT_TEXTURE, SHOCKBOLT_PIXELS, SHOCKBOLT_PALETTE);
}
