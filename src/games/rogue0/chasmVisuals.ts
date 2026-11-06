import type Phaser from 'phaser';

// Chasm depth rendering. Like waterVisuals, every edge/corner case is baked
// into one generated atlas so the pit reads as a sunken hole instead of the
// flat placeholder tile. Frame size is larger than the cell because the rim
// shadow and the lit floor lip spill onto the neighbouring floor tiles.
//
// Cardinal edge bits: north, east, south, west (set = that neighbour is floor).
export const CHASM_TEXTURE = 'chasm-depth';
export const CHASM_CELL = 16;
export const CHASM_MARGIN = 4;
export const CHASM_SIZE = CHASM_CELL + CHASM_MARGIN * 2;
export const CHASM_FRAMES = 16;

/** Same convention as waterShoreMask: a set bit means the chasm ends there. */
export function chasmMask(x: number, y: number, isChasm: (x: number, y: number) => boolean): number {
  return (isChasm(x, y - 1) ? 0 : 1) | (isChasm(x + 1, y) ? 0 : 2) |
    (isChasm(x, y + 1) ? 0 : 4) | (isChasm(x - 1, y) ? 0 : 8);
}

export function chasmFrame(mask: number): number {
  return mask & 15;
}

type Rgba = [number, number, number, number];

const M = CHASM_MARGIN;
const S = CHASM_SIZE;
const C0 = M;
const C1 = M + CHASM_CELL - 1;

// The far (north) rim shows a rock face descending into the pit. The top row
// is the lit lip; each row below loses light until it reaches the void.
const FACE_ROWS: Array<[number, number, number]> = [
  [0x46, 0x49, 0x3d],
  [0x39, 0x3c, 0x32],
  [0x2e, 0x31, 0x29],
  [0x24, 0x27, 0x21],
  [0x1b, 0x1d, 0x19],
  [0x13, 0x15, 0x12],
  [0x0d, 0x0e, 0x0c],
  [0x08, 0x09, 0x08],
  [0x06, 0x06, 0x06]
];

// Shadow on the surrounding floor, sampled outward from the lip.
const AO_ALPHA = [0.48, 0.34, 0.20, 0.09];
const LIP: Rgba = [0x7a, 0x78, 0x62, 62];

function shade(rgb: [number, number, number], factor: number): [number, number, number] {
  return [
    Math.max(0, Math.min(255, Math.round(rgb[0] * factor))),
    Math.max(0, Math.min(255, Math.round(rgb[1] * factor))),
    Math.max(0, Math.min(255, Math.round(rgb[2] * factor)))
  ];
}

/** Pure pixel data, used by generateChasmTexture and the visual tests. */
export function chasmPixels(mask: number): Rgba[] {
  const pixels: Rgba[] = Array.from({ length: S * S }, () => [0, 0, 0, 0] as Rgba);
  const put = (x: number, y: number, color: [number, number, number], alpha = 255) => {
    pixels[y * S + x] = [color[0], color[1], color[2], alpha];
  };
  const north = (mask & 1) !== 0;
  const east = (mask & 2) !== 0;
  const south = (mask & 4) !== 0;
  const west = (mask & 8) !== 0;

  // Cell interior: one flat cold void with a whisper of grain. Per-mask
  // lightening made large pits read as blocky sub-tiles.
  for (let y = C0; y <= C1; y++) {
    for (let x = C0; x <= C1; x++) {
      const v = 6 + ((x * 13 + y * 7) % 11 < 2 ? 1 : 0);
      put(x, y, [v, v + 1, v + 3]);
    }
  }

  // Side walls: only the first few pixels of the east/west rim are visible.
  const sideWall = (fromX: number, toX: number, strength: number) => {
    for (let y = C0; y <= C1; y++) {
      const t = (y - C0) / (C1 - C0);
      const flute = y % 5 === 0 ? 0.86 : 1;
      for (let x = fromX; x <= toX; x++) {
        const col = (x - fromX) / Math.max(1, toX - fromX);
        const f = (0.92 - 0.82 * t) * strength * flute * (col === 0 ? 1 : 0.82);
        put(x, y, shade([0x41, 0x44, 0x3a], f));
      }
    }
  };
  if (west) sideWall(C0, C0 + 2, 1);
  if (east) sideWall(C1 - 2, C1, 0.9);

  // The near (south) rim: we look over this lip, so the wall below it is
  // hidden. Only a dark cut edge and a hairline of shade remain.
  if (south) {
    for (let x = C0; x <= C1; x++) {
      put(x, C1, [0x0b, 0x0c, 0x0b]);
      put(x, C1 - 1, [0x13, 0x15, 0x12]);
    }
  }

  // The far rim's face is drawn last so it covers the top of the side walls.
  if (north) {
    for (let i = 0; i < FACE_ROWS.length; i++) {
      const y = C0 + i;
      for (let x = C0; x <= C1; x++) {
        const flute = (x - C0) % 6 === 0 ? 0.86 : 1;
        const grain = (x * 7 + y * 13) % 17 === 0 ? 0.82 : 1;
        const lip = i === 0 && (x + 2) % 7 === 0 ? 0.86 : 1;
        put(x, y, shade(FACE_ROWS[i], flute * grain * lip));
      }
    }
  }

  // The rim shadow and lit floor lip live in the margin, over the neighbours.
  const paint = (x: number, y: number, alpha: number) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = y * S + x;
    if (pixels[i][3] === 0 || pixels[i][3] < alpha * 255) {
      pixels[i] = [0, 0, 0, Math.round(alpha * 255)];
    }
  };
  if (north) for (let y = 0; y < M; y++) for (let x = 0; x < S; x++) paint(x, y, AO_ALPHA[M - 1 - y]);
  if (south) for (let y = C1 + 1; y < S; y++) for (let x = 0; x < S; x++) paint(x, y, AO_ALPHA[y - C1 - 1]);
  if (west) for (let x = 0; x < M; x++) for (let y = 0; y < S; y++) paint(x, y, AO_ALPHA[M - 1 - x]);
  if (east) for (let x = C1 + 1; x < S; x++) for (let y = 0; y < S; y++) paint(x, y, AO_ALPHA[x - C1 - 1]);

  // The near lip catches the light on the floor side of the cut.
  const lip = (x: number, y: number) => {
    // The lip is the lit floor edge itself; the shadow starts one pixel
    // further out, so it replaces the first AO ring instead of hiding under it.
    const inside = x >= C0 && x <= C1 && y >= C0 && y <= C1;
    if (!inside) pixels[y * S + x] = [...LIP];
  };
  // Only the near rim is seen from above; the side walls catch no lip light.
  if (south) for (let x = C0; x <= C1; x++) lip(x, C1 + 1);

  return pixels;
}

export function generateChasmTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(CHASM_TEXTURE)) return;
  const cols = 4;
  const rows = Math.ceil(CHASM_FRAMES / cols);
  const texture = scene.textures.createCanvas(CHASM_TEXTURE, cols * S, rows * S);
  if (!texture) return;
  const context = texture.getContext();
  for (let mask = 0; mask < CHASM_FRAMES; mask++) {
    const image = context.createImageData(S, S);
    chasmPixels(mask).forEach((pixel, i) => {
      image.data[i * 4] = pixel[0];
      image.data[i * 4 + 1] = pixel[1];
      image.data[i * 4 + 2] = pixel[2];
      image.data[i * 4 + 3] = pixel[3];
    });
    const col = mask % cols;
    const row = Math.floor(mask / cols);
    context.putImageData(image, col * S, row * S);
    texture.add(mask, 0, col * S, row * S, S, S);
  }
  texture.refresh();
}
