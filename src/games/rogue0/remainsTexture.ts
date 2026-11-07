import type Phaser from 'phaser';

/** Small floor-level skull and scattered long bones, distinct from chests. */
export function generateRemainsTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('skeletal-remains')) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0x332e31).fillEllipse(8, 12, 14, 5);
  g.lineStyle(2, 0xb8ad91);
  g.lineBetween(2, 10, 12, 14);
  g.lineBetween(3, 14, 13, 9);
  g.fillStyle(0xd9cfb2);
  for (const [x, y] of [[2, 10], [12, 14], [3, 14], [13, 9]]) g.fillRect(x - 1, y - 1, 3, 2);
  g.fillRoundedRect(5, 4, 7, 6, 2);
  g.fillRect(7, 9, 4, 2);
  g.fillStyle(0x393239).fillRect(6, 6, 2, 2).fillRect(10, 6, 2, 2);
  g.fillRect(9, 9, 1, 2);
  g.generateTexture('skeletal-remains', 16, 16);
  g.destroy();
}
