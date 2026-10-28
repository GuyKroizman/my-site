import type Phaser from "phaser";

export const LIGHTNING_ELEMENTAL_TEXTURE = "monster-lightning-elemental";
// Floating plasma, bright eyes and detached zigzag arcs—not a solid loot silhouette.
export const LIGHTNING_ELEMENTAL_PIXELS = [
  ".........c......",
  "........cw......",
  "...c...cwc......",
  "..cw....wc...c..",
  "..wc..bccb..cw..",
  ".cw..bccccb.wc..",
  "..w.bcwccwcb.w..",
  "..c.bcdccdcb.c..",
  "....bccccccb....",
  ".c...bcwwcb..c..",
  ".wc..bcwwcb.cw..",
  "..wc..cwc...wc..",
  ".cw...wc...cw...",
  "..c..cw.....c...",
  "......wc........",
  "......c........."
];
export const LIGHTNING_ELEMENTAL_PALETTE: Record<string, number> = {
  b: 0x385bcc, c: 0x51dfff, w: 0xf2ffff, d: 0x17274f
};

export function generateLightningElementalTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(LIGHTNING_ELEMENTAL_TEXTURE)) return;
  const g = scene.make.graphics(undefined, false);
  LIGHTNING_ELEMENTAL_PIXELS.forEach((row, y) => [...row].forEach((pixel, x) => {
    const color = LIGHTNING_ELEMENTAL_PALETTE[pixel];
    if (color === undefined) return;
    g.fillStyle(color, 1);
    g.fillRect(x, y, 1, 1);
  }));
  g.generateTexture(LIGHTNING_ELEMENTAL_TEXTURE, 16, 16);
  g.destroy();
}
