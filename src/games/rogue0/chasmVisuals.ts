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

// The floor far below is a separate masked layer so it can slide at a slower
// rate than the world (parallax). The texture is 128px and POT so WebGL can
// repeat it; the offset is kept positive to avoid negative UV wraps.
export const CHASM_DEEP_TEXTURE = 'chasm-deep';
export const CHASM_DEEP_SIZE = 128;
export const CHASM_PARALLAX = 0.35;
export const CHASM_DEEP_DEPTH = 0.02;
export const CHASM_SURFACE_DEPTH = 0.03;

/** Texture offset for a camera scroll position: the deep layer moves at
 * CHASM_PARALLAX of the world's speed, so the texture advances the rest. */
export function chasmParallaxOffset(scroll: number): number {
  return CHASM_DEEP_SIZE * 64 - scroll * (1 - CHASM_PARALLAX);
}

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

  // The cell centre stays transparent: the masked deep-floor layer shows
  // through it. Only the rim, walls and the shadow they cast are opaque.

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

  // The walls occlude the light reaching the floor below, so the deep layer
  // fades into black over the first few pixels inside the rim. The ramp is
  // capped by the distance to the cell edge so it never steps at a tile seam.
  const SHADOW_ALPHA = 0.62;
  const SHADOW_WIDTH = 10;
  const ramp = (distance: number, width: number) =>
    distance <= 0 ? 0 : Math.max(0, 1 - distance / Math.min(width, SHADOW_WIDTH)) * SHADOW_ALPHA;
  for (let y = C0; y <= C1; y++) {
    for (let x = C0; x <= C1; x++) {
      const i = y * S + x;
      if (pixels[i][3] !== 0) continue;
      let alpha = 0;
      if (north) {
        const faceBottom = C0 + FACE_ROWS.length - 1;
        alpha = Math.max(alpha, ramp(y - faceBottom, C1 - faceBottom));
      }
      if (south) alpha = Math.max(alpha, ramp((C1 - 1) - y, (C1 - 1) - C0));
      if (west) alpha = Math.max(alpha, ramp(x - (C0 + 2), C1 - (C0 + 2)));
      if (east) alpha = Math.max(alpha, ramp((C1 - 2) - x, (C1 - 2) - C0));
      if (alpha > 0) pixels[i] = [0, 0, 0, Math.round(alpha * 255)];
    }
  }

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

/** Tileable floor far below the pit: small worn flagstones, rubble and cracks
 * in a cold, very low-contrast palette. Dark enough that the pit still reads
 * as a void; the inner rim shadow hides the tile seams. */
export function chasmDeepPixels(): Rgba[] {
  const size = CHASM_DEEP_SIZE;
  const pixels: Rgba[] = Array.from({ length: size * size }, () => [0, 0, 0, 255] as Rgba);
  // Small slabs read as a floor further away than the 16px surface tiles.
  const slab = 8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // A plain grid reads as a floor of flagstones; the offset rows of a
      // brick bond read as a wall instead.
      const sx = x % slab;
      const sy = y % slab;
      const joint = sx === 0 || sy === 0;
      let v: number;
      if (joint) {
        v = 7 + ((x * 7 + y * 13) % 5 === 0 ? 1 : 0);
      } else {
        const grain = (x * 11 + y * 5) % 17;
        v = 10 + (grain < 3 ? 2 : grain < 9 ? 1 : 0);
      }
      // Sparse rubble and a hairline crack give the lower floor a readable
      // scale without becoming a bright pattern.
      if ((x * 5 + y * 3) % 97 === 0) v += 4;
      if ((x * 13 + y * 7) % 131 === 0) v += 6;
      if ((x * 3 + y * 5) % 53 < 3) v -= 2;
      pixels[y * size + x] = [v, v + 1, v + 3, 255];
    }
  }
  return pixels;
}

export function generateChasmDeepTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(CHASM_DEEP_TEXTURE)) return;
  const size = CHASM_DEEP_SIZE;
  const texture = scene.textures.createCanvas(CHASM_DEEP_TEXTURE, size, size);
  if (!texture) return;
  const context = texture.getContext();
  const image = context.createImageData(size, size);
  chasmDeepPixels().forEach((pixel, i) => {
    image.data[i * 4] = pixel[0];
    image.data[i * 4 + 1] = pixel[1];
    image.data[i * 4 + 2] = pixel[2];
    image.data[i * 4 + 3] = pixel[3];
  });
  context.putImageData(image, 0, 0);
  texture.refresh();
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
