import type Phaser from 'phaser';
import type { GameContext, PoisonCloud } from './context';

// Poison gas, drawn as volume rather than a washed tile.
//
// Each gas cell contributes a wide faint haze, a handful of soft drifting puffs
// whose radii exceed the tile (so neighbouring cells fuse into one mass), two
// counter-rotating swirl arms of light motes, and a few motes rising through the
// cloud. Density builds from accumulated translucency instead of a shaded ball,
// which is what makes a diamond of cells read as one billowing cloud rather than
// a grid of green squares.
//
// Presentation only: nothing here touches gameplay state, saved data, FOV or
// Math.random. Every wobble is derived from the tile coordinate and a visual
// clock, so a paused menu freezes the cloud instead of reshuffling it.

const TILE = 16;
const EPSILON = 1e-9;
const PUFFS_PER_CELL = 5;
const SWIRL_ARMS = 2;
const SWIRL_MOTES_PER_ARM = 5;
const DRIFT_MOTES = 3;

// Toxic green ramp. Body is the bulk of the vapour, LIGHT adds the lit bellies
// and swirl arms, MOTE the bright specks travelling through it.
const BODY = 0x5d9330;
const LIGHT = 0x94cc52;
const MOTE = 0xeeffb8;

/** Depth of the gas body: above every actor, below the fog of war (100). */
const BODY_DEPTH = 98.9;
/** Swirls and motes sit just over the body so they are never muddied by it. */
const WISP_DEPTH = 99.1;

export type GasPuff = { x: number; y: number; r: number; alpha: number };
export type GasMote = { x: number; y: number; size: number; alpha: number; color: number };
export type GasCellLayout = { haze: GasPuff; puffs: GasPuff[]; motes: GasMote[] };

type Quad = { x: number; y: number; w: number; h: number; color: number; alpha: number };

type GasVisuals = {
  body: Phaser.GameObjects.Graphics;
  wisps: Phaser.GameObjects.Graphics;
  lastTime: number;
  /** Visual clock in ms. Advances only while the game is not paused. */
  clock: number;
};

const states = new WeakMap<Phaser.Scene, GasVisuals>();

/**
 * Deterministic 0..1 noise from a tile and a channel. Visuals must never draw
 * from the gameplay RNG stream, so per-cell variation comes from this hash.
 */
