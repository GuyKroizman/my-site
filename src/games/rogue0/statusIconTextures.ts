import type Phaser from 'phaser';

// HUD status icons.
//
// The old HUD borrowed 16x16 glyphs from the floor tilesheet, which is a font
// sheet: several statuses pointed at the same frame (confused/torch/terrified,
// and charmed/magical-sight/mind-vision/blinded), so the icons could not be
// told apart. Every effect now has its own drawn icon instead.
//
// Icons are authored on a 12x12 grid and rendered as 2x2 blocks into 24x24
// frames, so the art is crisp at 1:1 (no half-pixel scaling) while staying
// small enough to stack beside the hero portrait. Pure visuals: nothing here
// reads gameplay state or uses Math.random.

export const STATUS_ICON_TEXTURE = 'status-icons';

/** Authored glyph grid; every rendered art pixel is a 2x2 block. */
const GRID = 12;
const BLOCK = 2;
export const STATUS_ICON_SIZE = GRID * BLOCK;

export type StatusIconPalette = {
  /** Main ink ('#'). */
  ink: number;
  /** Highlight ('+'). */
  light: number;
  /** Shade ('-'). */
  dark: number;
};

// One hue per effect: harmful effects sit on the red/orange side, helpful ones
// on green/blue, and control effects keep their own families (purple curses,
// violet mind, teal vision). Shape carries the meaning; colour separates the
// neighbours (frozen vs chilled, weakened vs crippled).
export const STATUS_ICON_PALETTES: Record<string, StatusIconPalette> = {
  burning: { ink: 0xef5a2a, light: 0xffc46b, dark: 0x8f1f0a },
  poisoned: { ink: 0x63cc55, light: 0xc4ffb0, dark: 0x2c6f28 },
  bleeding: { ink: 0xd8353f, light: 0xff9aa0, dark: 0x7d1420 },
  regeneration: { ink: 0x57d977, light: 0xd6ffdf, dark: 0x1f7a3a },
  'potion-healing': { ink: 0x35c75f, light: 0xcaffd8, dark: 0x187a34 },
  frozen: { ink: 0x8fe3ff, light: 0xe8fbff, dark: 0x2f7f9c },
  stunned: { ink: 0xffc45c, light: 0xfff4bf, dark: 0x99652b },
  chilled: { ink: 0x6fb7e8, light: 0xd2ecff, dark: 0x2a5f86 },
  weakened: { ink: 0xb85a6a, light: 0xffb3bf, dark: 0x6a2634 },
  crippled: { ink: 0xa88450, light: 0xe6cfa2, dark: 0x5d4526 },
  strengthened: { ink: 0xf0a03a, light: 0xffe0a0, dark: 0x8a4c0c },
  cursed: { ink: 0xa87bf0, light: 0xdcb8ff, dark: 0x4f2a86 },
  invisible: { ink: 0x9a86ff, light: 0xd8ccff, dark: 0x4a3a9a },
  haste: { ink: 0xf0d84a, light: 0xfff6b0, dark: 0x8a7410 },
  levitating: { ink: 0xbfe6ff, light: 0xffffff, dark: 0x6f93b0 },
  terrified: { ink: 0xe8d9a0, light: 0xfff6d0, dark: 0x8a7840 },
  charmed: { ink: 0xf063a6, light: 0xffb2d5, dark: 0x9a2f62 },
  confused: { ink: 0xd06be0, light: 0xf5c2ff, dark: 0x6d2a7d },
  torch: { ink: 0xf0b429, light: 0xffe9a8, dark: 0x8a5c0a },
  'magical-sight': { ink: 0x62c8ff, light: 0xd6f2ff, dark: 0x1f5f9c },
  'mind-vision': { ink: 0x4fd6c0, light: 0xc9fff4, dark: 0x1c6b60 },
  blinded: { ink: 0x9a93a8, light: 0xe0dbe8, dark: 0x4a4552 },
  rooted: { ink: 0x8fa860, light: 0xd4e6a8, dark: 0x435626 },
  'chalice-regeneration': { ink: 0x8a6ad8, light: 0xd6c4ff, dark: 0x442b8a },
  'chalice-drain': { ink: 0xc03a52, light: 0xff98a8, dark: 0x64101f }
};

