import type Phaser from 'phaser';
import type { GameContext } from './context';
import type { WandFusionResult } from './wandFusion';

// Presentation only. The merge and the potion consumption are already complete
// when this runs; nothing here advances simulation time, spends charges or
// changes entity readiness. Effects stay below the fog layer (100).

type Destroyable = { destroy(): void };

type FusionState = {
  active: boolean;
  objects: Set<Destroyable>;
  tweens: unknown[];
  hiddenSprites: Set<Phaser.GameObjects.Sprite>;
};

const states = new WeakMap<Phaser.Scene, FusionState>();

function stateFor(scene: Phaser.Scene): FusionState {
  let state = states.get(scene);
  if (!state) {
    state = {
      active: true,
      objects: new Set(),
      tweens: [],
      hiddenSprites: new Set(),
    };
    states.set(scene, state);
  }
  return state;
}

function destroyTracked(scene: Phaser.Scene, state: FusionState, object: Destroyable): void {
  (scene.tweens as any).killTweensOf?.(object);
  object.destroy();
  state.objects.delete(object);
}

function drawFlame(g: Phaser.GameObjects.Graphics, x: number, y: number, progress: number): void {
  g.clear();
  const fade = Math.max(0, 1 - progress);
  const frame = Math.floor(progress * 6);
  // Scorched splash, then three short tongues and rising sparks. Everything is
  // clipped to the impact tile so fire cannot reveal an unexplored neighbour.
  g.fillStyle(0x6d2418, 0.55 * fade).fillRect(x + 2, y + 12, 12, 3);
  for (let i = 0; i < 3; i++) {
    const seed = i * 5;
    const height = Math.max(1, Math.floor((8 + (frame + seed) % 5) * fade));
    const fx = x + 2 + i * 4;
    const lean = (frame + seed) % 3 - 1;
    g.fillStyle(0xa63824, 0.8 * fade).fillRect(fx, y + 12, 4, 2);
    g.fillStyle(0xd94e20, fade).fillRect(fx + 1, y + 15 - height, 2, Math.max(1, height - 2));
    g.fillStyle(0xf6a133, fade).fillRect(fx + 1 + lean, y + 13 - height, 1, 2);
    g.fillStyle(0xffe596, fade).fillRect(fx + 1 + (i % 2), y + 12, 1, 1);
    const rise = Math.min(10, (frame * 2 + seed) % 12);
    g.fillStyle(0xffbf54, fade).fillRect(fx + (frame + i) % 3, y + 10 - rise, 1, 1);
  }
}

function showFlameBurst(scene: Phaser.Scene, state: FusionState, x: number, y: number): void {
  const fire = scene.add.graphics().setDepth(98);
  state.objects.add(fire);
  const progress = { t: 0 };
  const redraw = () => drawFlame(fire, x * 16, y * 16, progress.t);
  redraw();
  const tween = scene.tweens.add({
    targets: progress,
    t: 1,
    duration: 420,
    ease: 'Linear',
    onUpdate: () => { if (state.active) redraw(); },
    onComplete: () => { if (state.active) destroyTracked(scene, state, fire); },
  });
  state.tweens.push(tween);
}

function showFusion(scene: Phaser.Scene, state: FusionState, fusion: WandFusionResult): void {
  const wand = fusion.wand;
  const merged = wand.sprite;
  if (!merged) return;

  // The real floor sprite waits at the meeting point while two ghost copies
  // carry the motion. This keeps the logical item visible and clickable even if
  // the animation is interrupted by a menu, floor change or scene shutdown.
  (scene.tweens as any).killTweensOf?.(merged);
  state.hiddenSprites.add(merged);
  merged.setAlpha(0);
  merged.setScale(0.35);

  const texture = wand.spriteTextureKey;
  const frame = wand.spriteFrame;
  const ghosts = [fusion.leftX, fusion.rightX].map(x =>
    scene.add.sprite(x * 16, fusion.rightY * 16, texture, frame).setOrigin(0).setDepth(98)
  );
  for (const ghost of ghosts) state.objects.add(ghost);

  const finalX = fusion.rightX * 16;
  const finalY = fusion.rightY * 16;
  let arrived = 0;
  const finish = () => {
    if (!state.active || ++arrived < 2) return;
    for (const ghost of ghosts) destroyTracked(scene, state, ghost);

    merged.setAlpha(0.85);
    const reveal = scene.tweens.add({
      targets: merged,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 220,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!state.active) return;
        state.hiddenSprites.delete(merged);
        const pulse = scene.tweens.add({
          targets: merged,
          alpha: { from: 0.7, to: 1 },
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        state.tweens.push(pulse);
      },
    });
    state.tweens.push(reveal);

    const glow = scene.add.graphics().setDepth(98);
    glow.setPosition(finalX + 8, finalY + 8);
    glow.fillStyle(0xffd36a, 0.9).fillCircle(0, 0, 7);
    state.objects.add(glow);
    const burst = scene.tweens.add({
      targets: glow,
      scaleX: 2.6,
      scaleY: 2.6,
      alpha: 0,
      duration: 320,
      ease: 'Sine.easeOut',
      onComplete: () => { if (state.active) destroyTracked(scene, state, glow); },
    });
    state.tweens.push(burst);
  };

  // The left wand slides into the right one; the right wand lifts, brightens
  // and snaps back down onto the fused sprite.
  const slide = scene.tweens.add({
    targets: ghosts[0],
    x: finalX,
    alpha: 0.65,
    duration: 280,
    ease: 'Sine.easeInOut',
    onComplete: finish,
  });
  const lift = scene.tweens.add({
    targets: ghosts[1],
    y: finalY - 5,
    alpha: 0.65,
    duration: 280,
    ease: 'Sine.easeInOut',
    yoyo: true,
    onComplete: finish,
  });
  state.tweens.push(slide, lift);
  showFlameBurst(scene, state, fusion.impactX, fusion.impactY);
}

/**
 * Show the Liquid Flame flask burst and, when the impact completed a wand pair,
 * the two-wands-into-one merge animation.
 */
export function showLiquidFlameShatter(
  scene: Phaser.Scene,
  context: GameContext,
  event: { x: number; y: number; fusion?: WandFusionResult }
): void {
  // Off-screen splashes remain logical (and saved), but must not draw reveals.
  if (!context.visibleTiles.has(`${event.x},${event.y}`)) return;
  const state = stateFor(scene);
  if (!state.active) return;
  showFlameBurst(scene, state, event.x, event.y);
  if (event.fusion) showFusion(scene, state, event.fusion);
}

export function clearWandFusionVisuals(scene: Phaser.Scene): void {
  const state = states.get(scene);
  if (!state) return;
  state.active = false;
  for (const tween of state.tweens) (tween as any)?.stop?.();
  state.tweens.length = 0;
  for (const object of [...state.objects]) destroyTracked(scene, state, object);
  for (const sprite of state.hiddenSprites) {
    (scene.tweens as any).killTweensOf?.(sprite);
    sprite.setAlpha(1);
    sprite.setScale(1);
  }
  state.hiddenSprites.clear();
  states.delete(scene);
}
