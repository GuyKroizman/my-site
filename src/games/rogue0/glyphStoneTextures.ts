import type Phaser from 'phaser';

// Glyph stones share one worn-stone silhouette and differ by the rune inlaid
// on their face. Drawing them at runtime keeps them independent of the floor
// tilesheet, whose tiles are mostly scenery and equipment.
export const GLYPH_STONE_TEXTURES = {
  blink: 'glyph-stone-blink',
  detectCurse: 'glyph-stone-detect-curse'
} as const;

const STONE_OUTLINE = 0x2b2e34;
const STONE_SHADOW = 0x666c76;
const STONE_BODY = 0x8b929c;
const STONE_LIGHT = 0xb8c0ca;

const BLINK_GLYPH = [
  '..#..',
  '.#.#.',
  '#...#',
  '.#.#.',
  '..#..'
];

const DETECT_CURSE_GLYPH = [
  '..###..',
  '.#...#.',
  '#..#..#',
  '.#...#.',
  '..###..'
];

function drawGlyph(
  graphics: Phaser.GameObjects.Graphics,
  glyph: string[],
  ink: number,
  glow: number
): void {
  const offsetX = Math.floor((16 - glyph[0].length) / 2);
  const offsetY = Math.floor((16 - glyph.length) / 2);
  glyph.forEach((row, y) => {
    [...row].forEach((pixel, x) => {
      if (pixel !== '#') return;
      // A one-pixel dark backing keeps the rune legible on the light stone.
      graphics.fillStyle(STONE_OUTLINE, 1);
      graphics.fillRect(offsetX + x - 1, offsetY + y, 1, 1);
      graphics.fillStyle(y === 0 ? glow : ink, 1);
      graphics.fillRect(offsetX + x, offsetY + y, 1, 1);
    });
  });
}

function drawStone(
  scene: Phaser.Scene,
  key: string,
  glyph: string[],
  ink: number,
  glow: number
): void {
  if (scene.textures.exists(key)) return;
  const graphics = scene.make.graphics(undefined, false);

  // A 13x11 oval with a lit top-left face and a darker underside. The stepped
  // pixel edge matches the rest of the game's 16x16 art.
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const nx = (x - 7.5) / 6.4;
      const ny = (y - 8) / 5.3;
      const distance = nx * nx + ny * ny;
      if (distance > 1) continue;
      const color = distance > 0.78 ? STONE_OUTLINE
        : y <= 5 && x <= 8 ? STONE_LIGHT
        : y >= 10 ? STONE_SHADOW
        : STONE_BODY;
      graphics.fillStyle(color, 1);
      graphics.fillRect(x, y, 1, 1);
    }
  }

  drawGlyph(graphics, glyph, ink, glow);
  graphics.generateTexture(key, 16, 16);
  graphics.destroy();
}

export function generateGlyphStoneTextures(scene: Phaser.Scene): void {
  drawStone(scene, GLYPH_STONE_TEXTURES.blink, BLINK_GLYPH, 0x66d9ff, 0xd6f7ff);
  drawStone(scene, GLYPH_STONE_TEXTURES.detectCurse, DETECT_CURSE_GLYPH, 0x7ee08a, 0xe0ffe4);
}
