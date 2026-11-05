import type Phaser from "phaser";

export const DEADLY_FROG_TEXTURE = "monster-deadly-frog";
// A squat, wide-mouthed frog with raised eyes and purple poison warts. The
// transparent gaps keep it readable beside the tilesheet monsters at 16px.
export const DEADLY_FROG_PIXELS = [
  "................",
  "....DD....DD....",
  "...DGGD..DGGD...",
  "..DGWWGD.DGWWGD.",
  "..DGBBGD.DGBBGD.",
  "...DGGDDDDGGD...",
  "..DGGGGGGGGGGD..",
  ".DGGDGGGGGGDGGD.",
  ".DGDGGPGGPGGDGD.",
  ".DGGGDDDDDDGGGD.",
  "..DGGGGGGGGGGD..",
  "...DGGGGGGGGD...",
  "...DGD....DGD...",
  "..DDDD....DDDD..",
  "................",
  "................"
];
export const DEADLY_FROG_PALETTE: Record<string, number> = {
  D: 0x1d3b22, G: 0x5aa83c, W: 0xf4f7e8, B: 0x101a10, P: 0x7b3f8f
};

export function generateDeadlyFrogTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(DEADLY_FROG_TEXTURE)) return;
  const g = scene.make.graphics(undefined, false);
  DEADLY_FROG_PIXELS.forEach((row, y) => [...row].forEach((pixel, x) => {
    const color = DEADLY_FROG_PALETTE[pixel];
    if (color === undefined) return;
    g.fillStyle(color, 1);
    g.fillRect(x, y, 1, 1);
  }));
  g.generateTexture(DEADLY_FROG_TEXTURE, 16, 16);
  g.destroy();
}
