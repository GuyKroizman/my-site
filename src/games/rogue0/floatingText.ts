// Floating combat text: a number that pops above an entity and fades away,
// Shattered-Pixel-Dungeon style ("-1" on damage, "+N" on healing).
import Phaser from "phaser";
import type { Entity } from "./entity";

export function spawnFloatingText(
  scene: Phaser.Scene,
  wx: number,
  wy: number,
  text: string,
  color = "#ff6a6a"
): void {
  const label = scene.add
    .text(wx, wy, text, {
      fontFamily: '"VT323", monospace',
      fontSize: 20,
      color,
      stroke: "#000000",
      strokeThickness: 2
    })
    .setOrigin(0.5)
    .setDepth(500);

  scene.tweens.add({
    targets: label,
    y: wy - 20,
    alpha: 0,
    duration: 900,
    ease: "Cubic.easeOut",
    onComplete: () => label.destroy()
  });
}

// Convenience wrapper that resolves an entity's tile to world coordinates.
export function spawnEntityFloatingText(
  entity: Entity,
  text: string,
  color?: string
): void {
  const context = entity.context;
  if (!context?.scene || !context?.map) return;
  if (entity.x === undefined || entity.y === undefined) return;

  spawnFloatingText(
    context.scene,
    context.map.tileToWorldX(entity.x)! + 8,
    context.map.tileToWorldY(entity.y)! + 2,
    text,
    color
  );
}