// '#' main ink, '+' highlight, '-' shade, '.' transparent. Every row is
// exactly twelve characters; the tests assert this and the palettes above.
const GLYPHS: Record<string, readonly string[]> = {
  // Flame: pointed top, bulbous base, lit core.
  burning: [
    '.....##.....',
    '.....##.....',
    '....####....',
    '...######...',
    '..########..',
    '..###+####..',
    '.####++###..',
    '.###++++##..',
    '.###++++##..',
    '..#######...',
    '...#####....',
    '....###.....'
  ],
  // Single heavy droplet with a lit belly.
  poisoned: [
    '.....###....',
    '....#####...',
    '...#######..',
    '..#########.',
    '..#########.',
    '.###########',
    '.####+++####',
    '.###+++++###',
    '..#########.',
    '...#######..',
    '....#####...',
    '.....###....'
  ],
  // Three drops falling in a cascade.
  bleeding: [
    '..#.........',
    '.###........',
    '#####.......',
    '.###........',
    '..#.........',
    '.........#..',
    '........###.',
    '.......#####',
    '........###.',
    '.........#..',
    '............',
    '............'
  ],
  // Healing cross.
  regeneration: [
    '.....###....',
    '.....###....',
    '.....###....',
    '..#########.',
    '..##+++++##.',
    '..#########.',
    '.....###....',
    '.....###....',
    '.....###....',
    '.....###....',
    '............',
    '............'
  ],
  // Heart: the potion's slow, steady mending rather than the cross's pulse.
  'potion-healing': [
    '............',
    '..###..###..',
    '.####..####.',
    '####++++####',
    '############',
    '.##########.',
    '..########..',
    '...######...',
    '....####....',
    '.....##.....',
    '............',
    '............'
  ],
  // Six-armed snowflake.
  // Stars orbiting a dazed head.
  stunned: [
    '..+......+..',
    '.+#+....+#+.',
    '..+......+..',
    '....####....',
    '...#++++#...',
    '..#+-++-+#..',
    '..#++++++#..',
    '..#+----+#..',
    '...#++++#...',
    '....####....',
    '.+........+.',
    '............',
  ],
  frozen: [
    '.....##.....',
    '.....##.....',
    '.#...##...#.',
    '..#..##..#..',
    '...######...',
    '############',
    '...######...',
    '..#..##..#..',
    '.#...##...#.',
    '.....##.....',
    '.....##.....',
    '............'
  ],
  // Icicle with meltwater running off the tip.
  chilled: [
    '....####....',
    '...######...',
    '..########..',
    '..##++++##..',
    '..##++++##..',
    '...######...',
    '....####....',
    '.....++.....',
    '.....++.....',
    '......#.....',
    '......#.....',
    '............'
  ],
  // Downward arrow: damage and output drop.
  weakened: [
    '....####....',
    '....####....',
    '....####....',
    '..########..',
    '.##########.',
    '############',
    '.##########.',
    '..########..',
    '...######...',
    '....####....',
    '.....##.....',
    '............'
  ],
  // Boot: movement is broken.
  crippled: [
    '..##........',
    '..##........',
    '..#+........',
    '..##........',
    '..##........',
    '..##........',
    '..##........',
    '..####......',
    '..#######...',
    '..#########.',
    '............',
    '............'
  ],
  // Upward arrow, lit: damage and output rise.
  strengthened: [
    '.....##.....',
    '....####....',
    '...######...',
    '..########..',
    '.##########.',
    '############',
    '.##########.',
    '..########..',
    '....####....',
    '....####....',
    '....####....',
    '............'
  ],
  // Skull with dark sockets.
  cursed: [
    '..########..',
    '.##########.',
    '############',
    '##--####--##',
    '##--####--##',
    '############',
    '..########..',
    '...######...',
    '...#.##.#...',
    '...######...',
    '............',
    '............'
  ],
  // Hollow outline of a body: there, but not visible.
  invisible: [
    '....####....',
    '...#....#...',
    '...#....#...',
    '....#..#....',
    '..#######...',
    '..#.....#...',
    '..#.....#...',
    '..#######...',
    '...#...#....',
    '...#...#....',
    '..##...##...',
    '............'
  ],
  // Fast-forward chevrons.
  haste: [
    '............',
    '..#.....#...',
    '..##...##...',
    '..###..###..',
    '..##...##...',
    '..#.....#...',
    '............',
    '..#.....#...',
    '..##...##...',
    '..###..###..',
    '..##...##...',
    '..#.....#...'
  ],
  // Upward arrow with widening air lines under it.
  levitating: [
    '.....##.....',
    '....####....',
    '...######...',
    '..########..',
    '.....##.....',
    '.....##.....',
    '.....##.....',
    '............',
    '...######...',
    '............',
    '..########..',
    '............'
  ],
  // Exclamation held inside a diamond.
  terrified: [
    '.....##.....',
    '....#..#....',
    '...#.##.#...',
    '..#..##..#..',
    '.#...##...#.',
    '#....##....#',
    '.#...##...#.',
    '..#..##..#..',
    '...#.##.#...',
    '....#..#....',
    '.....##.....',
    '............'
  ],
  // Heart, lit from the top left.
  charmed: [
    '..###..###..',
    '.####++++##.',
    '############',
    '############',
    '.##########.',
    '..########..',
    '...######...',
    '....####....',
    '.....##.....',
    '............',
    '............',
    '............'
  ],
  // Dizzying spiral: movement picks a random direction.
  confused: [
    '...#####....',
    '..#.....#...',
    '.#..###..#..',
    '.#.#...#.#..',
    '.#.#.#.#.#..',
    '.#.#.#...#..',
    '.#.#.####.#.',
    '.#.......#..',
    '..#.....#...',
    '...#####....',
    '............',
    '............'
  ],
  // Flame on a handle: light you carry.
  torch: [
    '.....##.....',
    '....####....',
    '...######...',
    '...##++##...',
    '...######...',
    '....####....',
    '.....--.....',
    '.....--.....',
    '.....--.....',
    '....----....',
    '....----....',
    '............'
  ],
  // Eye with lashes and rays.
  'magical-sight': [
    '..#..##..#..',
    '...#.##.#...',
    '..#..##..#..',
    '....####....',
    '..##++++##..',
    '.#..#++#..#.',
    '#...####...#',
    '.#..#++#..#.',
    '..##++++##..',
    '....####....',
    '............',
    '............'
  ],
  // Ringed inner eye: sight that does not need to see.
  'mind-vision': [
    '....####....',
    '..##....##..',
    '.#..####..#.',
    '#..##..##..#',
    '#..#....#..#',
    '#..##..##..#',
    '.#..####..#.',
    '..##....##..',
    '....####....',
    '............',
    '............',
    '............'
  ],
  // Closed eye with a strike through it.
  blinded: [
    '..#......#..',
    '...#....#...',
    '....#..#....',
    '.....##.....',
    '..########..',
    '.....##.....',
    '....#..#....',
    '...#....#...',
    '..#......#..',
    '............',
    '............',
    '............'
  ],
  // Trunk and roots: held in place.
  rooted: [
    '.....##.....',
    '....####....',
    '...##..##...',
    '...##..##...',
    '....####....',
    '.....##.....',
    '.....##.....',
    '..#..##..#..',
    '.#...##...#.',
    '.#..####..#.',
    '..#......#..',
    '............'
  ],
  // Chalice with a healing cross.
  'chalice-regeneration': [
    '.##########.',
    '.#........#.',
    '.#...##...#.',
    '.#.######.#.',
    '.#...##...#.',
    '.#...##...#.',
    '..########..',
    '...######...',
    '....####....',
    '.....##.....',
    '.....##.....',
    '...######...'
  ],
  // The same chalice, inverted into a drain.
  'chalice-drain': [
    '.##########.',
    '.#........#.',
    '.#...##...#.',
    '.#...##...#.',
    '.#..####..#.',
    '.#...##...#.',
    '..########..',
    '...######...',
    '....####....',
    '.....##.....',
    '.....##.....',
    '...######...'
  ]
};

