import type Phaser from 'phaser';
import type { GameContext, PoisonCloud } from './context';

// Poison gas, drawn as one volume per cloud rather than a tint per tile.
//
// Gameplay owns a set of cells, but rendering must not echo that grid. The cells
// of a connected cloud instead define a smooth density field: every cell feeds a
// soft radial influence and the field is the union of those influences. One big
// cloud is then drawn as a swarm of large, heavily overlapping blobs sampled off
// that field, so the cloud has a continuous body with no seams at cell edges.
// Colour follows local density (dark rim -> lit core), a slow coherent drift
// makes the whole mass churn, three spiral arms of motes rotate around the
// cloud's centre and a few specks rise through the volume.
//
// Presentation only: nothing here touches gameplay state, saved data, FOV or
// Math.random. Every wobble comes from a coordinate hash and a visual clock, so
// a paused menu freezes the cloud instead of reshuffling it.

const TILE = 16;
const EPSILON = 1e-9;
/** Radius of one cell's influence in px, well over a tile so cells fuse. */
const FIELD_RADIUS = 21;
/** A cell is fully dense out to here (roughly its own tile) before falling off. */
const FIELD_PLATEAU = 7;
/** Grid spacing of the body blobs. Well under the blob radius, so they fuse. */
const SAMPLE_STEP = 8;
/** Below this field strength a cell edge is just haze, not body. */
const MIN_FIELD = 0.09;

// Toxic green ramp, applied by local density: a dark fringe, a green bulk, a lit
// belly and a bright core. Banding with jitter is what gives the cloud its
// billows without drawing any hard contour.
const RIM = 0x3c5f22;
const BODY = 0x6a9f3a;
const LIGHT = 0x9ed45c;
const CORE = 0xd8f59a;
const MOTE = 0xeeffb8;

/** Depth of the gas body: above every actor, below the fog of war (100). */
const BODY_DEPTH = 98.9;
/** Swirls and motes sit just over the body so they are never muddied by it. */
const WISP_DEPTH = 99.1;

export type GasCell = { x: number; y: number; density: number };
export type GasBlob = { x: number; y: number; r: number; alpha: number; color: number };
export type GasMote = { x: number; y: number; size: number; alpha: number; color: number };

/** One connected cloud: gameplay cells plus the bounds and centre it implies. */
export type GasCluster = {
  cells: GasCell[];
  /** Tile bounds, inclusive. */
  minX: number; minY: number; maxX: number; maxY: number;
  /** Centre and reach in px, used to orbit the swirl arms. */
  cx: number; cy: number; radius: number;
};

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
 * Deterministic 0..1 noise from a coordinate and a channel. Visuals must never
 * draw from the gameplay RNG stream, so per-sample variation comes from this.
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
  const grow = Math.min(1, Math.max(0, simulationTime - cloud.bornAt) / 0.35);
  return grow * Math.max(0, Math.min(1, remaining / span));
}

/**
 * Groups living cloud cells into connected clouds and measures each one. Cells
 * that do not touch stay separate masses: the field never bridges a gap.
 */
export function gasClusters(clouds: PoisonCloud[], simulationTime: number): GasCluster[] {
  const cells: GasCell[] = [];
  for (const cloud of clouds) {
    const density = gasDensity(cloud, simulationTime);
    if (density <= 0.02) continue;
    cells.push({ x: cloud.x, y: cloud.y, density });
  }
  const byKey = new Map<string, GasCell>();
  for (const cell of cells) byKey.set(`${cell.x},${cell.y}`, cell);

  const clusters: GasCluster[] = [];
  const seen = new Set<string>();
  for (const start of cells) {
    const startKey = `${start.x},${start.y}`;
    if (seen.has(startKey)) continue;
    const group: GasCell[] = [];
    const queue = [start];
    seen.add(startKey);
    while (queue.length) {
      const cell = queue.pop()!;
      group.push(cell);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const key = `${cell.x + dx},${cell.y + dy}`;
        const next = byKey.get(key);
        if (!next || seen.has(key)) continue;
        seen.add(key);
        queue.push(next);
      }
    }
    clusters.push(measureCluster(group));
  }
  return clusters;
}

function measureCluster(cells: GasCell[]): GasCluster {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let sumX = 0, sumY = 0;
  for (const cell of cells) {
    minX = Math.min(minX, cell.x);
    minY = Math.min(minY, cell.y);
    maxX = Math.max(maxX, cell.x);
    maxY = Math.max(maxY, cell.y);
    sumX += cell.x * TILE + TILE / 2;
    sumY += cell.y * TILE + TILE / 2;
  }
  const cx = sumX / cells.length;
  const cy = sumY / cells.length;
  let radius = 0;
  for (const cell of cells) {
    radius = Math.max(radius, Math.hypot(cell.x * TILE + TILE / 2 - cx, cell.y * TILE + TILE / 2 - cy));
  }
  return { cells, minX, minY, maxX, maxY, cx, cy, radius: radius + TILE * 0.6 };
}

