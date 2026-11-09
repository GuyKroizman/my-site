import type Phaser from 'phaser';

// Dedicated treasure-chest art. The floor tilesheet only carries a flat,
// two-colour chest, so chests and the mimics that disguise themselves as one
// share a generated sprite instead: banded wood, iron corner straps and a gold
// clasp read as treasure at 16px.
//
// A dormant mimic uses CHEST_TEXTURE unchanged — the disguise is the whole
// point of the monster. Once provoked it swaps to MIMIC_TEXTURE, the same
// chest silhouette opened into a fanged mouth.
export const CHEST_TEXTURE = 'chest-closed';
export const MIMIC_TEXTURE = 'mimic-revealed';

const SIZE = 16;

// Palette taken from the dungeon tilesheet (stone/iron/gold) with warmer,
// browner wood tones than the tilesheet's salmon, plus one darker-than-outline
// maw colour so the open mouth still separates from the sprite's own dark edge.
const PALETTE: Record<string, number> = {
  o: 0x24161f, // outline
  w: 0x92602f, // wood
  h: 0xb37f4a, // lit wood
  d: 0x533517, // shaded wood / plinth
  i: 0xcfc6b8, // iron band
  j: 0x8c8374, // iron shadow
  g: 0xf4b41b, // gold clasp
  k: 0x96680c, // gold shadow
  l: 0xffe496, // gold glint
  x: 0x0e080c, // open maw
  r: 0xe6482e // tongue
};

// Closed chest: domed lid, iron rim, corner straps, gold clasp with a keyhole.
const CHEST_ROWS: readonly string[] = [
  '................',
  '.oooooooooooooo.',
  'ohhhhhhhhhhhhhho',
  'ohhwwwwwwwwwwwwo',
  'oijwwwwwwwwwwijo',
  'oijwwwlgglwwwijo',
  'oijwwwggggwwwijo',
  'oiiiiigoogiiiiio',
  'ojjjjjkkkkjjjjjo',
  'oijwwwwwwwwwwijo',
  'oijwwwwwwwwwwijo',
  'oijwwwwwwwwwwijo',
  'oijwwwwwwwwwwijo',
  'oddddddddddddddo',
  'oooooooooooooooo',
  '..dddddddddddd..'
];

// Provoked mimic: the lid is the upper jaw, the body the lower one. Gold eyes
// sit where the treasure would be, so the reveal still reads as a chest.
const MIMIC_ROWS: readonly string[] = [
  '................',
  '.oooooooooooooo.',
  'ohhhhhhhhhhhhhho',
  'owwgggwwwwgggwwo',
  'owwgkgwwwwgkgwwo',
  'oooooooooooooooo',
  '.xxiixiixiixiix.',
  '.xxixxixxixxixx.',
  '.xxxxxroorxxxxx.',
  '.xixxirrrrxixix.',
  '.jjjjjjjjjjjjjj.',
  'oijwwwwwwwwwwijo',
  'oijwwwwwwwwwwijo',
  'oijwwwwwwwwwwijo',
  'oddddddddddddddo',
  '..dddddddddddd..'
];

function paint(scene: Phaser.Scene, key: string, rows: readonly string[]): void {
  if (scene.textures.exists(key)) return;
  const graphics = scene.make.graphics(undefined, false);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = PALETTE[row[x]];
      if (color === undefined) continue;
      graphics.fillStyle(color, 1);
      graphics.fillRect(x, y, 1, 1);
    }
  });
  graphics.generateTexture(key, SIZE, SIZE);
  graphics.destroy();
}

export function generateChestTextures(scene: Phaser.Scene): void {
  paint(scene, CHEST_TEXTURE, CHEST_ROWS);
  paint(scene, MIMIC_TEXTURE, MIMIC_ROWS);
}
