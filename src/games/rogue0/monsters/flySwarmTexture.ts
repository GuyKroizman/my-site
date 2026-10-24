import type Phaser from "phaser";

export const FLY_SWARM_TEXTURE = "monster-fly-swarm";
// Three distinct winged insects rather than a humanoid atlas frame. Transparent
// gaps, paired pale wings, dark segmented bodies and tiny legs read at 16px.
export const FLY_PIXELS = [
  "ww...ww",
  ".ww.ww.",
  "..bbb..",
  ".lbebl.",
  "..bbb..",
  "..l.l.."
];
export const FLY_POSITIONS = [[0, 0], [9, 5], [1, 10]] as const;
export const FLY_PALETTE: Record<string, number> = {
  w: 0xc7e5eb, b: 0x23352d, e: 0xb4d35a, l: 0x67856b
};

export function generateFlySwarmTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(FLY_SWARM_TEXTURE)) return;
  const g = scene.make.graphics(undefined, false);
  for (const [ox, oy] of FLY_POSITIONS) {
    FLY_PIXELS.forEach((row, y) => [...row].forEach((pixel, x) => {
      const color = FLY_PALETTE[pixel];
      if (color === undefined) return;
      g.fillStyle(color, 1);
      g.fillRect(ox + x, oy + y, 1, 1);
    }));
  }
  g.generateTexture(FLY_SWARM_TEXTURE, 16, 16);
  g.destroy();
}
