// Sparse decoration for raised wall faces.
//
// Walls repeat one 16x16 face per theme, which reads as wallpaper over a long
// corridor. A small, deterministic sprinkling of cracks/vines/ore/bones breaks
// that up without turning the dungeon into a mural. These are pure visuals:
// nothing here touches the base map, pathfinding, FOV or saved state, and the
// selection never consumes gameplay randomness.

import type Phaser from 'phaser';

export type DecalKind = 'crack' | 'vine' | 'ore' | 'bones' | 'moss' | 'stain';

export const DECAL_TEXTURE = 'wall-decals';
export const DECAL_VARIANTS = 3;
const SIZE = 16;
/** Percent of corridor-facing walls that carry a decal. Sparse on purpose. */
export const DECAL_CHANCE = 20;
/** Wall tops and side faces are larger, flatter areas: decorate them less. */
export const FLAT_DECAL_CHANCE = 11;

type Palette = {
  crack: number;
  crackLight: number;
  vine: number;
  leaf: number;
  ore: number;
  oreLight: number;
  bone: number;
  boneDark: number;
  moss: number;
  mossLight: number;
  stain: number;
};

const PALETTES: Record<string, Palette> = {
  stone: {
    crack: 0x232a26, crackLight: 0x84927f,
    vine: 0x3a6132, leaf: 0x5d8f46,
    ore: 0x8f6034, oreLight: 0xd0a068,
    bone: 0xcbc4ac, boneDark: 0x8b8368,
    moss: 0x415f33, mossLight: 0x6a9150,
    stain: 0x1b211d
  },
  crypt: {
    crack: 0x101722, crackLight: 0x6a849d,
    vine: 0x2f4f45, leaf: 0x49735f,
    ore: 0x5f86a8, oreLight: 0x9fc2dd,
    bone: 0xc6d1da, boneDark: 0x828f9b,
    moss: 0x2f4b43, mossLight: 0x476c5c,
    stain: 0x0c131c
  },
  sandstone: {
    crack: 0x54401f, crackLight: 0xd6b183,
    vine: 0x6b6629, leaf: 0x92903a,
    ore: 0xb07d2a, oreLight: 0xeecb68,
    bone: 0xe3d8ba, boneDark: 0xa19374,
    moss: 0x7a763a, mossLight: 0xa8a453,
    stain: 0x3f2f1a
  },
  crystal: {
    crack: 0x261838, crackLight: 0xa78fd0,
    vine: 0x40527a, leaf: 0x7ea0d8,
    ore: 0x7052b8, oreLight: 0xcbb4ff,
    bone: 0xd5cfe6, boneDark: 0x938cab,
    moss: 0x463a6b, mossLight: 0x6d5c9c,
    stain: 0x170f22
  },
  volcanic: {
    crack: 0x161010, crackLight: 0xff8a3c,
    vine: 0x3a2a22, leaf: 0x5a4132,
    ore: 0xc9481a, oreLight: 0xffb45e,
    bone: 0x9a8c7c, boneDark: 0x61584f,
    moss: 0x2f2723, mossLight: 0x4a3d35,
    stain: 0x0b0808
  }
};

// Each theme gets only the motifs that fit its material.
const THEME_DECALS: Record<string, DecalKind[]> = {
  stone: ['crack', 'moss', 'bones'],
  crypt: ['crack', 'vine', 'bones', 'moss'],
  sandstone: ['crack', 'ore', 'bones', 'stain'],
  crystal: ['crack', 'ore', 'vine'],
  volcanic: ['crack', 'ore', 'bones', 'stain']
};

export type DecalFrame = { theme: string; kind: DecalKind; variant: number; frame: number };

