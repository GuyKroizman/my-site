import type Phaser from 'phaser';
import type { Entity } from './entity';
import type { GameContext } from './context';

type Cue = { label: Phaser.GameObjects.Text; x: number; y: number; born: number };
const cues = new WeakMap<Phaser.Scene, Cue[]>();

export function showSurpriseVisual(scene: Phaser.Scene, target: Entity): void {
  const { x, y } = target;
  if (x === undefined || y === undefined || !target.sprite?.visible ||
      !target.context.visibleTiles.has(`${x},${y}`)) return;
  const label = scene.add.text(x * 16 + 12, y * 16, '!', {
    fontFamily: 'monospace', fontSize: '9px', fontStyle: 'bold', color: '#ffda65',
    stroke: '#302015', strokeThickness: 1, resolution: 4
  }).setOrigin(0.5, 1).setDepth(99);
  const entries = cues.get(scene) ?? [];
  entries.push({ label, x, y, born: scene.time.now });
  cues.set(scene, entries);
  updateSurpriseVisuals(scene, target.context, scene.time.now);
}

export function updateSurpriseVisuals(scene: Phaser.Scene, context: GameContext, now: number): void {
  const remaining: Cue[] = [];
  for (const cue of cues.get(scene) ?? []) {
    const age = now - cue.born;
    if (age >= 650) { cue.label.destroy(); continue; }
    const wx = cue.x * 16 + 12, wy = cue.y * 16 - age / 650 * 8;
    cue.label.setPosition(wx, wy).setAlpha(Math.min(1, (650 - age) / 450));
    // Never reveal a hidden target or let the glyph rise into unknown space.
    cue.label.setVisible(context.visibleTiles.has(`${cue.x},${cue.y}`) &&
      context.visibleTiles.has(`${Math.floor(wx / 16)},${Math.floor((wy - 4) / 16)}`));
    remaining.push(cue);
  }
  cues.set(scene, remaining);
}

export function clearSurpriseVisuals(scene: Phaser.Scene): void {
  for (const cue of cues.get(scene) ?? []) cue.label.destroy();
  cues.delete(scene);
}
