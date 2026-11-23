import type Phaser from "phaser";

export const BOSS_TEXTURE = "monster-boss-blob";
export const BOSS_WIGGLE_ANIM = "monster-boss-wiggle";
export const BOSS_WIGGLE_FRAMES = 8;
export const BOSS_GAZES = ['center', 'left', 'right', 'up', 'down'] as const;
export const BOSS_GAZE_COUNT = BOSS_GAZES.length;
// How many full tentacle waves pass before the eye darts to a new direction.
// At 10fps and 8 wiggle phases that is 2.4 seconds per gaze.
export const BOSS_GAZE_CYCLES = 3;

// The dungeon's Unblinking Coil is a compact one-eyed, fanged blob ringed by sixteen
// jet-black tentacles: four growing out of each side. The tentacles fill the
// space the old full-frame body used to occupy, so the creature's overall size
// is unchanged while the body itself is less than half as wide.
//
// 24x24 art is still drawn at 2x into the physical 48x48 (3x3 tile) footprint.
// Each wiggle phase x gaze direction is its own 24x24 texture. The Boss plays
// them as one looping Phaser animation: tentacles undulate like travelling
// snake waves while the pupil periodically darts to a new direction.
export const BOSS_TEXTURE_SIZE = 24;
const BODY_SIZE = 12;
const BODY_OFFSET = (BOSS_TEXTURE_SIZE - BODY_SIZE) / 2;
const CENTRE = (BOSS_TEXTURE_SIZE - 1) / 2;

export const BOSS_PALETTE: Record<string, number> = {
  o: 0x120e18, g: 0x395c2c, G: 0x547d3b, d: 0x263e1e,
  w: 0xf5cc22, p: 0x08060c, W: 0xffffff,
  m: 0x6e1a26, t: 0xf6f2ce,
  k: 0x000000 // tentacles are pure black
};

// The reduced body: a 12x12 face with one huge yellow eye, a narrow vertical
// slit for a pupil, and a fanged maw. It is stamped into the middle of each
// frame, leaving five pixels on every side for the tentacles to reach the edge
// of the footprint. This template shows the centre gaze; other frames slide
// the pupil around inside the eye.
export const BOSS_BODY_PIXELS = [
  "...oooooo...",
  ".ooggggggoo.",
  "oggggggggggo",
  "oggwwwwwWggo",
  "oggwwpwwwggo",
  "oggwwpwwwggo",
  "oggwwpwwwggo",
  "oggwwwwwwggo",
  "ogmmmmmmmmgo",
  "ogmtmtmtmtgo",
  ".ooddddddoo.",
  "...oooooo..."
];

// Pixel offsets applied to the template's pupil for each gaze direction.
const GAZE_OFFSETS: Point[] = [
  { x: 0, y: 0 }, // centre
  { x: -1, y: 0 }, // left
  { x: 1, y: 0 }, // right
  { x: 0, y: -1 }, // up
  { x: 0, y: 1 } // down
];
const PUPIL_CELLS: Point[] = BOSS_BODY_PIXELS.flatMap((row, y) =>
  [...row].flatMap((pixel, x) => pixel === 'p' ? [{ x, y }] : []));

type Grid = string[][];
type Point = { x: number; y: number };
type Side = { dx: number; dy: number; lx: number; ly: number };

const SIDES: Side[] = [
  { dx: 0, dy: -1, lx: 1, ly: 0 }, // top
  { dx: 0, dy: 1, lx: 1, ly: 0 }, // bottom
  { dx: -1, dy: 0, lx: 0, ly: 1 }, // left
  { dx: 1, dy: 0, lx: 0, ly: 1 } // right
];
const LATERALS = [-4.5, -1.5, 1.5, 4.5];

function emptyGrid(): Grid {
  return Array.from({ length: BOSS_TEXTURE_SIZE }, () =>
    Array.from({ length: BOSS_TEXTURE_SIZE }, () => '.'));
}

function setPixel(grid: Grid, x: number, y: number, pixel: string): void {
  if (x < 0 || y < 0 || x >= BOSS_TEXTURE_SIZE || y >= BOSS_TEXTURE_SIZE) return;
  grid[y][x] = pixel;
}

function bodyHas(x: number, y: number): boolean {
  const bx = x - BODY_OFFSET;
  const by = y - BODY_OFFSET;
  if (bx < 0 || by < 0 || bx >= BODY_SIZE || by >= BODY_SIZE) return false;
  return BOSS_BODY_PIXELS[by][bx] !== '.';
}

// Walk out from the centre along a side until the body ends. The last body
// pixel is where that tentacle is rooted, so the limbs grow from the actual
// silhouette instead of an assumed square.
function tentacleRoot(side: Side, lateral: number): Point {
  let x = Math.round(CENTRE + (side.dy !== 0 ? lateral : 0));
  let y = Math.round(CENTRE + (side.dx !== 0 ? lateral : 0));
  let last = { x, y };
  for (let step = 0; step < BOSS_TEXTURE_SIZE; step++) {
    const nx = x + side.dx;
    const ny = y + side.dy;
    if (!bodyHas(nx, ny)) break;
    last = { x: nx, y: ny };
    x = nx;
    y = ny;
  }
  return last;
}

