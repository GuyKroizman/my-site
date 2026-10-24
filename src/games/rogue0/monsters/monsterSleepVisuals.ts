import type Phaser from "phaser";
import type { Entity } from "../entity";

// Cosmetic time only. No sleep state, action costs, or RNG are changed here.
const clouds = new WeakMap<Phaser.Scene, Map<Entity, Phaser.GameObjects.Text[]>>();

export function clearMonsterSleepVisuals(scene: Phaser.Scene): void {
  const entries = clouds.get(scene);
  if (!entries) return;
  for (const letters of entries.values()) for (const letter of letters) letter.destroy();
  entries.clear();
  clouds.delete(scene);
}

/** Call after FOV and foreground sprite visibility are updated. */
export function updateMonsterSleepVisuals(scene: Phaser.Scene, entities: Entity[], time: number): void {
  let entries = clouds.get(scene);
  if (!entries) {
    entries = new Map();
    clouds.set(scene, entries);
  }
  const visibleSleepers = new Set(entities.filter(entity =>
    entity.type === "enemy" && entity.healthPoints > 0 &&
    (entity as Entity & { sleeping?: boolean }).sleeping &&
    entity.sprite?.visible && entity.x !== undefined && entity.y !== undefined &&
    entity.context.visibleTiles.has(`${entity.x},${entity.y}`)
  ));
  for (const [entity, letters] of entries) {
    if (visibleSleepers.has(entity)) continue;
    for (const letter of letters) letter.destroy();
    entries.delete(entity);
  }
  for (const entity of visibleSleepers) {
    const sprite = entity.sprite!;
    let letters = entries.get(entity);
    if (!letters) {
      letters = Array.from({ length: 3 }, () => scene.add.text(0, 0, "z", {
        fontFamily: "monospace", fontSize: "7px", color: "#d3e5ef",
        stroke: "#18212b", strokeThickness: 1, resolution: 4
      }).setOrigin(0.5, 1));
      entries.set(entity, letters);
    }
    letters.forEach((letter, i) => {
      const phase = ((time + i * 480) % 1440) / 1440;
      const x = sprite.x + sprite.displayWidth * 0.6 + phase * 5;
      const y = sprite.y - 1 - phase * 15;
      letter.setPosition(x, y).setAlpha(0.85 * (1 - phase));
      // Stay below fog, and also clip the glyph to visible tiles: a visible
      // creature must never spray letters onto a hidden wall or adjacent room.
      const map = entity.context.map;
      const tx = map?.worldToTileX(x);
      const ty = map?.worldToTileY(y - 4);
      letter.setVisible(tx != null && ty != null && entity.context.visibleTiles.has(`${tx},${ty}`));
      letter.setDepth(Math.min(99, sprite.depth + 0.1));
    });
  }
}
