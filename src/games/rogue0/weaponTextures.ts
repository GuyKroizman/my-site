import type Phaser from "phaser";
import { WEAPON_TEXTURES } from "./items/tieredEquipment";

// Hand-placed 16px sprites: diagonal swords grow in length and blade width;
// the greataxe has a completely different, double-bit silhouette. No gradients
// or subpixel strokes, so edges stay crisp at the game's nearest-neighbor zoom.
// . transparent, # outline, e edge, s steel, d bevel/fullers,
// g gold/brass, b dark metal, h leather, l leather wrap, j inset jewel.
const PALETTE: Record<string, number> = {
  '#': 0x222334, e: 0xf0f5ee, s: 0xa9c4cf, d: 0x5a7b91,
  g: 0xe8bc68, b: 0x866044, h: 0x663e39, l: 0xb37654, j: 0x8ee5de
};

const ART = [
  // Tier 2: compact steel shortsword, brass crossguard, leather grip.
  [
    '................',
    '................',
    '................',
    '...........###..',
    '..........#es#..',
    '.........#esd#..',
    '........#esd#...',
    '.......#esd#....',
    '....##.#sd#.....',
    '....#gb#d#......',
    '.....#gg#.......',
    '....#lhbg#......',
    '...#lh#.##......',
    '..#gb#..........',
    '..###...........',
    '................'
  ],
  // Tier 3: broad diamond-ground blade with a dark fuller and bronze hilt.
  [
    '................',
    '...........###..',
    '..........#es#..',
    '.........#esd#..',
    '........#esdd#..',
    '.......#esdd#...',
    '......#esdd#....',
    '...##.#sdd#.....',
    '...#gb#dd#......',
    '....#ggd#.......',
    '.....#ggb#......',
    '....#lh#bg#.....',
    '...#lh#.###.....',
    '..#gb#..........',
    '..###...........',
    '................'
  ],
  // Tier 4: long ice-steel greatsword, gilded swept guard and teal inset.
  [
    '............###.',
    '...........#es#.',
    '..........#esd#.',
    '.........#esdd#.',
    '........#esdd#..',
    '.......#esdd#...',
    '..##..#esdd#....',
    '..#g#.#sdd#.....',
    '...#gb#dd#......',
    '....#gjg#.......',
    '....#lhbg#......',
    '...#lh#.#g#.....',
    '..#lh#...##.....',
    '.#gj#...........',
    '.###............',
    '................'
  ],
  // Tier 5: massive twin crescent axe, gold socket, ruby and bound haft.
  [
    '.......##.......',
    '..##..#gg#..##..',
    '.#es###gb###se#.',
    '.#esdgsggsgdse#.',
    '.#esddgjjgddse#.',
    '.#esddggggddse#.',
    '.#esd##gb##dse#.',
    '..#e#.#gb#.#e#..',
    '...#..#lh#..#...',
    '......#hh#......',
    '......#lh#......',
    '......#hh#......',
    '......#lh#......',
    '......#gb#......',
    '......#gg#......',
    '.......##.......'
  ]
] as const;

/** Transparent pixels are -1; all other values are opaque RGB. */
export function weaponPixels(tier: number): number[] {
  const rows = ART[tier - 2];
  if (!rows) throw new RangeError(`No dedicated weapon artwork for tier ${tier}`);
  const palette = tier === 5 ? { ...PALETTE, j: 0xef7c78, d: 0x667393 } : PALETTE;
  return rows.flatMap(row => [...row].map(pixel => pixel === '.' ? -1 : palette[pixel]));
}

// Legacy single-tier weapons keep their own silhouettes instead of borrowing a
// tiered blade, so a plain sword never reads as a tier-3 broadsword.
export const LEGACY_WEAPON_ART = {
  'weapon-dagger': [
    '................',
    '...........###..',
    '..........#es#..',
    '.........#es#...',
    '........#esd#...',
    '.......#esd#....',
    '....##.#sd#.....',
    '....#gb#d#......',
    '.....#gg#.......',
    '....#lhbg#......',
    '...#lh#.##......',
    '..##h#..........',
    '....#...........',
    '................',
    '................',
    '................'
  ],
  'weapon-sword': [
    '................',
    '...........###..',
    '..........#es#..',
    '..........#es#..',
    '.........#esd#..',
    '.........#esd#..',
    '........#esdd#..',
    '....###.#sdd#...',
    '...#gbg##dd#....',
    '....#gg#d#......',
    '....#lhbg#......',
    '...#lh#.#g#.....',
    '..##h#...##.....',
    '....#...........',
    '................',
    '................'
  ],
  'weapon-longsword': [
    '............###.',
    '...........#es#.',
    '..........#es#..',
    '..........#es#..',
    '.........#esd#..',
    '.........#esd#..',
    '........#esdd#..',
    '..##...#esdd#...',
    '..#g#..#sdd#....',
    '...#gb#dd#......',
    '....#ggg#.......',
    '...#lhbg#.......',
    '..#lh#..#g#.....',
    '.##h#....##.....',
    '...#............',
    '................'
  ],
  'weapon-axe': [
    '................',
    '.....##.........',
    '....#es#........',
    '...#esd#####....',
    '...#esddddde#...',
    '...#esddddde#...',
    '....#sd#####....',
    '.....##.........',
    '......#lh#......',
    '......#hh#......',
    '......#lh#......',
    '......#hh#......',
    '......#lh#......',
    '......#gb#......',
    '.......##.......',
    '................'
  ],
  'weapon-hammer': [
    '................',
    '................',
    '....########....',
    '...#esssssse#...',
    '...#dddddddd#...',
    '....#g####g#....',
    '......#lh#......',
    '......#hh#......',
    '......#lh#......',
    '......#hh#......',
    '......#lh#......',
    '......#hh#......',
    '......#lh#......',
    '......#gb#......',
    '.......##.......',
    '................'
  ]
} as const satisfies Record<string, readonly string[]>;

export type LegacyWeaponTexture = keyof typeof LEGACY_WEAPON_ART;

/** Pixels for a legacy single-tier weapon key; -1 is transparent. */
export function legacyWeaponPixels(key: LegacyWeaponTexture): number[] {
  return LEGACY_WEAPON_ART[key].flatMap(row => [...row].map(pixel => pixel === '.' ? -1 : PALETTE[pixel]));
}

function paint(scene: Phaser.Scene, key: string, pixels: number[], size = 16): void {
  if (scene.textures.exists(key)) return;
  const graphics = scene.make.graphics(undefined, false);
  pixels.forEach((color, index) => {
    if (color === -1) return;
    graphics.fillStyle(color, 1);
    graphics.fillRect(index % 16, Math.floor(index / 16), 1, 1);
  });
  graphics.generateTexture(key, size, 16);
  graphics.destroy();
}

export function generateWeaponTextures(scene: Phaser.Scene): void {
  for (let tier = 2; tier <= 5; tier++) {
    paint(scene, WEAPON_TEXTURES[tier - 1]!, weaponPixels(tier));
  }
  for (const key of Object.keys(LEGACY_WEAPON_ART) as LegacyWeaponTexture[]) {
    paint(scene, key, legacyWeaponPixels(key));
  }
}