export const DECAL_FRAMES: DecalFrame[] = [];
for (const [theme, kinds] of Object.entries(THEME_DECALS)) {
  for (const kind of kinds) {
    for (let variant = 0; variant < DECAL_VARIANTS; variant++) {
      DECAL_FRAMES.push({ theme, kind, variant, frame: DECAL_FRAMES.length });
    }
  }
}
const FRAME_INDEX = new Map(DECAL_FRAMES.map((f) => [`${f.theme}/${f.kind}/${f.variant}`, f.frame]));

function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Deterministic coordinate hash; stable across runs, themes and reloads. */
function hashCell(x: number, y: number, salt: number): number {
  let hash = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ salt) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 0x2545f491) >>> 0;
  return (hash ^ (hash >>> 13)) >>> 0;
}

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pickFrame(theme: string, x: number, y: number, chance: number, salt: number): number | undefined {
  const key = THEME_DECALS[theme] ? theme : 'stone';
  const kinds = THEME_DECALS[key];
  const hash = hashCell(x, y, hashText(key) ^ salt);
  if (hash % 100 >= chance) return undefined;
  const kind = kinds[(hash >>> 7) % kinds.length];
  const variant = (hash >>> 19) % DECAL_VARIANTS;
  return FRAME_INDEX.get(`${key}/${kind}/${variant}`);
}

/** Frame index for a corridor-facing raised wall face, or undefined for plain. */
export function decalFrameFor(theme: string, x: number, y: number): number | undefined {
  return pickFrame(theme, x, y, DECAL_CHANCE, 0x5bd1e995);
}

/** Frame index for a flat wall top/side, salted so it never mirrors the face. */
export function flatDecalFrameFor(theme: string, x: number, y: number): number | undefined {
  return pickFrame(theme, x, y, FLAT_DECAL_CHANCE, 0x27d4eb2f);
}

function emptyPixels(): number[] {
  return new Array<number>(SIZE * SIZE).fill(-1);
}

function put(pixels: number[], x: number, y: number, color: number): void {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  pixels[y * SIZE + x] = color;
}

function crack(pixels: number[], ink: Palette, rand: () => number): void {
  let x = 3 + Math.floor(rand() * 10);
  let y = Math.floor(rand() * 2);
  const end = Math.min(SIZE - 1, y + 9 + Math.floor(rand() * 6));
  while (y < end) {
    put(pixels, x, y, ink.crack);
    // One-pixel bevel highlight keeps the fracture readable on dark stone.
    if (rand() < 0.55) put(pixels, x + 1, y, ink.crackLight);
    if (rand() < 0.45) x += rand() < 0.5 ? -1 : 1;
    if (rand() < 0.2) {
      let bx = x + (rand() < 0.5 ? -1 : 1);
      const by = y;
      for (let i = 0; i < 2 + Math.floor(rand() * 3); i++) {
        put(pixels, bx, by + i, ink.crack);
        bx += bx < x ? -1 : 1;
      }
    }
    y++;
  }
}

function vine(pixels: number[], ink: Palette, rand: () => number): void {
  let x = 4 + Math.floor(rand() * 8);
  const length = 9 + Math.floor(rand() * 7);
  for (let i = 0; i < length; i++) {
    put(pixels, x, i, ink.vine);
    if (rand() < 0.3) x += rand() < 0.5 ? -1 : 1;
    x = Math.max(1, Math.min(SIZE - 2, x));
    if (i > 1 && rand() < 0.5) {
      const side = rand() < 0.5 ? -1 : 1;
      put(pixels, x + side, i, ink.leaf);
      put(pixels, x + side * 2, i + (rand() < 0.4 ? 1 : 0), ink.leaf);
    }
  }
}

