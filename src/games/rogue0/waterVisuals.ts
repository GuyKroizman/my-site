import type Phaser from 'phaser';

export const WATER_TEXTURE = 'water-surface';
export const WATER_FRAMES = 8;
const SIZE = 16;
// Clockwise shoreline bits: north, east, south, west.
export function waterShoreMask(x: number, y: number, isWater: (x: number, y: number) => boolean): number {
  return (isWater(x, y - 1) ? 0 : 1) | (isWater(x + 1, y) ? 0 : 2) |
    (isWater(x, y + 1) ? 0 : 4) | (isWater(x - 1, y) ? 0 : 8);
}

export function waterFrame(mask: number, x: number, y: number, time: number): number {
  // Slow stepped animation with coordinate-based phase, not gameplay RNG.
  const phase = ((x * 3 + y * 5) % WATER_FRAMES + WATER_FRAMES) % WATER_FRAMES;
  return mask * WATER_FRAMES + (Math.floor(Math.max(0, time) / 180) + phase) % WATER_FRAMES;
}

const PALETTE = [0x12303c, 0x174453, 0x1b5260, 0x246573, 0x327b85, 0x559c9f, 0x80b9b0];

/** Pure pixel data also used by visual regression tests. */
export function waterPixels(mask: number, frame: number): number[] {
  const pixels: number[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // Quiet, mottled depth beneath narrow moving caustic bands.
      const grain = (x * 17 + y * 23 + x * y * 3) % 19;
      let shade = grain < 3 ? 1 : grain < 10 ? 2 : 3;
      const wave = (y + Math.floor(Math.sin((x + frame) * Math.PI / 8) * 1.4) + frame) & 7;
      if (wave === 0 && (x + frame * 2) % 11 < 6) shade = 4;
      if (wave === 0 && (x + frame * 2) % 11 < 3) shade = 5;
      // Dark wet rim and a softly lit shallow shelf only at actual pool edges.
      const distance = Math.min(mask & 1 ? y : 99, mask & 2 ? 15 - x : 99,
        mask & 4 ? 15 - y : 99, mask & 8 ? x : 99);
      if (distance === 0) shade = grain < 8 ? 0 : 1;
      else if (distance === 1) shade = 2;
      else if (distance === 2 && (x + y + frame) % 9 < 3) shade = 4;
      // Cut back exposed corners so isolated puddles do not look like framed
      // floor tiles. Transparent pixels reveal the existing stone underneath.
      const corner = ((mask & 9) === 9 && x + y < 3) ||
        ((mask & 3) === 3 && 15 - x + y < 3) ||
        ((mask & 6) === 6 && 30 - x - y < 3) ||
        ((mask & 12) === 12 && x + 15 - y < 3);
      pixels.push(corner ? -1 : PALETTE[shade]);
    }
  }
  return pixels;
}

export function generateWaterTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(WATER_TEXTURE)) return;
  // One small atlas, shared by all pools; no per-tile tweens or particles.
  const texture = scene.textures.createCanvas(WATER_TEXTURE, SIZE * WATER_FRAMES, SIZE * 16);
  if (!texture) return;
  const context = texture.getContext();
  for (let mask = 0; mask < 16; mask++) {
    for (let frame = 0; frame < WATER_FRAMES; frame++) {
      const image = context.createImageData(SIZE, SIZE);
      waterPixels(mask, frame).forEach((color, i) => {
        image.data[i * 4] = color >> 16;
        image.data[i * 4 + 1] = (color >> 8) & 255;
        image.data[i * 4 + 2] = color & 255;
        image.data[i * 4 + 3] = color < 0 ? 0 : 255;
      });
      context.putImageData(image, frame * SIZE, mask * SIZE);
      texture.add(mask * WATER_FRAMES + frame, 0, frame * SIZE, mask * SIZE, SIZE, SIZE);
    }
  }
  texture.refresh();
}