export function gasNoise(x: number, y: number, channel: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(channel | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * How solid a cloud still is: 0 when it expires, 1 while it is fresh. Clouds
 * swell in over a short birth ramp and then thin out and shrink to nothing, so
 * the outer rings of a dissipating cloud visibly evaporate first.
 */
export function gasDensity(cloud: PoisonCloud, simulationTime: number): number {
  const remaining = cloud.expiresAt - simulationTime;
  if (remaining <= EPSILON) return 0;
  // Legacy saves carry no birth time; they keep the old constant-density look.
  if (cloud.bornAt === undefined || cloud.expiresAt <= cloud.bornAt + EPSILON) return 1;
  const span = cloud.expiresAt - cloud.bornAt;
  const age = Math.max(0, simulationTime - cloud.bornAt);
  const grow = Math.min(1, age / 0.35);
  return Math.max(0, Math.min(1, grow)) * Math.max(0, Math.min(1, remaining / span));
}

/**
 * Puffs and motes for one gas tile. Pure: (x, y, clock, density) fully determine
 * the result, which keeps the visuals testable and replayable.
 */
export function gasCellLayout(x: number, y: number, time: number, density: number): GasCellLayout {
  const cx = x * TILE + TILE / 2;
  const cy = y * TILE + TILE / 2;
  const d = Math.max(0, Math.min(1, density));
  // A dissipating cloud shrinks toward the tile centre as well as fading.
  const scale = 0.7 + 0.3 * Math.min(1, d * 1.5);
  const t = time / 1000;

  // A few wide, very faint puffs per cell. Their radii exceed the tile, so
  // neighbouring cells of one cloud overlap heavily and fuse into a single soft
  // mass whose middle is denser than its rim: volume from accumulated haze, not
  // from a shaded ball.
  // Per-cell tone breaks the uniform "every cell the same" checkerboard: some
  // cells of a cloud are thicker than others, like real vapour.
  const tone = 0.7 + 0.6 * gasNoise(x, y, 97);
  const puffs: GasPuff[] = [];
  for (let i = 0; i < PUFFS_PER_CELL; i++) {
    const a = gasNoise(x, y, i * 3 + 1);
    const b = gasNoise(x, y, i * 3 + 2);
    const angle = t * (0.3 + a * 0.45) + b * Math.PI * 2;
    const orbit = (2.4 + a * 2.2) * scale;
    const r = (5.6 + b * 3.0) * scale + Math.sin(t * 0.9 + a * 5.5) * 0.7;
    puffs.push({
      x: cx + Math.cos(angle) * orbit,
      y: cy + Math.sin(angle * 0.9) * orbit * 0.85,
      r: Math.max(1.8, r),
      alpha: (0.085 + 0.03 * b) * tone * (0.25 + 0.75 * d)
    });
  }

  const motes: GasMote[] = [];
  // Two counter-rotating swirl arms: an advancing spiral of light motes, so the
  // cloud looks like it is turning in on itself rather than only pulsing.
  for (let arm = 0; arm < SWIRL_ARMS; arm++) {
    const direction = arm === 0 ? 1 : -1;
    const spin = t * 1.9 * direction + gasNoise(x, y, 41 + arm) * Math.PI * 2;
    for (let step = 0; step < SWIRL_MOTES_PER_ARM; step++) {
      const theta = spin + step * 0.42 * direction;
      const radius = (2.0 + step * 1.05) * scale;
      motes.push({
        x: cx + Math.cos(theta) * radius,
        y: cy + Math.sin(theta) * radius * 0.82,
        // One chunky mote per arm keeps the swirl readable at 1x; the rest of
        // the arm tapers to single pixels so it reads as vapour, not a necklace.
        size: step === 1 ? 2 : 1,
        alpha: (0.4 - step * 0.06) * d,
        color: step >= 3 ? MOTE : LIGHT
      });
    }
  }

  // Motes rising through the volume. They fade in and out at the tile edges, so
  // the cloud always reads as contained by the cell it occupies.
  for (let i = 0; i < DRIFT_MOTES; i++) {
    const seed = gasNoise(x, y, 71 + i);
    const cycle = 1.7 + seed * 1.5;
    const phase = (t / cycle + seed) % 1;
    motes.push({
      x: cx + Math.sin(t * 1.7 + seed * 9) * 2.2 * scale,
      y: cy + 6 - phase * 12,
      size: 1,
      alpha: 0.55 * d * Math.sin(Math.PI * phase),
      color: MOTE
    });
  }

  return { haze: { x: cx, y: cy, r: 11 * scale, alpha: 0.085 * d }, puffs, motes };
}

/** One 1px-tall row of a chunky pixel disc, keeping the silhouette round. */
function collectDisc(out: Quad[], cx: number, cy: number, radius: number, color: number, alpha: number): void {
  if (alpha <= 0.015) return;
  const r = Math.max(1, Math.round(radius));
  const ox = Math.round(cx);
  const oy = Math.round(cy);
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy + 0.25)) - 0.5);
    if (half < 1) continue;
    out.push({ x: ox - half, y: oy + dy, w: half * 2, h: 1, color, alpha });
  }
}

/**
 * Two discs per puff: the wide body and an offset lit belly. Deliberately soft:
 * the volume comes from many overlapping discs, so a hard rim on each one would
 * outline them as separate balls.
 */
function collectPuff(out: Quad[], puff: GasPuff): void {
  collectDisc(out, puff.x, puff.y, puff.r, BODY, puff.alpha);
  collectDisc(out, puff.x - 0.6, puff.y - 0.8, puff.r * 0.62, LIGHT, puff.alpha * 0.32);
}

