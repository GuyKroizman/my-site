import type Phaser from 'phaser';
import type { GameContext, WandZap } from './context';

type Bolt = WandZap & { age: number; duration: number };
type State = { bolts: Bolt[]; graphic: Phaser.GameObjects.Graphics; lastTime: number };
const states = new WeakMap<Phaser.Scene, State>();

export function showWandZap(scene: Phaser.Scene, context: GameContext, zap: WandZap): void {
  let state = states.get(scene);
  if (!state) {
    state = { bolts: [], graphic: scene.add.graphics().setDepth(98), lastTime: scene.time.now };
    states.set(scene, state);
  }
  // Presentation only: no RNG, damage, actor readiness or simulation deadlines.
  const distance = Math.hypot(zap.toX - zap.fromX, zap.toY - zap.fromY);
  state.bolts.push({ ...zap, age: 0, duration: Math.min(420, 160 + distance * 18) });
  if (state.bolts.length > 32) state.bolts.shift();
  updateWandZaps(scene, context, scene.time.now, false);
}

export function updateWandZaps(scene: Phaser.Scene, context: GameContext, now: number, paused: boolean): void {
  const state = states.get(scene);
  if (!state) return;
  const elapsed = Math.max(0, now - state.lastTime);
  state.lastTime = now;
  const g = state.graphic;
  g.clear();
  state.bolts = state.bolts.filter(bolt => {
    if (!paused) bolt.age += elapsed;
    if (bolt.age >= bolt.duration + 180) return false;
    const ice = bolt.damageType === 'ice', shock = bolt.damageType === 'shock';
    const color = ice ? 0x69cce6 : shock ? 0xb1a4ff : 0xf68a30;
    const core = ice ? 0xe5ffff : shock ? 0xf8f2ff : 0xffed9d;
    const sx = bolt.fromX * 16 + 8, sy = bolt.fromY * 16 + 8;
    const dx = (bolt.toX - bolt.fromX) * 16, dy = (bolt.toY - bolt.fromY) * 16;
    const length = Math.max(1, Math.hypot(dx, dy));
    const px = -dy / length, py = dx / length;
    const pixel = (x: number, y: number, size: number, tint: number, alpha: number) => {
      x = Math.round(x); y = Math.round(y);
      // Clip every spark/trail sample against current FOV, beneath the fog layer.
      if (!context.visibleTiles.has(`${Math.floor(x / 16)},${Math.floor(y / 16)}`) ||
          !context.visibleTiles.has(`${Math.floor((x + size - 1) / 16)},${Math.floor((y + size - 1) / 16)}`)) return;
      g.fillStyle(tint, alpha).fillRect(x, y, size, size);
    };
    if (bolt.age < bolt.duration) {
      const progress = bolt.age / bolt.duration;
      const head = progress * length;
      const tail = Math.min(head, shock ? 38 : 24);
      for (let offset = tail; offset >= 0; offset -= 2) {
        const fraction = (head - offset) / length;
        const zig = shock ? Math.sin((head - offset) * 0.8 + Math.floor(bolt.age / 45)) * 2 : 0;
        const x = sx + dx * fraction + px * zig, y = sy + dy * fraction + py * zig;
        pixel(x - 1, y - 1, 3, color, 0.25 + 0.65 * (1 - offset / Math.max(1, tail)));
        pixel(x, y, 1, core, 0.9);
      }
      const x = sx + dx * progress, y = sy + dy * progress;
      pixel(x - 2, y - 2, 5, color, 0.3);
      pixel(x - 1, y - 1, 3, core, 1);
      if (ice) {
        pixel(x - px * 4, y - py * 4, 1, core, 0.85);
        pixel(x + px * 4, y + py * 4, 1, core, 0.85);
      }
    } else {
      const age = (bolt.age - bolt.duration) / 180;
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        const radius = 2 + age * 8;
        pixel(sx + dx + Math.cos(angle) * radius, sy + dy + Math.sin(angle) * radius,
          2, i % 2 ? color : core, 1 - age);
      }
    }
    return true;
  });
  if (!state.bolts.length) clearWandZaps(scene);
}

export function clearWandZaps(scene: Phaser.Scene): void {
  states.get(scene)?.graphic.destroy();
  states.delete(scene);
}