/**
 * Smooth cloud density at a pixel: the union of every cell's radial influence.
 * Continuity is the whole point, so neighbouring cells produce a single hump
 * instead of a bright tile-centre and a seam between tiles.
 */
export function gasField(cluster: GasCluster, px: number, py: number): number {
  let open = 1;
  for (const cell of cluster.cells) {
    const dx = px - (cell.x * TILE + TILE / 2);
    const dy = py - (cell.y * TILE + TILE / 2);
    const dist = Math.hypot(dx, dy);
    if (dist >= FIELD_RADIUS) continue;
    // Flat-topped kernel: a cell is fully dense across its own footprint and
    // only its shoulder fades. Adjacent cells therefore overlap at full density,
    // so the field is one plateau with a soft cloud edge, not a row of humps.
    const shoulder = Math.max(0, 1 - Math.max(0, dist - FIELD_PLATEAU) / (FIELD_RADIUS - FIELD_PLATEAU));
    open *= 1 - cell.density * shoulder * shoulder;
  }
  return 1 - open;
}

/** Colour band for a density, with a per-sample nudge so no contour rings show. */
function gasColor(field: number, jitter: number): number {
  const value = field + (jitter - 0.5) * 0.14;
  if (value > 0.74) return CORE;
  if (value > 0.48) return LIGHT;
  if (value > 0.26) return BODY;
  return RIM;
}

/**
 * Body blobs and motes for one cloud at a given visual clock. Pure: the cluster
 * and the time fully determine the result, which keeps it testable and lets a
 * paused game freeze the animation exactly.
 */
export function gasCloudLayout(cluster: GasCluster, time: number): { blobs: GasBlob[]; motes: GasMote[] } {
  const t = time / 1000;
  const blobs: GasBlob[] = [];
  const x0 = cluster.minX * TILE - 6;
  const x1 = (cluster.maxX + 1) * TILE + 6;
  const y0 = cluster.minY * TILE - 6;
  const y1 = (cluster.maxY + 1) * TILE + 6;

  for (let gy = y0; gy <= y1; gy += SAMPLE_STEP) {
    for (let gx = x0; gx <= x1; gx += SAMPLE_STEP) {
      const i = Math.floor(gx / SAMPLE_STEP);
      const j = Math.floor(gy / SAMPLE_STEP);
      const nx = gasNoise(i, j, 11);
      const ny = gasNoise(i, j, 13);
      const nr = gasNoise(i, j, 17);
      // Drift is a smooth function of position, so neighbouring blobs move
      // together and the cloud churns as one body instead of boiling per blob.
      const x = gx + (nx - 0.5) * SAMPLE_STEP * 1.0
        + Math.sin(t * 0.45 + gy * 0.021) * 2.4 + Math.sin(t * 0.23 + gx * 0.015) * 1.8;
      const y = gy + (ny - 0.5) * SAMPLE_STEP * 1.0
        + Math.cos(t * 0.38 + gx * 0.019) * 2.0 + Math.sin(t * 0.29 + gy * 0.017) * 1.4;
      const field = gasField(cluster, x, y);
      if (field < MIN_FIELD) continue;
      const pulse = 0.93 + 0.08 * Math.sin(t * 0.85 + nr * Math.PI * 2);
      // Slow low-frequency billows on top of the field: the body gains lumps and
      // hollows that travel with the drift, instead of one uniform dome.
      const billow = 0.86 + 0.24 * (0.5 + 0.5 * Math.sin(x * 0.085 + t * 0.35) * Math.sin(y * 0.1 - t * 0.3));
      blobs.push({
        x, y,
        // Dense areas are made of bigger blobs, which is what turns the field
        // into a rounded body with a soft fringe rather than a flat wash.
        r: (4.6 + 9.8 * field) * pulse * (0.9 + 0.1 * billow),
        alpha: (0.062 + 0.012 * field) * pulse * billow,
        color: gasColor(field * billow * 1.1, nr)
      });
    }
  }

  const motes: GasMote[] = [];
  // Two long spiral wisps turning around the cloud's own centre. Sampled densely
  // along the arc so they read as curved streaks of vapour sweeping across tile
  // borders, rather than as scattered dots inside each cell.
  for (let arm = 0; arm < 2; arm++) {
    const direction = arm ? -1 : 1;
    const base = gasNoise(cluster.minX, cluster.minY, 31 + arm) * Math.PI * 2;
    const sweep = 2.6 + arm * 1.1;
    const steps = 30;
    for (let step = 0; step < steps; step++) {
      const reach = (step + 1) / steps;
      const theta = base + direction * (t * 0.7 + reach * sweep);
      const radius = cluster.radius * (0.16 + reach * 0.8);
      const mx = cluster.cx + Math.cos(theta) * radius;
      const my = cluster.cy + Math.sin(theta) * radius * 0.85;
      const field = gasField(cluster, mx, my);
      if (field < 0.12) continue;
      motes.push({
        x: mx, y: my,
        // The middle of the arc is a chunkier pixel run, so the wisp reads as a
        // curve rather than a dotted line; the ends taper away.
        size: reach > 0.35 && reach < 0.8 ? 2 : 1,
        alpha: (0.16 + 0.22 * reach) * field,
        color: reach > 0.5 ? MOTE : LIGHT
      });
    }
  }
  // A few brighter specks riding the densest part of the cloud.
  for (let i = 0; i < 6; i++) {
    const seed = gasNoise(cluster.minX + i, cluster.maxY, 53);
    const angle = seed * Math.PI * 2 + t * 0.5 * (i % 2 ? -1 : 1);
    const radius = cluster.radius * (0.15 + 0.45 * seed);
    const mx = cluster.cx + Math.cos(angle) * radius;
    const my = cluster.cy + Math.sin(angle) * radius * 0.85;
    const field = gasField(cluster, mx, my);
    if (field < 0.35) continue;
    motes.push({ x: mx, y: my, size: 2, alpha: 0.3 * field, color: MOTE });
  }
  // Specks rising through the volume, one per cell, phase-staggered by hash.
  for (const cell of cluster.cells) {
    const seed = gasNoise(cell.x, cell.y, 71);
    const cycle = 2.1 + seed * 1.7;
    const phase = (t / cycle + seed) % 1;
    motes.push({
      x: cell.x * TILE + TILE / 2 + Math.sin(t * 1.4 + seed * 9) * 5,
      y: cell.y * TILE + TILE / 2 + 6 - phase * 15,
      size: 1,
      alpha: 0.26 * cell.density * Math.sin(Math.PI * phase),
      color: MOTE
    });
  }

  return { blobs, motes };
}