/** A quad may only paint complete tiles that are explored, visible and open. */
function paintable(context: GameContext, quad: Quad): boolean {
  const visible = context.visibleTiles;
  const level = context.currentLevel;
  const x0 = Math.floor(quad.x / TILE);
  const x1 = Math.floor((quad.x + quad.w - 1) / TILE);
  const y = Math.floor(quad.y / TILE);
  for (let x = x0; x <= x1; x++) {
    if (visible && !visible.has(`${x},${y}`)) return false;
    // Never spill onto a wall face: gas lives in the room, not in the stone.
    if (level && level[y]?.[x] !== 0) return false;
  }
  return true;
}

/**
 * Draws every quad with as few style switches as possible. Grouping by
 * quantised colour+alpha keeps a large cloud from re-issuing a fill style for
 * each of its thousands of pixels.
 */
function flush(g: Phaser.GameObjects.Graphics, context: GameContext, quads: Quad[]): void {
  const groups = new Map<number, Quad[]>();
  for (const quad of quads) {
    const alpha = Math.max(0, Math.min(1, quad.alpha));
    if (alpha <= 0.015) continue;
    if (!paintable(context, quad)) continue;
    const key = (quad.color & 0xffffff) * 256 + Math.round(alpha * 255);
    const list = groups.get(key);
    if (list) list.push(quad);
    else groups.set(key, [quad]);
  }
  for (const [key, list] of groups) {
    g.fillStyle(Math.floor(key / 256), (key % 256) / 255);
    for (const quad of list) g.fillRect(quad.x, quad.y, quad.w, quad.h);
  }
}

/**
 * Repaints the gas layer for the current simulation state. `now` is the scene
 * clock (ms) and only drives the animation; expiry and density come from
 * `context.simulationTime`, exactly like the gameplay code.
 */
export function updateGasVisuals(
  scene: Phaser.Scene,
  context: GameContext,
  now: number,
  paused = false
): void {
  const simulationTime = context.simulationTime ?? 0;
  const clouds = (context.poisonClouds ?? []).filter(cloud => cloud.expiresAt > simulationTime + EPSILON);
  if (!clouds.length) {
    clearGasVisuals(scene);
    return;
  }

  let state = states.get(scene);
  if (!state) {
    state = {
      body: scene.add.graphics().setDepth(BODY_DEPTH),
      wisps: scene.add.graphics().setDepth(WISP_DEPTH),
      lastTime: now,
      clock: 0
    };
    states.set(scene, state);
  }
  state.clock = (state.clock + (paused ? 0 : Math.max(0, now - state.lastTime))) % 1e6;
  state.lastTime = now;
  state.body.clear();
  state.wisps.clear();

  const bodyQuads: Quad[] = [];
  const wispQuads: Quad[] = [];
  for (const cloud of clouds) {
    const density = gasDensity(cloud, simulationTime);
    if (density <= 0.02) continue;
    // Gas is only ever drawn where the hero can currently see it.
    if (context.visibleTiles && !context.visibleTiles.has(`${cloud.x},${cloud.y}`)) continue;
    const { haze, puffs, motes } = gasCellLayout(cloud.x, cloud.y, state.clock, density);
    // One wide, faint haze disc per cell bridges the gaps between puffs and ties
    // neighbouring cells of the same cloud into a single volume.
    collectDisc(bodyQuads, haze.x, haze.y, haze.r, BODY, haze.alpha);
    for (const puff of puffs) collectPuff(bodyQuads, puff);
    for (const mote of motes) {
      wispQuads.push({
        x: Math.round(mote.x - mote.size / 2),
        y: Math.round(mote.y - mote.size / 2),
        w: mote.size,
        h: mote.size,
        color: mote.color,
        alpha: mote.alpha
      });
    }
  }

  flush(state.body, context, bodyQuads);
  flush(state.wisps, context, wispQuads);
}

export function clearGasVisuals(scene: Phaser.Scene): void {
  const state = states.get(scene);
  if (!state) return;
  state.body.destroy();
  state.wisps.destroy();
  states.delete(scene);
}
