import type Phaser from 'phaser';

// Every kind of glyph stone has its own artwork: a distinct silhouette, stone
// colour and inlaid rune. Both kinds can lie side by side in the same trampled
// grass, so they must be tellable apart at a glance rather than by tooltip.
// Drawing them at runtime keeps them independent of the floor tilesheet, whose
// tiles are mostly scenery and equipment.
export const GLYPH_STONE_TEXTURES = {
  blink: 'glyph-stone-blink',
  detectCurse: 'glyph-stone-detect-curse'
} as const;

export type GlyphStoneKind = keyof typeof GLYPH_STONE_TEXTURES;

export const GLYPH_STONE_KINDS = Object.keys(GLYPH_STONE_TEXTURES) as GlyphStoneKind[];

export type GlyphStonePalette = {
  outline: number;
  shadow: number;
  body: number;
  light: number;
  ink: number;
  glow: number;
  inkShadow: number;
};

// Blink is a cool blue-white shard. Detect curse is a squat, moss-green cobble.
// The carved runes share the ink colours with the stone tint so each kind reads
// as one object before the face is legible at 1x.
export const GLYPH_STONE_PALETTES: Record<GlyphStoneKind, GlyphStonePalette> = {
  blink: {
    outline: 0x1b2430,
    shadow: 0x4a5c74,
    body: 0x7c93ad,
    light: 0xb3c8dd,
    ink: 0x35c8ff,
    glow: 0xdcf8ff,
    inkShadow: 0x1a7fa8
  },
  detectCurse: {
    outline: 0x24261b,
    shadow: 0x5c6044,
    body: 0x8f9670,
    light: 0xc3c9a3,
    ink: 0x3fbf5a,
    glow: 0xdcffe2,
    inkShadow: 0x226b31
  }
};

const STONE_SIZE = 16;
const TRANSPARENT = -1;

type Token = '.' | 'o' | 'd' | 'b' | 'h' | '#' | '+' | '-';

// o outline, d shadow, b body, h highlight. Every row is exactly 16 pixels.
const STONE_ROWS: Record<GlyphStoneKind, readonly string[]> = {
  // An upright, pointed shard: narrow at the top, widest around the middle.
  blink: [
    '......oo.....+..',
    '.....ohho.......',
    '....ohhho.......',
    '....ohhbbbo.....',
    '...ohhbbbbbo....',
    '...ohhbbbbbbo...',
    '..ohhbbbbbbbbdo.',
    '..ohhbbbbbbbbdo.',
    '..ohbbbbbbbbddo.',
    '..ohbbbbbbbbddo.',
    '...ohbbbbbbbddo.',
    '...ohbbbbbbddo..',
    '....obbbbbbddo..',
    '....obbbbbddo...',
    '.....obbbddo....',
    '......ooooo.....'
  ],
  // A wide, flatter cobble with a chipped top edge.
  detectCurse: [
    '................',
    '.....oooooo.....',
    '...oohhhhhhoo...',
    '..ohhhhhbbbbbo..',
    '.ohhbbbbbbbbbbo.',
    '.ohbbbbbbbbbbddo',
    '.ohbbbbbbbbbbddo',
    '.ohbbbbbbbbbbddo',
    '.ohbbbbbbbbbbddo',
    '.obbbbbbbbbbbddo',
    '.obbbbbbbbbbddo.',
    '..obbbbbbbbbddo.',
    '...obbbbbbbddo..',
    '....obbbbbddo...',
    '.....oooooo.....',
    '................'
  ]
};

// '#' ink, '+' highlight ink, '-' shadow ink. Shapes are deliberately unlike
// each other: a four-point blink sparkle versus a ringed curse eye.
const RUNE_ROWS: Record<GlyphStoneKind, readonly string[]> = {
  blink: [
    '...+...',
    '...#...',
    '..###..',
    '#######',
    '..###..',
    '...#...',
    '...#...'
  ],
  detectCurse: [
    '..###..',
    '.#..+..',
    '#.....#',
    '#.---.#',
    '#.....#',
    '.#...#.',
    '..###..'
  ]
};

const RUNE_ORIGIN: Record<GlyphStoneKind, readonly [number, number]> = {
  blink: [4, 5],
  detectCurse: [4, 4]
};

const TOKENS: Record<Exclude<Token, '.'>, keyof GlyphStonePalette> = {
  o: 'outline',
  d: 'shadow',
  b: 'body',
  h: 'light',
  '#': 'ink',
  '+': 'glow',
  '-': 'inkShadow'
};

// Flatten one kind into 16x16 RGBA-less colour indices: -1 is transparent and
// every other value is an opaque 0xRRGGBB colour. Exported so the visual suite
// can compare silhouettes and palettes without a Phaser renderer.
export function glyphStonePixels(kind: GlyphStoneKind): number[] {
  const palette = GLYPH_STONE_PALETTES[kind];
  const cells = STONE_ROWS[kind].map(row => [...row]);
  const [originX, originY] = RUNE_ORIGIN[kind];
  RUNE_ROWS[kind].forEach((row, y) => {
    [...row].forEach((token, x) => {
      if (token === '.') return;
      const stoneRow = cells[originY + y];
      if (!stoneRow) return;
      stoneRow[originX + x] = token;
    });
  });

  const pixels: number[] = [];
  for (let y = 0; y < STONE_SIZE; y++) {
    for (let x = 0; x < STONE_SIZE; x++) {
      const token = (cells[y]?.[x] ?? '.') as Token;
      pixels.push(token === '.' ? TRANSPARENT : palette[TOKENS[token]]);
    }
  }
  return pixels;
}

export function generateGlyphStoneTextures(scene: Phaser.Scene): void {
  for (const kind of GLYPH_STONE_KINDS) {
    const key = GLYPH_STONE_TEXTURES[kind];
    if (scene.textures.exists(key)) continue;
    const graphics = scene.make.graphics(undefined, false);
    glyphStonePixels(kind).forEach((color, index) => {
      if (color === TRANSPARENT) return;
      graphics.fillStyle(color, 1);
      graphics.fillRect(index % STONE_SIZE, Math.floor(index / STONE_SIZE), 1, 1);
    });
    graphics.generateTexture(key, STONE_SIZE, STONE_SIZE);
    graphics.destroy();
  }
}