function ore(pixels: number[], ink: Palette, rand: () => number): void {
  const clusters = 2 + Math.floor(rand() * 3);
  for (let c = 0; c < clusters; c++) {
    const cx = 3 + Math.floor(rand() * 11);
    const cy = 3 + Math.floor(rand() * 11);
    // Tiny faceted nugget: bright cap over a shadowed base.
    put(pixels, cx, cy, ink.ore);
    put(pixels, cx + 1, cy, ink.ore);
    put(pixels, cx, cy + 1, ink.ore);
    put(pixels, cx - 1, cy + 1, ink.ore);
    put(pixels, cx, cy - 1, ink.oreLight);
    put(pixels, cx - 1, cy, ink.oreLight);
    put(pixels, cx + 1, cy + 1, ink.stain);
  }
  // A few loose flecks make the cluster feel embedded in the stone.
  for (let i = 0; i < 3; i++) {
    put(pixels, 2 + Math.floor(rand() * 12), 2 + Math.floor(rand() * 12), ink.ore);
  }
}

function spine(pixels: number[], ink: Palette, rand: () => number): void {
  // A short fish-skeleton spine with ribs reads as bones at 16px.
  const x0 = 2 + Math.floor(rand() * 4);
  const length = 7 + Math.floor(rand() * 4);
  const y0 = 4 + Math.floor(rand() * 8);
  for (let i = 0; i < length; i++) put(pixels, x0 + i, y0, ink.bone);
  for (let i = 1; i < length - 1; i += 2) {
    const rib = 2 + (rand() < 0.35 ? 1 : 0);
    for (let k = 1; k <= rib; k++) {
      put(pixels, x0 + i + (k > 1 ? 1 : 0), y0 - k, ink.bone);
      put(pixels, x0 + i + (k > 1 ? 1 : 0), y0 + k, ink.boneDark);
    }
  }
  put(pixels, x0 - 1, y0, ink.bone);
  put(pixels, x0 - 1, y0 - 1, ink.bone);
}

function ribcage(pixels: number[], ink: Palette, rand: () => number): void {
  // Upright spine with ribs curving away, like a corpse left against the wall.
  const x = 5 + Math.floor(rand() * 6);
  const y = 3 + Math.floor(rand() * 5);
  for (let i = 0; i < 7; i++) put(pixels, x, y + i, ink.bone);
  for (let r = 0; r < 3; r++) {
    for (let i = 1; i <= 3; i++) {
      const reach = i > 2 ? 1 : 0;
      put(pixels, x - i, y + r * 2 + reach, ink.bone);
      put(pixels, x + i, y + r * 2 + reach, ink.boneDark);
    }
  }
}

function scatteredBones(pixels: number[], ink: Palette, rand: () => number): void {
  // A skull and two snapped fragments: the find looks dropped, not displayed.
  const sx = 4 + Math.floor(rand() * 7);
  const sy = 4 + Math.floor(rand() * 7);
  put(pixels, sx, sy, ink.bone);
  put(pixels, sx + 1, sy, ink.bone);
  put(pixels, sx + 2, sy, ink.bone);
  put(pixels, sx - 1, sy + 1, ink.bone);
  put(pixels, sx + 1, sy + 1, ink.boneDark);
  put(pixels, sx + 3, sy + 1, ink.bone);
  put(pixels, sx, sy + 2, ink.bone);
  put(pixels, sx + 2, sy + 2, ink.bone);
  for (let f = 0; f < 3; f++) {
    const fx = 3 + Math.floor(rand() * 9);
    const fy = 4 + Math.floor(rand() * 8);
    const dx = rand() < 0.5 ? -1 : 1;
    const dy = rand() < 0.5 ? -1 : 1;
    for (let i = 0; i < 4; i++) put(pixels, fx + i * dx, fy + i * dy, ink.bone);
    put(pixels, fx + dx, fy + dy, ink.boneDark);
  }
}

function bones(pixels: number[], ink: Palette, rand: () => number, variant: number): void {
  if (variant === 1) ribcage(pixels, ink, rand);
  else if (variant === 2) scatteredBones(pixels, ink, rand);
  else spine(pixels, ink, rand);
}