/** A pixel row of a chunky disc, so the cloud keeps the game's pixel language. */
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

/** A tile may be painted only while it is explored, visible and open floor. */
function openTile(context: GameContext, x: number, y: number): boolean {
  if (context.visibleTiles && !context.visibleTiles.has(`${x},${y}`)) return false;
  return context.currentLevel?.[y]?.[x] === 0;
}

/**
 * Trims a 1px-tall row to the longest stretch of paintable tiles it covers, so a
 * soft blob stops cleanly at a wall or the edge of sight instead of being
 * dropped whole (which would cut a hole in the cloud) or leaking past the fog.
 */
function clipRow(context: GameContext, quad: Quad): Quad | null {
  const y = Math.floor(quad.y / TILE);
  const first = Math.floor(quad.x / TILE);
  const last = Math.floor((quad.x + quad.w - 1) / TILE);
  if (first === last) return openTile(context, first, y) ? quad : null;

  let bestStart = 0, bestLength = 0;
  let runStart = -1, runLength = 0;
  for (let x = quad.x; x < quad.x + quad.w; x++) {
    if (openTile(context, Math.floor(x / TILE), y)) {
      if (runStart < 0) { runStart = x; runLength = 0; }
      runLength++;
    } else if (runStart >= 0) {
      if (runLength > bestLength) { bestLength = runLength; bestStart = runStart; }
      runStart = -1;
    }
  }
  if (runStart >= 0 && runLength > bestLength) { bestLength = runLength; bestStart = runStart; }
  return bestLength > 0 ? { ...quad, x: bestStart, w: bestLength } : null;
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
    const row = clipRow(context, quad);
    if (!row) continue;
    const key = (row.color & 0xffffff) * 256 + Math.round(alpha * 255);
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
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
  const clusters = clouds.length ? gasClusters(clouds, simulationTime) : [];
  const visible = context.visibleTiles;
  const shown = visible
    ? clusters.filter(cluster => cluster.cells.some(cell => visible.has(`${cell.x},${cell.y}`)))
    : clusters;
  if (!shown.length) {
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
  for (const cluster of shown) {
    const { blobs, motes } = gasCloudLayout(cluster, state.clock);
    for (const blob of blobs) collectDisc(bodyQuads, blob.x, blob.y, blob.r, blob.color, blob.alpha);
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
