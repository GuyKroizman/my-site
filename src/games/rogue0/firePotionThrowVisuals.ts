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

type FlameState = { groups: Phaser.GameObjects.Graphics[] };
const flameStates = new WeakMap<Phaser.Scene, FlameState>();

/** Small flame columns above a fire burst, mirroring the grass-burn style. */
export function showFireBurstFlames(scene: Phaser.Scene, context: GameContext,
                                    cells: Array<{ x: number; y: number }>): void {
  const map = context.map;
  if (!map) return;
  let state = flameStates.get(scene);
  if (!state) flameStates.set(scene, state = { groups: [] });
  for (const cell of cells) {
    if (!context.visibleTiles.has(`${cell.x},${cell.y}`)) continue;
    const group = scene.add.graphics().setDepth(286);
    state.groups.push(group);
    const x = map.tileToWorldX(cell.x), y = map.tileToWorldY(cell.y);
    if (x == null || y == null) continue;
    const pixel = (px: number, py: number, w: number, h: number, color: number, alpha: number) => {
      // Never paint over tiles the player cannot see.
      if (!context.visibleTiles.has(`${Math.floor(px / 16)},${Math.floor(py / 16)}`) ||
          !context.visibleTiles.has(`${Math.floor((px + w - 1) / 16)},${Math.floor((py + h - 1) / 16)}`)) return;
      group.fillStyle(color, alpha);
      group.fillRect(px, py, w, h);
    };
    // Golden core and red tongues rising from the tile, plus drifting smoke.
    pixel(x + 5, y + 3, 6, 2, 0xffe596, 0.8);
    pixel(x + 3, y + 6, 10, 3, 0xf58427, 0.6);
    pixel(x + 4, y + 8, 8, 5, 0xa63824, 0.8);
    pixel(x + 5, y + 10, 6, 4, 0xd94e20, 1);
    pixel(x + 6, y + 13, 4, 2, 0x282320, 0.5);
    for (const i of [0, 3, 6]) pixel(x + 8 + i, y + 2, 1, 10, 0xffbf54, 0.6);
    scene.tweens.add({ targets: group, alpha: 0, duration: 500, onComplete: () => group.destroy() });
  }
}

export function clearFireBurstFlames(scene: Phaser.Scene): void {
  const state = flameStates.get(scene);
  if (!state) return;
  for (const group of state.groups) {
    scene.tweens.killTweensOf(group);
    group.destroy();
  }
  flameStates.delete(scene);
}
