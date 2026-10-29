import type Phaser from 'phaser';
import type { Entity } from './entity';

const flames = new WeakMap<Phaser.Scene, Phaser.GameObjects.Graphics>();

/** Small ankle-height flames, never a full-body fire overlay. Presentation only. */
export function updateHeroBurning(scene: Phaser.Scene, hero: Entity | undefined, now: number): void {
  const sprite = hero?.sprite;
  if (!hero || !sprite || hero.healthPoints <= 0 || !hero.effects.some(effect => effect.id === 'burning')) {
    clearHeroBurning(scene);
    return;
  }
  let fire = flames.get(scene);
  if (!fire) {
    fire = scene.add.graphics();
    flames.set(scene, fire);
  }
  fire.clear().setVisible(sprite.visible).setAlpha(sprite.alpha);
  // Track interpolated movement and the walking bob without touching the hero.
  fire.setDepth(Math.min(99, sprite.depth + 0.1));
  const sx = Math.abs(sprite.scaleX), sy = Math.abs(sprite.scaleY);
  const left = sprite.x - sprite.displayOriginX * sx;
  const bottom = sprite.y + (sprite.height - sprite.displayOriginY) * sy;
  const frame = Math.floor(now / 120);
  for (let side = 0; side < 2; side++) {
    const phase = (frame + side * 2) % 4;
    const height = 4 + phase % 3;
    const x = Math.round(left + (side ? sprite.width - 4 : 1) * sx);
    const y = Math.round(bottom - sy);
    const lean = phase < 2 ? 0 : 1;
    fire.fillStyle(0xba4323, 0.85).fillRect(x, y - 3 * sy, 3 * sx, 3 * sy);
    fire.fillStyle(0xf48a2d, 0.95).fillRect(x + sx, y - height * sy, sx, height * sy);
    fire.fillStyle(0xffd66d, 0.95).fillRect(x + sx, y - 2 * sy, sx, 2 * sy);
    fire.fillStyle(0xf6aa42, 0.8).fillRect(x + lean * sx, y - (height + 1) * sy, sx, sy);
  }
}

export function clearHeroBurning(scene: Phaser.Scene): void {
  flames.get(scene)?.destroy();
  flames.delete(scene);
}
