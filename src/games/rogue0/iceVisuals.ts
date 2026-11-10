import type Phaser from 'phaser';

export const ICE_TEXTURE = 'ice-surface';
export const ICE_VARIANTS = 8;
const SIZE = 16;

/** Clockwise exposed edges: north, east, south, west. Water is not ice. */
export function iceShoreMask(x: number, y: number, isIce: (x: number, y: number) => boolean): number {
  return (isIce(x, y - 1) ? 0 : 1) | (isIce(x + 1, y) ? 0 : 2) |
    (isIce(x, y + 1) ? 0 : 4) | (isIce(x - 1, y) ? 0 : 8);
}

export function iceFrame(mask: number, x: number, y: number): number {
  // Stable even at negative coordinates; no gameplay RNG or animation of cracks.
  let hash = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  const variant = (hash ^ (hash >>> 16)) >>> 0;
  return (mask & 15) * ICE_VARIANTS + variant % ICE_VARIANTS;
}

/** Opaque blue glass with submerged facets, fine fractures and a frosted lip. */
export function icePixels(mask: number, variant: number): number[] {
  const pixels: number[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // Broad diagonal planes, rather than water's noisy moving ripple bands.
      const plane = (x + y * 2 + variant * 5) % 29;
      let color = plane < 5 ? 0x6a9eaf : plane < 14 ? 0x6094a8 : 0x578b9f;
      if ((x * 13 + y * 7 + variant * 11) % 53 === 0) color = 0x80b2bf;
      const distance = Math.min(mask & 1 ? y : 99, mask & 2 ? 15 - x : 99,
        mask & 4 ? 15 - y : 99, mask & 8 ? x : 99);
      if (distance === 0) {
        // Top/left catches light; bottom/right shows the darker thickness.
        color = ((mask & 1) && y === 0) || ((mask & 8) && x === 0) ? 0xb5dce0 : 0x365e79;
      } else if (distance === 1) color = 0x91bfcb;
      else if (distance === 2 && (x + y * 3) % 5 < 2) color = 0x80b2bf;
      const corner = ((mask & 9) === 9 && x + y < 3) ||
        ((mask & 3) === 3 && 15 - x + y < 3) ||
        ((mask & 6) === 6 && 30 - x - y < 3) ||
        ((mask & 12) === 12 && x + 15 - y < 3);
      pixels.push(corner ? -1 : color);
    }
  }
  // Short, branching hairline fractures stop inside the tile, never making
  // disconnected lines at tile seams. A pale lower lip suggests depth.
  const mirror = (variant & 1) !== 0;
  const put = (x: number, y: number, color: number) => {
    if (mirror) x = 15 - x;
    if (x >= 3 && x <= 12 && y >= 3 && y <= 12) pixels[y * SIZE + x] = color;
  };
  // Some panes are unbroken. Different fracture silhouettes keep a large
  // frozen pool from reading as a repeated stamped icon.
  const cracks = [
    [[3, 5], [6, 7], [8, 11]],
    [[4, 10], [7, 8], [10, 8], [12, 5]],
    [],
    [[5, 3], [6, 6], [4, 9]],
    [[3, 8], [7, 6], [11, 7]],
    [],
    [[8, 4], [7, 7], [10, 10]],
    [[4, 11], [6, 8], [9, 6], [12, 6]],
  ][variant % ICE_VARIANTS];
  for (let segment = 1; segment < cracks.length; segment++) {
    const [ax, ay] = cracks[segment - 1];
    const [bx, by] = cracks[segment];
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(ax + (bx - ax) * i / steps);
      const y = Math.round(ay + (by - ay) * i / steps);
      put(x, y + 1, 0x83b2c2);
      put(x, y, 0x477e96);
    }
  }
  // A restrained, fixed specular streak; ice stays still when water freezes.
  const glintX = 4 + (variant * 3) % 6;
  const glintY = 4 + (variant * 5) % 8;
  for (let i = 0; i < 3; i++) put(glintX + i, glintY - Math.floor(i / 2), 0xb5dce0);
  return pixels;
}

export function generateIceTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(ICE_TEXTURE)) return;
  const texture = scene.textures.createCanvas(ICE_TEXTURE, SIZE * ICE_VARIANTS, SIZE * 16);
  if (!texture) return;
  const context = texture.getContext();
  for (let mask = 0; mask < 16; mask++) {
    for (let variant = 0; variant < ICE_VARIANTS; variant++) {
      const image = context.createImageData(SIZE, SIZE);
      icePixels(mask, variant).forEach((color, i) => {
        image.data[i * 4] = color >> 16;
        image.data[i * 4 + 1] = (color >> 8) & 255;
        image.data[i * 4 + 2] = color & 255;
        image.data[i * 4 + 3] = color < 0 ? 0 : 255;
      });
      context.putImageData(image, variant * SIZE, mask * SIZE);
      texture.add(mask * ICE_VARIANTS + variant, 0, variant * SIZE, mask * SIZE, SIZE, SIZE);
    }
  }
  texture.refresh();
}
