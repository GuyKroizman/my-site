import type { Entity } from './entity';
import { drawActorFlames } from './heroBurningVisuals.ts';

type Visuals = {
  fire?: Phaser.GameObjects.Graphics;
  swirl?: Phaser.GameObjects.Graphics;
  wash?: Phaser.GameObjects.Sprite;
};
const indicators = new WeakMap<Phaser.Scene, Map<Entity, Visuals>>();

function destroyVisuals(visuals: Visuals): void {
  visuals.fire?.destroy();
  visuals.swirl?.destroy();
  visuals.wash?.destroy();
}

export function clearMonsterStatusVisuals(scene: Phaser.Scene): void {
  const entries = indicators.get(scene);
  if (!entries) return;
  for (const visuals of entries.values()) destroyVisuals(visuals);
  indicators.delete(scene);
}

/** A rotating spiral, not a status badge. Cosmetic time only, below fog. */
function drawConfusion(swirl: Phaser.GameObjects.Graphics, sprite: Phaser.GameObjects.Sprite, now: number): void {
  const sx = Math.abs(sprite.scaleX), sy = Math.abs(sprite.scaleY);
  const x = sprite.x + (sprite.width / 2 - sprite.displayOriginX) * sx;
  const y = sprite.y - sprite.displayOriginY * sy - 5 * sy;
  const radius = Math.min(7, sprite.width * 0.4) * sx;
  swirl.clear().setVisible(sprite.visible).setAlpha(sprite.alpha)
    .setDepth(Math.min(99, sprite.depth + 0.12));
  // Dark outline keeps the pale violet spiral readable against bright floors.
  for (const [width, color] of [[2.5, 0x312039], [1, 0xe8adff]]) {
    swirl.lineStyle(width, color, 0.95).beginPath();
    for (let i = 0; i <= 32; i++) {
      const t = i / 32;
      const angle = t * Math.PI * 3.5 + now / 420;
      const px = x + Math.cos(angle) * radius * t;
      const py = y + Math.sin(angle) * 3 * sy * t;
      if (i === 0) swirl.moveTo(px, py);
      else swirl.lineTo(px, py);
    }
    swirl.strokePath();
  }
}

/** Run after FOV: hidden monsters (including mind-vision silhouettes) reveal no effects. */
export function updateMonsterStatusVisuals(scene: Phaser.Scene, entities: Entity[], now: number): void {
  let entries = indicators.get(scene);
  if (!entries) {
    entries = new Map();
    indicators.set(scene, entries);
  }
  const active = new Set<Entity>();
  for (const entity of entities) {
    const sprite = entity.sprite;
    if (entity.type !== 'enemy' || entity.healthPoints <= 0 || !sprite?.visible ||
        entity.x === undefined || entity.y === undefined) continue;
    const ids = new Set(entity.effects.map(effect => effect.id));
    // One body wash at a time: disabling effects take priority over poison.
    // Inspection still lists every active effect, and flames/swirl can coexist.
    const color = ids.has('stunned') ? 0xffffff : ids.has('frozen') ? 0x65baff :
      ids.has('poisoned') ? 0x65d64b : undefined;
    if (!ids.has('burning') && !ids.has('confused') && color === undefined) continue;
    active.add(entity);
    let visuals = entries.get(entity);
    if (!visuals) {
      visuals = {};
      entries.set(entity, visuals);
    }
    if (ids.has('burning')) {
      visuals.fire ??= scene.add.graphics();
      drawActorFlames(visuals.fire, sprite, now);
    } else {
      visuals.fire?.destroy();
      visuals.fire = undefined;
    }
    if (ids.has('confused')) {
      visuals.swirl ??= scene.add.graphics();
      drawConfusion(visuals.swirl, sprite, now);
    } else {
      visuals.swirl?.destroy();
      visuals.swirl = undefined;
    }
    if (color !== undefined) {
      visuals.wash ??= scene.add.sprite(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name);
      // A translucent, silhouette-shaped tint preserves original art, hit flashes,
      // and custom monster tints. Never tint a rectangular bounding box or mutate
      // the actor itself (which would race combat's delayed tint restoration).
      visuals.wash.setTexture(sprite.texture.key, sprite.frame.name)
        .setPosition(sprite.x, sprite.y).setOrigin(sprite.originX, sprite.originY)
        .setScale(sprite.scaleX, sprite.scaleY).setRotation(sprite.rotation)
        .setFlip(sprite.flipX, sprite.flipY).setTint(color).setTintMode(Phaser.TintModes.FILL)
        .setAlpha(sprite.alpha * (ids.has('stunned') ? 0.65 : 0.45))
        .setDepth(Math.min(99, sprite.depth + 0.05));
    } else {
      visuals.wash?.destroy();
      visuals.wash = undefined;
    }
  }
  for (const [entity, visuals] of entries) {
    if (active.has(entity)) continue;
    destroyVisuals(visuals);
    entries.delete(entity);
  }
}
