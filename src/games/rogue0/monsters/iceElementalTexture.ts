import type Phaser from "phaser";

export const ICE_ELEMENTAL_TEXTURE = "monster-ice-elemental";
// A cluster of crystal shards with a wide translucent body, dark eye sockets,
// white icicle tips and detached shards at the shoulders—never a solid loot
// silhouette like the chest atlas frame this monster used to borrow.
export const ICE_ELEMENTAL_PIXELS = [
  "................",
  ".......w........",
  "......gcg.......",
  "......gcg...w...",
  "...w..gcg..gcg..",
  "..gcg.gcg..gcg..",
  "..gcg.bcb...gb..",
  "...gbccccccbg...",
  "..bccddccddccb..",
  "..bccwccccwccb..",
  "..bccccccccccb..",
  "...bccccccccb...",
  "..b.bbccccbb.b..",
  "....bbccccbb....",
  "....bcb..bcb....",
  "....w......w...."
];
export const ICE_ELEMENTAL_PALETTE: Record<string, number> = {
  b: 0x2f8fc0, c: 0x6fd6f2, g: 0x9fefff, w: 0xe8fdff, d: 0x0a2333
};

export function generateIceElementalTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(ICE_ELEMENTAL_TEXTURE)) return;
  const g = scene.make.graphics(undefined, false);
  ICE_ELEMENTAL_PIXELS.forEach((row, y) => [...row].forEach((pixel, x) => {
    const color = ICE_ELEMENTAL_PALETTE[pixel];
    if (color === undefined) return;
    g.fillStyle(color, 1);
    g.fillRect(x, y, 1, 1);
  }));
  g.generateTexture(ICE_ELEMENTAL_TEXTURE, 16, 16);
  g.destroy();
}