// Every tentacle reaches its edge of the frame, so the total silhouette still
// fills the footprint even though the body is only 12x12.
function tentacleLength(side: Side, root: Point): number {
  if (side.dx < 0) return root.x + 1;
  if (side.dx > 0) return BOSS_TEXTURE_SIZE - root.x;
  if (side.dy < 0) return root.y + 1;
  return BOSS_TEXTURE_SIZE - root.y;
}

function drawTentacles(grid: Grid, phase: number): void {
  const phaseAngle = phase * (Math.PI * 2 / BOSS_WIGGLE_FRAMES);
  SIDES.forEach((side, sideIndex) => {
    LATERALS.forEach((lateral, index) => {
      const root = tentacleRoot(side, lateral);
      const spread = lateral / 4.5;
      const length = tentacleLength(side, root);
      for (let s = 0; s < length; s++) {
        const t = length === 1 ? 1 : s / (length - 1);
        // A sine wave travelling outward from the body, with a slight fan so
        // neighbouring tentacles never merge. Each phase advances the wave.
        const wave = Math.sin(s * 1.2 - phaseAngle + sideIndex * 0.5 + index * 0.8);
        const sway = wave * 0.9 + spread * 1.2 * t;
        const px = Math.round(root.x + side.dx * (s + 1) + side.lx * sway);
        const py = Math.round(root.y + side.dy * (s + 1) + side.ly * sway);
        setPixel(grid, px, py, 'k');
        // Thicker at the root, a single black pixel at the tip: a snake body.
        if (s < 2) setPixel(grid, px + side.lx, py + side.ly, 'k');
      }
    });
  });
}

/** Build one 24x24 frame of the boss animation. Phase/gaze 0 is the base art. */
export function buildBossFrame(phase: number, gaze = 0): string[] {
  const grid = emptyGrid();
  drawTentacles(grid, phase);
  const offset = GAZE_OFFSETS[gaze] ?? GAZE_OFFSETS[0];
  BOSS_BODY_PIXELS.forEach((row, by) => [...row].forEach((pixel, bx) => {
    if (pixel === '.') return;
    // The template's pupil is repainted as yellow sclera and redrawn at the
    // gaze offset, so the slit slides across the eye without moving the body.
    if (pixel === 'p') {
      setPixel(grid, BODY_OFFSET + bx, BODY_OFFSET + by, 'w');
      return;
    }
    setPixel(grid, BODY_OFFSET + bx, BODY_OFFSET + by, pixel);
  }));
  for (const cell of PUPIL_CELLS) {
    setPixel(grid, BODY_OFFSET + cell.x + offset.x, BODY_OFFSET + cell.y + offset.y, 'p');
  }
  return grid.map(row => row.join(''));
}

export const BOSS_PIXELS: string[] = buildBossFrame(0, 0);

export function bossFrameKey(phase: number, gaze = 0): string {
  if (phase === 0 && gaze === 0) return BOSS_TEXTURE;
  return `${BOSS_TEXTURE}-${gaze}-${phase}`;
}

export function generateBossTexture(scene: Phaser.Scene): void {
  if (!scene.textures.exists(BOSS_TEXTURE)) {
    for (let gaze = 0; gaze < BOSS_GAZE_COUNT; gaze++) {
      for (let phase = 0; phase < BOSS_WIGGLE_FRAMES; phase++) {
        const g = scene.make.graphics(undefined, false);
        buildBossFrame(phase, gaze).forEach((row, y) => [...row].forEach((pixel, x) => {
          const color = BOSS_PALETTE[pixel];
          if (color === undefined) return;
          g.fillStyle(color, 1);
          g.fillRect(x, y, 1, 1);
        }));
        g.generateTexture(bossFrameKey(phase, gaze), BOSS_TEXTURE_SIZE, BOSS_TEXTURE_SIZE);
        g.destroy();
      }
    }
  }

  // Scene animation managers are shared game-wide, so create the loop once.
  // A plain `scene.anims` guard also keeps node test fixtures (no anims) happy.
  if (scene.anims && !scene.anims.exists(BOSS_WIGGLE_ANIM)) {
    // Several tentacle waves play for each gaze, so the eye only darts every
    // few seconds while the tentacles keep wiggling at the original speed.
    const frames = [];
    for (let gaze = 0; gaze < BOSS_GAZE_COUNT; gaze++) {
      for (let cycle = 0; cycle < BOSS_GAZE_CYCLES; cycle++) {
        for (let phase = 0; phase < BOSS_WIGGLE_FRAMES; phase++) {
          frames.push({ key: bossFrameKey(phase, gaze) });
        }
      }
    }
    scene.anims.create({
      key: BOSS_WIGGLE_ANIM,
      frames,
      frameRate: 10,
      repeat: -1
    });
  }
}
