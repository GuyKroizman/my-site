import type Phaser from 'phaser';
import type { GameContext } from './context';
import { actorOriginY, worldDepth } from './rendering';

type Cell = { x: number; y: number; age: number; delay: number; grass: Phaser.GameObjects.Sprite };
type BurnVisuals = { cells: Cell[]; fire: Phaser.GameObjects.Graphics; lastTime: number };
const burns = new WeakMap<Phaser.Scene, BurnVisuals>();
const DURATION = 2400;

export function showGrassBurn(scene: Phaser.Scene, context: GameContext, cells: Array<{ x: number; y: number }>): void {
  const visible = cells.filter(({ x, y }) => context.visibleTiles.has(`${x},${y}`));
  if (!visible.length) return;
  let state = burns.get(scene);
  if (!state) {
    state = { cells: [], fire: scene.add.graphics().setDepth(98), lastTime: scene.time.now };
    burns.set(scene, state);
  }
  visible.forEach(({ x, y }, index) => {
    if (state!.cells.some(cell => cell.x === x && cell.y === y)) return;
    // Logical spread is immediate; stagger the visual wave along traversal order.
    const grass = scene.add.sprite(x * 16, y * 16, `tall-grass-${(x * 7 + y * 11) % 3}`);
    grass.setOrigin(0, actorOriginY(grass.height)).setDepth(worldDepth(y * 16, 'terrain'));
    state!.cells.push({ x, y, age: 0, delay: Math.min(index * 35, 350), grass });
  });
  updateGrassBurns(scene, context, scene.time.now, false);
}

export function updateGrassBurns(scene: Phaser.Scene, context: GameContext, now: number, paused: boolean): void {
  const state = burns.get(scene);
  if (!state) return;
  const elapsed = Math.max(0, now - state.lastTime);
  state.lastTime = now;
  if (!paused) for (const cell of state.cells) cell.age += elapsed;
  // Visibility is checked every frame, even while a menu pauses the animation.
  state.fire.clear();
  state.cells = state.cells.filter(cell => {
    const age = cell.age - cell.delay;
    if (age >= DURATION) { cell.grass.destroy(); return false; }
    const visible = context.visibleTiles.has(`${cell.x},${cell.y}`);
    cell.grass.setVisible(visible);
    const progress = Math.max(0, age) / DURATION;
    cell.grass.setTint(age < 0 ? 0xffffff : progress < 0.22 ? 0xc4a34f : progress < 0.48 ? 0x765035 : 0x302a28);
    cell.grass.setAlpha(Math.max(0, 1 - progress * 1.7));
    cell.grass.setScale(1, Math.max(0.3, 1 - progress * 0.7));
    if (!visible || age < 0) return true;
    const x = cell.x * 16, y = cell.y * 16;
    const frame = Math.floor(age / 70);
    const fade = Math.min(1, (DURATION - age) / 700);
    const pixel = (px: number, py: number, w: number, h: number, color: number, alpha = 1) => {
      // Flames and drifting smoke must never reveal an unexplored neighboring tile.
      if (!context.visibleTiles.has(`${Math.floor(px / 16)},${Math.floor(py / 16)}`) ||
          !context.visibleTiles.has(`${Math.floor((px + w - 1) / 16)},${Math.floor((py + h - 1) / 16)}`)) return;
      state.fire.fillStyle(color, alpha * fade).fillRect(px, py, w, h);
    };
    // Charred ground, then stepped red/orange tongues with small golden cores.
    pixel(x + 2, y + 12, 12, 3, 0x282320, 0.6);
    for (let i = 0; i < 3; i++) {
      const seed = cell.x * 13 + cell.y * 7 + i * 5;
      const height = Math.max(2, Math.floor((9 + (frame + seed) % 6) * Math.min(1, (DURATION - age) / 1000)));
      const fx = x + 2 + i * 4;
      const lean = (frame + seed) % 3 - 1;
      pixel(fx, y + 12, 4, 3, 0xa63824, 0.8);
      pixel(fx + 1, y + 16 - height, 2, Math.max(2, height - 3), 0xd94e20);
      pixel(fx + 1 + lean, y + 14 - height, 1, 3, 0xf6a133);
      pixel(fx + 1, y + 17 - height, 2, Math.max(1, height - 4), 0xf58427);
      pixel(fx + 1 + (i % 2), y + 12, 1, 2, 0xffe596);
      const rise = (frame * 2 + seed) % 20;
      pixel(fx + (frame + i) % 3, y + 8 - rise, 1, 1, 0xffbf54, 0.9);
      const smokeRise = (frame + i * 6) % 22;
      pixel(fx + Math.floor(smokeRise / 6), y + 6 - smokeRise, 3, 3, 0x858078, 0.25);
    }
    return true;
  });
  if (!state.cells.length) clearGrassBurns(scene);
}

export function clearGrassBurns(scene: Phaser.Scene): void {
  const state = burns.get(scene);
  if (!state) return;
  for (const cell of state.cells) cell.grass.destroy();
  state.fire.destroy();
  burns.delete(scene);
}
