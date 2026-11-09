// Runtime-generated ring textures.
//
// Every ring kind gets its own gem colour, and the ring-to-colour mapping is
// shuffled per run exactly like potion colours. The band stays gold so rings
// read as rings; only the gem changes. Keys are "ring-0" … "ring-7" and are
// assigned by entity.ts (RING_APPEARANCES), which must list the same count.
import Phaser from "phaser";

export const RING_GEM_COLORS = [
  0xe04a3a, // red
  0x35c75f, // green
  0x3d8bff, // blue
  0xf0eee0, // pearl
  0x9b59ff, // purple
  0x28d9da, // cyan
  0xff8c32, // orange
  0xf276bb  // pink
] as const;

export function generateRingTextures(scene: Phaser.Scene): void {
  RING_GEM_COLORS.forEach((color, i) => {
    const key = `ring-${i}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const g = scene.make.graphics(undefined, false);
    drawRing(g, color);
    g.generateTexture(key, 16, 16);
    g.destroy();
  });
}

// A gold signet ring seen from the front: dark setting, gem at the top, and a
// 1px highlight so each colour still reads at inventory size.
function drawRing(g: Phaser.GameObjects.Graphics, gem: number): void {
  // Dark outer edge then the gold band; the inner hole keeps the ring shape.
  g.fillStyle(0x4a3310, 1);
  g.fillCircle(8, 9, 6);
  g.fillStyle(0xd9a92a, 1);
  g.fillCircle(8, 9, 5);
  g.fillStyle(0x241a0c, 1);
  g.fillCircle(8, 9, 3);

  // Gem setting and stone.
  g.fillStyle(0x3a2a10, 1);
  g.fillCircle(8, 5, 3);
  g.fillStyle(gem, 1);
  g.fillCircle(8, 5, 2);
  g.fillStyle(0xffffff, 0.7);
  g.fillRect(7, 4, 1, 1);

  // Band shine on the lower-left arc.
  g.fillStyle(0xffe08a, 0.9);
  g.fillRect(4, 12, 2, 1);
}