/** Glyph used for any effect without its own art. */
const UNKNOWN_GLYPH: readonly string[] = [
  '..######....',
  '.##....##...',
  '.##....##...',
  '.......##...',
  '......##....',
  '.....##.....',
  '.....##.....',
  '............',
  '.....##.....',
  '.....##.....',
  '............',
  '............'
];

const UNKNOWN_PALETTE: StatusIconPalette = { ink: 0xb8b0a4, light: 0xf0ebe2, dark: 0x6e675f };

/** Effects that get their own icon, in frame order. */
export const STATUS_ICON_IDS = Object.keys(GLYPHS);

/** The unknown-effect frame always sits last. */
export const STATUS_ICON_FRAME_COUNT = STATUS_ICON_IDS.length + 1;

export function statusIconPalette(id: string): StatusIconPalette {
  return STATUS_ICON_PALETTES[id] ?? UNKNOWN_PALETTE;
}

export function statusIconGlyph(id: string): readonly string[] {
  return GLYPHS[id] ?? UNKNOWN_GLYPH;
}

/** Frame index for an effect id; unknown ids fall back to the '?' frame. */
export function statusIconFrame(id: string): number {
  const index = STATUS_ICON_IDS.indexOf(id);
  return index < 0 ? STATUS_ICON_IDS.length : index;
}

