import type Phaser from "phaser";

export const WRAITH_TEXTURE = "monster-wraith";
// A hooded spectre with a gaping mouth and burning eyes, tattered cloak and
// wispy ghost trails — the old atlas frame read as a friendly white ghost.
export const WRAITH_PIXELS = [
  "......kkkk......",
  ".....kkkkkk.....",
  "....khkkkkhk....",
  "...khkkkkkkhk...",
  "...kddddddddk...",
  "..kddddddddddk..",
  "..kddeEdddeEdk..",
  "..kddddddddddk..",
  "..kdddkkkkdddk..",
  "..kkkkkkkkkkkk..",
  "..kcccccccccck..",
  ".khccccccccchk..",
  ".kchcchcchcchk..",
  ".kcchhcchhcchk..",
  ".kk..kk..kk.....",
  "..gg..gg..gg...."
];
export const WRAITH_PALETTE: Record<string, number> = {
  k: 0x0a0814, d: 0x1e1636, c: 0x342a5e, h: 0x5a4a92,
  g: 0xa8e6d8, e: 0xff3a2d, E: 0xffd9a0
};

export function generateWraithTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(WRAITH_TEXTURE)) return;
  const g = scene.make.graphics(undefined, false);
  WRAITH_PIXELS.forEach((row, y) => [...row].forEach((pixel, x) => {
    const color = WRAITH_PALETTE[pixel];
    if (color === undefined) return;
    g.fillStyle(color, 1);
    g.fillRect(x, y, 1, 1);
  }));
  g.generateTexture(WRAITH_TEXTURE, 16, 16);
  g.destroy();
}
