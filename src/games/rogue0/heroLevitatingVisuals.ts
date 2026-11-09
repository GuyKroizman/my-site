import type Phaser from 'phaser';
import type { Entity } from './entity';

const drafts = new WeakMap<Phaser.Scene, Phaser.GameObjects.Graphics>();

// Fixed stream lanes as fractions of the hero's footprint width. Fixed on
// purpose: presentation must never consume gameplay RNG.
const STREAM_LANES: ReadonlyArray<number> = [0.18, 0.34, 0.5, 0.66, 0.82];
// One full downdraft cycle in milliseconds; lanes are phase-shifted inside it.
const CYCLE_MS = 640;
// How far the pushed-down air travels below the feet at full scale.
const TRAVEL = 9;

/**
 * Updraft below a levitating hero: short pixel streaks of air pushed down from
 * the feet plus two puffs sliding outward. Presentation only: it reads
 * `effects` and never ticks, adds or removes them, and it draws a separate
 * Graphics object so the hero sprite's own tint (low-health red, white hit
 * flash) and alpha (invisibility) are left alone.
 */
export function updateHeroLevitating(scene: Phaser.Scene, hero: Entity | undefined, now: number): void {
  const sprite = hero?.sprite;
  if (!hero || !sprite || hero.healthPoints <= 0 || !hero.effects.some(effect => effect.id === 'levitating')) {
    clearHeroLevitating(scene);
    return;
  }
  let air = drafts.get(scene);
  if (!air) {
    air = scene.add.graphics();
    drafts.set(scene, air);
  }
  const sx = Math.abs(sprite.scaleX);
  const sy = Math.abs(sprite.scaleY);
  const left = sprite.x - sprite.displayOriginX * sx;
  const w = sprite.width * sx;
  // Feet, not the sprite top: the bird's-eye art is anchored at the cell
  // bottom, so the air has to leave from the drawn soles.
  const feet = sprite.y + (sprite.height - sprite.displayOriginY) * sy;
  const unit = Math.max(1, Math.round(Math.min(sx, sy)));
  const cycle = (now % CYCLE_MS) / CYCLE_MS;

  air.clear().setVisible(sprite.visible).setAlpha(sprite.alpha);
  air.setDepth(Math.min(99, sprite.depth + 0.05));

  // Downdraft streaks: each lane is a phase-shifted column so the flow reads
  // as continuous air instead of a blinking row.
  STREAM_LANES.forEach((lane, index) => {
    const phase = (cycle + index / STREAM_LANES.length) % 1;
    const fade = 1 - phase;
    const x = Math.round(left + lane * w - unit / 2);
    const y = Math.round(feet + 1 + phase * TRAVEL * sy);
    air.fillStyle(0x9ad7f2, 0.28 + 0.32 * fade);
    air.fillRect(x - unit, y, unit * 2, Math.max(2, Math.round(5 * sy)));
    air.fillStyle(0xffffff, 0.5 + 0.5 * fade);
    air.fillRect(x, y, unit, Math.max(1, Math.round(3 * sy)));
  });

  // A lit line right under the soles anchors the flow to the feet.
  air.fillStyle(0xbfe6ff, 0.45);
  air.fillRect(Math.round(left), Math.round(feet), Math.round(w), unit);

  // Displaced air sliding outward from the soles, fading as it spreads.
  [[-1, 0.1], [-1, 0.6], [1, 0.35], [1, 0.85]].forEach(([dir, offset]) => {
    const phase = (cycle + offset) % 1;
    const spread = Math.round((1 + phase * 5) * unit);
    const x = dir < 0
      ? Math.round(left - spread - unit * 3)
      : Math.round(left + w + spread);
    air.fillStyle(0xc9e9ff, 0.6 * (1 - phase));
    air.fillRect(x, Math.round(feet + unit), unit * 3, unit);
  });
}

export function clearHeroLevitating(scene: Phaser.Scene): void {
  drafts.get(scene)?.destroy();
  drafts.delete(scene);
}
