import type Phaser from 'phaser';
import type { TrapKind } from './tiles';

// Trap floor plates.
//
// Every trap draws the *same* pressure plate: a dark, bevelled square set into
// the floor with four corner rivets and a recessed face. Only the inlaid glyph
// and its accent colour change per kind, so once a player has learned what one
// trap looks like they recognise the family instantly while still being able
// to tell the kinds apart.
//
// Triggered (spent) traps keep the identical plate and glyph silhouette but
// lose their colour and take a crack across the face, so "already fired" reads
// without adding a second visual language.
//
// Pure visuals: nothing here touches gameplay state, saved data or Math.random.

export const TRAP_TEXTURE = 'trap-plates';
/**
 * Traps are inlaid into the floor, not props standing on it, so they are drawn
 * at 80% transparency: the stone underneath reads clearly through the plate,
 * and the hazard never competes with actors and items sharing the tile.
 * The plate palette is dark by design, so a gentler alpha (0.5) still read as
 * a solid slab over the equally dark stone floor.
 */
export const TRAP_ALPHA = 0.2;
const SIZE = 16;
/** Glyphs are drawn inside the plate face, one pixel clear of the rivets. */
const GLYPH_ORIGIN = 3;
const GLYPH_SIZE = 10;

export const TRAP_KINDS: TrapKind[] = [
  'dart', 'arrow', 'fire', 'frost', 'teleport', 'summon', 'alarm', 'geyser', 'confusion'
];

export type TrapAccent = { ink: number; light: number; dark: number };

/** One hue per kind, spread around the wheel so no two traps look alike. */
export const TRAP_ACCENTS: Record<TrapKind, TrapAccent> = {
  dart: { ink: 0x74c84a, light: 0xb8ee92, dark: 0x3d7522 },
  arrow: { ink: 0xe8b34d, light: 0xffdd93, dark: 0x93612a },
  fire: { ink: 0xef5a2a, light: 0xffb066, dark: 0x8f1f0a },
  frost: { ink: 0x7fd6f2, light: 0xd8f6ff, dark: 0x2f7f9c },
  teleport: { ink: 0xa87bf0, light: 0xd9b8ff, dark: 0x5b3293 },
  summon: { ink: 0xe3dcc4, light: 0xfff9e8, dark: 0x8f866c },
  alarm: { ink: 0xffe14d, light: 0xfff3a8, dark: 0xa8830c },
  geyser: { ink: 0x4aa8f0, light: 0xa9dcff, dark: 0x1f5f9c },
  confusion: { ink: 0xf063a6, light: 0xffb2d5, dark: 0x9a2f62 }
};

// 10x10 glyphs. '#' = accent ink, '+' = accent highlight, '-' = accent shadow,
// '.' = bare plate face. Shapes are deliberately bold silhouettes: they have to
// survive being viewed at 1x on a phone without any extra outlining.
export const TRAP_GLYPHS: Record<TrapKind, string[]> = {
  // Poison droplet: the darts are envenomed, so the plate warns in green.
  dart: [
    '....##....',
    '....##....',
    '...####...',
    '...####...',
    '..######..',
    '..#+#..#..',
    '..######..',
    '..######..',
    '...####...',
    '....##....'
  ],
  // Fletched arrow pointing up.
  arrow: [
    '....##....',
    '...####...',
    '..######..',
    '.########.',
    '...####...',
    '....##....',
    '....##....',
    '....##....',
    '...####...',
    '..##..##..'
  ],
  // Flame with a lit core.
  fire: [
    '....#.....',
    '...##.....',
    '...###....',
    '..####....',
    '..#####...',
    '.###+###..',
    '.###++##..',
    '.##++++#..',
    '..######..',
    '...####...'
  ],
  // Six-armed snowflake.
  frost: [
    '....##....',
    '....##....',
    '.#..##..#.',
    '..#.##.#..',
    '...####...',
    '##########',
    '...####...',
    '..#.##.#..',
    '.#..##..#.',
    '....##....'
  ],
  // Ringed portal with a bright travel axis.
  teleport: [
    '...####...',
    '..#....#..',
    '.#..##..#.',
    '.#..##..#.',
    '#...##...#',
    '#...##...#',
    '.#..##..#.',
    '.#..##..#.',
    '..#....#..',
    '...####...'
  ],
  // Skull: the summoning trap's client.
  summon: [
    '..######..',
    '.########.',
    '##########',
    '#..####..#',
    '#..####..#',
    '##########',
    '..######..',
    '..#.##.#..',
    '..######..',
    '...#..#...'
  ],
  // Bell with a clapper below.
  alarm: [
    '....##....',
    '...####...',
    '..######..',
    '..######..',
    '..######..',
    '.########.',
    '##########',
    '.#......#.',
    '....##....',
    '....##....'
  ],
  // Spout rising out of a spreading pool.
  geyser: [
    '.#..##..#.',
    '..#.##.#..',
    '...####...',
    '..######..',
    '...####...',
    '..######..',
    '...####...',
    '..######..',
    '.########.',
    '##########'
  ],
  // Dizzying spiral: movement becomes random.
  confusion: [
    '..#####...',
    '.#.....#..',
    '#..###..#.',
    '#.#...#.#.',
    '#.#.#.#.#.',
    '#.#.#...#.',
    '#.#.####.#',
    '#.......#.',
    '.#.....#..',
    '..#####...'
  ]
};

