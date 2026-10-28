import type Phaser from "phaser";

export const FIRE_ELEMENTAL_TEXTURE = "monster-fire-elemental";
// Asymmetric flame tips, ember edges, a hot core and bright eyes at native 16px.
export const FIRE_ELEMENTAL_PIXELS = [
  "........r.......",
  ".......ro.......",
  ".......ro.......",
  "...r..roor......",
  "...or.royr..r...",
  "...royoyyor.or..",
  "..royyyyyyoror..",
  "..royyyyyyyyor..",
  ".roydwyywdyyor..",
  ".royddyyddyyor..",
  ".royyyywyyyyor..",
  "..royywwwyyor...",
  "..roywwwwwyor...",
  "...roywwwyor....",
  "....rooooor.....",
  ".....rrrr......."
];
export const FIRE_ELEMENTAL_PALETTE: Record<string, number> = {
  r: 0xb92f24, o: 0xf56b24, y: 0xffc447, w: 0xfff4c1, d: 0x682522
};

export function generateFireElementalTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(FIRE_ELEMENTAL_TEXTURE)) return;
  const g = scene.make.graphics(undefined, false);
  FIRE_ELEMENTAL_PIXELS.forEach((row, y) => [...row].forEach((pixel, x) => {
    const color = FIRE_ELEMENTAL_PALETTE[pixel];
    if (color === undefined) return;
    g.fillStyle(color, 1);
    g.fillRect(x, y, 1, 1);
  }));
  g.generateTexture(FIRE_ELEMENTAL_TEXTURE, 16, 16);
  g.destroy();
}
