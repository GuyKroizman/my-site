import type Phaser from 'phaser';
import type { GameContext } from './context';
import { drawFlask } from './potionTextures';

// The thrower's burst: a small flame flask arcs from the thrower to the
// telegraphed tile and shatters there; the floor splash follows the flight.
// Presentation only — the damage still resolves through the game logic.

const FLIGHT_DURATION = 500;
const FLAME_FLASK = "flame-flask";
const SHARD_COUNT = 6;

type State = { flasks: Phaser.GameObjects.GameObject[] };
const states = new WeakMap<Phaser.Scene, State>();

function ensureFlameFlaskTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(FLAME_FLASK)) return;
  const g = scene.make.graphics(undefined, false);
  drawFlask(g, 0xff8a2b);
  g.generateTexture(FLAME_FLASK, 16, 16);
  g.destroy();
}

export function showFirePotionThrown(
  scene: Phaser.Scene,
  context: GameContext,
  from: { x: number; y: number },
  to: { x: number; y: number },
  onArrived?: () => void
): void {
  const map = context.map;
  if (!map) return;
  const sx = map.tileToWorldX(from.x), sy = map.tileToWorldY(from.y);
  const tx = map.tileToWorldX(to.x), ty = map.tileToWorldY(to.y);
  if (sx == null || sy == null || tx == null || ty == null) return;
  // Like the splash, a flask aimed at unseen tiles stays out of sight.
  if (!context.visibleTiles.has(`${to.x},${to.y}`)) return;
  ensureFlameFlaskTexture(scene);
  let state = states.get(scene);
  if (!state) states.set(scene, state = { flasks: [] });
  const flight = (target: Phaser.GameObjects.GameObject,
                  onEnd: () => void,
                  onUpdate?: (tween: Phaser.Tweens.Tween) => void) =>
    scene.tweens.add({
      targets: target,
      x: tx, y: ty,
      duration: FLIGHT_DURATION,
      ease: 'Sine.easeInOut',
      onComplete: onEnd,
      onUpdate,
    });
  // A soft glow under the flask reads better on the floor tiles.
  const glow = scene.add.graphics().setDepth(284);
  glow.fillStyle(0xff8a2b, 0.4);
  glow.fillCircle(sx + 8, sy + 8, 13);
  state.flasks.push(glow);
  const flask = scene.add.image(sx, sy, FLAME_FLASK)
    .setOrigin(0.5, 0.5)
    .setScale(1)
    .setDepth(285);
  state.flasks.push(flask);
  flight(glow, () => scene.tweens.add({ targets: glow, alpha: 0, duration: 400 }));
  flight(flask, () => {
    // The flask shatters: fragments burst outward, then the floor splash follows.
    flask.destroy();
    for (let i = 0; i < SHARD_COUNT; i++) {
      const angle = (i / SHARD_COUNT) * Math.PI * 2;
      const range = 14;
      const end = range * 2.2;
      const shard = scene.add.image(tx + Math.cos(angle) * range, ty + Math.sin(angle) * range, FLAME_FLASK)
        .setOrigin(0.5, 0.5)
        .setScale(0.45)
        .setTint(0xffa86a)
        .setDepth(285);
      state!.flasks.push(shard);
      scene.tweens.add({
        targets: shard,
        x: tx + Math.cos(angle) * end, y: ty + Math.sin(angle) * end,
        alpha: 0, duration: 320, ease: 'Back.easeOut',
      });
    }
    onArrived?.();
  }, (tween) => {
    // Size 1 when thrown, biggest part-way through the flight.
    flask.setScale(1 + 0.15 * Math.sin(Math.max(0, Math.min(1, tween.progress)) * Math.PI));
  });
}

export function clearFirePotionThrows(scene: Phaser.Scene): void {
  const state = states.get(scene);
  if (!state) return;
  for (const flask of state.flasks) {
    scene.tweens.killTweensOf(flask);
    flask.destroy();
  }
  states.delete(scene);
}