function put(pixels: number[], x: number, y: number, color: number): void {
  if (x < 0 || y < 0 || x >= STATUS_ICON_SIZE || y >= STATUS_ICON_SIZE) return;
  pixels[y * STATUS_ICON_SIZE + x] = color;
}

/**
 * Pure pixels for one icon: 24x24, -1 for transparent. Each authored cell
 * becomes a 2x2 block so the art never needs fractional scaling.
 */
export function statusIconPixels(id: string): number[] {
  const pixels = new Array<number>(STATUS_ICON_SIZE * STATUS_ICON_SIZE).fill(-1);
  const glyph = statusIconGlyph(id);
  const palette = statusIconPalette(id);
  for (let row = 0; row < GRID; row++) {
    const line = glyph[row] ?? '';
    for (let col = 0; col < GRID; col++) {
      const symbol = line[col];
      if (symbol === undefined || symbol === '.') continue;
      const color = symbol === '#' ? palette.ink : symbol === '+' ? palette.light : symbol === '-' ? palette.dark : undefined;
      if (color === undefined) continue;
      for (let by = 0; by < BLOCK; by++) {
        for (let bx = 0; bx < BLOCK; bx++) {
          put(pixels, col * BLOCK + bx, row * BLOCK + by, color);
        }
      }
    }
  }
  return pixels;
}

/** Builds the one status-icon sheet the HUD slices by frame. */
export function generateStatusIconTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(STATUS_ICON_TEXTURE)) return;
  const texture = scene.textures.createCanvas(
    STATUS_ICON_TEXTURE,
    STATUS_ICON_SIZE,
    STATUS_ICON_SIZE * STATUS_ICON_FRAME_COUNT
  );
  if (!texture) return;
  const context = texture.getContext();
  for (let frame = 0; frame < STATUS_ICON_FRAME_COUNT; frame++) {
    const id = STATUS_ICON_IDS[frame];
    const pixels = statusIconPixels(id ?? '');
    const image = context.createImageData(STATUS_ICON_SIZE, STATUS_ICON_SIZE);
    pixels.forEach((color, i) => {
      image.data[i * 4] = color < 0 ? 0 : color >> 16;
      image.data[i * 4 + 1] = color < 0 ? 0 : (color >> 8) & 255;
      image.data[i * 4 + 2] = color < 0 ? 0 : color & 255;
      image.data[i * 4 + 3] = color < 0 ? 0 : 255;
    });
    const y = frame * STATUS_ICON_SIZE;
    context.putImageData(image, 0, y);
    texture.add(frame, 0, 0, y, STATUS_ICON_SIZE, STATUS_ICON_SIZE);
  }
  texture.refresh();
}
