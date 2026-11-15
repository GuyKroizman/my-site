// Runtime-generated art for junk, boots and the dropped-backpack container.
import type Phaser from "phaser";

export const BOOT_TEXTURE = "junk-boot";
export const BLESSED_BOOT_TEXTURE = "blessed-boot";
export const DROPPED_BACKPACK_TEXTURE = "dropped-backpack";

type Art = readonly string[];
type Palette = Record<string, number>;

const BOOT_ART: Art = [
  '................',
  '................',
  '....####........',
  '...#lllh#.......',
  '...#llhh#.......',
  '...#lhhh#.......',
  '...#lhhh#.......',
  '...#lhhh#.......',
  '...#lhhhh###....',
  '...#lhhhhhhh#...',
  '...#hhhhhhhh#...',
  '...##########...',
  '....#bbbbbb#....',
  '....########....',
  '................',
  '................'
];

const BLESSED_BOOT_ART: Art = [
  '.......gg.......',
  '......gGGg......',
  '....####........',
  '...#lllh#.......',
  '...#llhh#.......',
  '...#lhhh#.......',
  '...#lhhh#.......',
  '...#lhhh#.......',
  '...#lhhhh###....',
  '...#lhhhhhhh#...',
  '...#hhhhhhhh#...',
  '...##########...',
  '....#bbbbbb#....',
  '....########....',
  '................',
  '................'
];

const DROPPED_BACKPACK_ART: Art = [
  '................',
  '......####......',
  '.....#ssss#.....',
  '....#ssssss#....',
  '...#ss####ss#...',
  '...#s#llll#s#...',
  '...#s#llll#s#...',
  '...#s#llll#s#...',
  '...#s######s#...',
  '...#ssssssss#...',
  '...#ssssssss#...',
  '...#ssssssss#...',
  '...#ssssssss#...',
  '....########....',
  '................',
  '................'
];

const PALETTE: Palette = {
  '#': 0x222334, l: 0xb37654, h: 0x663e39, b: 0x3b2a2f,
  g: 0xffd866, G: 0xfff3b0, s: 0x7a5230
};

function drawArt(scene: Phaser.Scene, key: string, art: Art): void {
  if (scene.textures.exists(key)) return;
  const graphics = scene.make.graphics(undefined, false);
  art.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (pixel === '.' || !(pixel in PALETTE)) return;
    graphics.fillStyle(PALETTE[pixel], 1);
    graphics.fillRect(x, y, 1, 1);
  }));
  graphics.generateTexture(key, 16, 16);
  graphics.destroy();
}

export function generateJunkTextures(scene: Phaser.Scene): void {
  drawArt(scene, BOOT_TEXTURE, BOOT_ART);
  drawArt(scene, BLESSED_BOOT_TEXTURE, BLESSED_BOOT_ART);
  drawArt(scene, DROPPED_BACKPACK_TEXTURE, DROPPED_BACKPACK_ART);
}