type PlateInk = {
  rim: number;
  edgeLight: number;
  edgeDark: number;
  face: number;
  faceShadow: number;
  rivet: number;
};

const ARMED: PlateInk = {
  rim: 0x120f18,
  edgeLight: 0xa9a2b8,
  edgeDark: 0x2a2435,
  face: 0x3a3446,
  faceShadow: 0x312b3d,
  rivet: 0xcfc8dd
};

const SPENT: PlateInk = {
  rim: 0x0f0d13,
  edgeLight: 0x6b6577,
  edgeDark: 0x221e29,
  face: 0x2f2a37,
  faceShadow: 0x282331,
  rivet: 0x8d8698
};

/** A spent plate keeps the glyph readable but drains its colour. */
const SPENT_ACCENT: TrapAccent = { ink: 0x7d7688, light: 0x9d96a8, dark: 0x565060 };

/** Fixed fracture, drawn in plate-rim ink over the glyph. */
const CRACK: Array<[number, number]> = [
  [3, 12], [4, 11], [4, 10], [5, 9], [6, 9], [6, 8], [7, 7], [8, 6], [9, 6], [10, 5], [11, 4], [12, 3]
];

function put(pixels: number[], x: number, y: number, color: number): void {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  pixels[y * SIZE + x] = color;
}

/** Shared plate body: every trap kind draws exactly these pixels. */
function plate(pixels: number[], ink: PlateInk): void {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // Rounded corners let the floor show through, so the plate reads as a
      // raised slab instead of another square grid cell.
      const corner = (x === 0 || x === SIZE - 1) && (y === 0 || y === SIZE - 1);
      if (corner) continue;
      const edge = x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1;
      if (edge) {
        put(pixels, x, y, ink.rim);
        continue;
      }
      const bevel = x === 1 || y === 1;
      const shade = x === SIZE - 2 || y === SIZE - 2;
      if (bevel) put(pixels, x, y, ink.edgeLight);
      else if (shade) put(pixels, x, y, ink.edgeDark);
      else if (x === SIZE - 3 || y === SIZE - 3) put(pixels, x, y, ink.faceShadow);
      else put(pixels, x, y, ink.face);
    }
  }
  // Four rivets pin the plate down; light pixel with a shadowed neighbour
  // inside the face (never on the bevel, which has its own shading).
  for (const [rx, ry] of [[2, 2], [SIZE - 3, 2], [2, SIZE - 3], [SIZE - 3, SIZE - 3]]) {
    put(pixels, rx, ry, ink.rivet);
    if (rx + 1 <= SIZE - 4 && ry + 1 <= SIZE - 4) put(pixels, rx + 1, ry + 1, ink.faceShadow);
  }
}

/** Pure pixels (0xRRGGBB, or -1 for transparent) for one trap plate frame. */
export function trapPixels(kind: TrapKind, spent = false): number[] {
  const pixels = new Array<number>(SIZE * SIZE).fill(-1);
  plate(pixels, spent ? SPENT : ARMED);
  const glyph = TRAP_GLYPHS[kind] ?? TRAP_GLYPHS.dart;
  const accent = spent ? SPENT_ACCENT : TRAP_ACCENTS[kind] ?? TRAP_ACCENTS.dart;
  for (let row = 0; row < GLYPH_SIZE; row++) {
    const line = glyph[row] ?? '';
    for (let col = 0; col < GLYPH_SIZE; col++) {
      const symbol = line[col];
      if (symbol === '#') put(pixels, GLYPH_ORIGIN + col, GLYPH_ORIGIN + row, accent.ink);
      else if (symbol === '+') put(pixels, GLYPH_ORIGIN + col, GLYPH_ORIGIN + row, accent.light);
      else if (symbol === '-') put(pixels, GLYPH_ORIGIN + col, GLYPH_ORIGIN + row, accent.dark);
    }
  }
  if (spent) {
    for (const [x, y] of CRACK) put(pixels, x, y, SPENT.rim);
  }
  return pixels;
}

/** Frames alternate armed/spent so a spent plate is never tinted in place. */
export function trapFrame(kind: TrapKind, spent = false): number {
  const index = TRAP_KINDS.indexOf(kind);
  return (index < 0 ? 0 : index) * 2 + (spent ? 1 : 0);
}

export const TRAP_FRAME_COUNT = TRAP_KINDS.length * 2;

export function generateTrapTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(TRAP_TEXTURE)) return;
  const texture = scene.textures.createCanvas(TRAP_TEXTURE, SIZE, SIZE * TRAP_FRAME_COUNT);
  if (!texture) return;
  const context = texture.getContext();
  for (const kind of TRAP_KINDS) {
    for (const spent of [false, true]) {
      const frame = trapFrame(kind, spent);
      const image = context.createImageData(SIZE, SIZE);
      trapPixels(kind, spent).forEach((color, i) => {
        image.data[i * 4] = color < 0 ? 0 : color >> 16;
        image.data[i * 4 + 1] = color < 0 ? 0 : (color >> 8) & 255;
        image.data[i * 4 + 2] = color < 0 ? 0 : color & 255;
        image.data[i * 4 + 3] = color < 0 ? 0 : 255;
      });
      const y = frame * SIZE;
      context.putImageData(image, 0, y);
      texture.add(frame, 0, 0, y, SIZE, SIZE);
    }
  }
  texture.refresh();
}
