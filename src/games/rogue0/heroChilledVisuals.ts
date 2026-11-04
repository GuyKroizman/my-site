import type Phaser from 'phaser';
import type { Entity } from './entity';

const sheets = new WeakMap<Phaser.Scene, Phaser.GameObjects.Graphics>();

// Frost glints as fractions of the sprite box, so they scale with the art.
// Fixed positions on purpose: presentation must never consume gameplay RNG.
const FROST_GLINTS: ReadonlyArray<readonly [number, number]> = [
  [0.31, 0.05], [0.63, 0.14], [0.19, 0.27], [0.75, 0.36], [0.44, 0.50],
  [0.69, 0.59], [0.25, 0.73], [0.56, 0.82], [0.81, 0.86], [0.38, 0.91]
];

/**
 * Cool blue wash plus twinkling frost glints drawn over a chilled hero.
 * Presentation only: it reads `effects` and never ticks, adds or removes them,
 * and it draws a separate Graphics object so the hero sprite's own tint
 * (low-health red, white hit flash) and alpha (invisibility) are left alone.
 */
export function updateHeroChilled(scene: Phaser.Scene, hero: Entity | undefined, now: number): void {
  const sprite = hero?.sprite;
  if (!hero || !sprite || hero.healthPoints <= 0 || !hero.effects.some(effect => effect.id === 'chilled')) {
    clearHeroChilled(scene);
    return;
  }
  let ice = sheets.get(scene);
  if (!ice) {
    ice = scene.add.graphics();
    sheets.set(scene, ice);
  }
  const sx = Math.abs(sprite.scaleX);
  const sy = Math.abs(sprite.scaleY);
  const left = sprite.x - sprite.displayOriginX * sx;
  const top = sprite.y - sprite.displayOriginY * sy;
  const w = sprite.width * sx;
  const h = sprite.height * sy;
  // Slow breathing pulse: the debuff must read as active, not as a tint bug.
  const pulse = 0.5 + 0.5 * Math.sin(now / 260);
  // One glint twinkles off at a time, on a fixed cycle, so the frost shimmers.
  const frame = Math.floor(now / 220);
  const glint = Math.max(1, Math.round(Math.min(sx, sy)));

  ice.clear().setVisible(sprite.visible).setAlpha(sprite.alpha);
  ice.setDepth(Math.min(99, sprite.depth + 0.05));

  // Body wash: cool and clearly blue, still translucent enough to read the art.
  ice.fillStyle(0x9fd6ff, 0.30 + 0.08 * pulse).fillRect(left, top, w, h);
  FROST_GLINTS.forEach(([fx, fy], index) => {
    ice.fillStyle(0xdff3ff, (index + frame) % 3 === 0 ? 0.35 : 0.95);
    ice.fillRect(
      left + Math.round(fx * (w - glint)),
      top + Math.round(fy * (h - glint)),
      glint,
      glint
    );
  });
}

export function clearHeroChilled(scene: Phaser.Scene): void {
  sheets.get(scene)?.destroy();
  sheets.delete(scene);
}