function moss(pixels: number[], ink: Palette, rand: () => number): void {
  const fromTop = rand() < 0.6;
  const cx = 4 + Math.floor(rand() * 8);
  const width = 5 + Math.floor(rand() * 6);
  const height = 3 + Math.floor(rand() * 3);
  for (let dx = -Math.floor(width / 2); dx <= Math.floor(width / 2); dx++) {
    for (let dy = 0; dy < height; dy++) {
      const taper = Math.abs(dx) > width / 2 - 1 ? 1 : 0;
      if (rand() < 0.78 - 0.18 * taper) {
        const y = fromTop ? dy : SIZE - 1 - dy;
        put(pixels, cx + dx, y, rand() < 0.3 ? ink.mossLight : ink.moss);
      }
    }
  }
  // A second, smaller clump keeps the patch from looking stamped.
  const ox = 3 + Math.floor(rand() * 9);
  const oy = 3 + Math.floor(rand() * 9);
  for (let i = 0; i < 4; i++) {
    put(pixels, ox + (i % 2), oy + Math.floor(i / 2), rand() < 0.35 ? ink.mossLight : ink.moss);
  }
  for (let i = 0; i < 3; i++) {
    put(pixels, cx - 3 + Math.floor(rand() * 7), fromTop ? 2 + Math.floor(rand() * 2) : SIZE - 3 - Math.floor(rand() * 2), ink.moss);
  }
}

function stain(pixels: number[], ink: Palette, rand: () => number): void {
  const cx = 4 + Math.floor(rand() * 8);
  const spread = 2 + Math.floor(rand() * 3);
  for (let dy = 0; dy < 2 + Math.floor(rand() * 3); dy++) {
    for (let dx = -spread; dx <= spread; dx++) {
      if (rand() < 0.55) put(pixels, cx + dx, dy, ink.stain);
    }
  }
  const drips = 2 + Math.floor(rand() * 2);
  for (let d = 0; d < drips; d++) {
    const dx = cx - spread + Math.floor(rand() * (spread * 2 + 1));
    const length = 3 + Math.floor(rand() * 8);
    for (let i = 2; i < 2 + length; i++) put(pixels, dx, i, ink.stain);
  }
}

/** Pure pixels (0xRRGGBB, or -1 for transparent) for one decal frame. */
export function decalPixels(theme: string, kind: DecalKind, variant: number): number[] {
  const ink = PALETTES[theme] ?? PALETTES.stone;
  const pixels = emptyPixels();
  const rand = seeded(hashText(`${theme}:${kind}:${variant}`) ^ 0x9e3779b9);
  switch (kind) {
    case 'crack': crack(pixels, ink, rand); break;
    case 'vine': vine(pixels, ink, rand); break;
    case 'ore': ore(pixels, ink, rand); break;
    case 'bones': bones(pixels, ink, rand, variant); break;
    case 'moss': moss(pixels, ink, rand); break;
    case 'stain': stain(pixels, ink, rand); break;
  }
  return pixels;
}

export function generateWallDecalTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(DECAL_TEXTURE)) return;
  const columns = 8;
  const rows = Math.ceil(DECAL_FRAMES.length / columns);
  const texture = scene.textures.createCanvas(DECAL_TEXTURE, columns * SIZE, rows * SIZE);
  if (!texture) return;
  const context = texture.getContext();
  for (const entry of DECAL_FRAMES) {
    const image = context.createImageData(SIZE, SIZE);
    decalPixels(entry.theme, entry.kind, entry.variant).forEach((color, i) => {
      image.data[i * 4] = color < 0 ? 0 : color >> 16;
      image.data[i * 4 + 1] = color < 0 ? 0 : (color >> 8) & 255;
      image.data[i * 4 + 2] = color < 0 ? 0 : color & 255;
      image.data[i * 4 + 3] = color < 0 ? 0 : 255;
    });
    const x = (entry.frame % columns) * SIZE;
    const y = Math.floor(entry.frame / columns) * SIZE;
    context.putImageData(image, x, y);
    texture.add(entry.frame, 0, x, y, SIZE, SIZE);
  }
  texture.refresh();
}
