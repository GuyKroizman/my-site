// Runtime-generated art for junk and leftover gear that used to borrow an atlas
// frame. Each item gets a silhouette of its own so the inventory never shows two
// unrelated things wearing the same picture.
import type Phaser from "phaser";

/** The unwearable boot picked up as junk. */
export const SHOE_TEXTURE = "junk-shoe";

const SHOE_ART = [
  '................',
  '................',
  '....####........',
  '...#lllh#.......',
  '...#llhh#.......',
  '...#lhhh#.......',
  '...#lhhh#.......',
  '...#lhhh#.......',
  '...#lhhhh###....',
  '...#lhhhhhhh#...',
  '...#hhhhhhhh#...',
  '...##########...',
  '....#bbbbbb#....',
  '....########....',
  '................',
  '................'
] as const;

const PALETTE: Record<string, number> = {
  '#': 0x222334, l: 0xb37654, h: 0x663e39, b: 0x3b2a2f
};

/** Transparent pixels are -1; all other values are opaque RGB. */
export function shoePixels(): number[] {
  return SHOE_ART.flatMap(row => [...row].map(pixel => pixel === '.' ? -1 : PALETTE[pixel]));
}

export function generateJunkTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(SHOE_TEXTURE)) return;
  const graphics = scene.make.graphics(undefined, false);
  shoePixels().forEach((color, index) => {
    if (color === -1) return;
    graphics.fillStyle(color, 1);
    graphics.fillRect(index % 16, Math.floor(index / 16), 1, 1);
  });
  graphics.generateTexture(SHOE_TEXTURE, 16, 16);
  graphics.destroy();
}
