// Runtime-generated armor textures for the tiered armor roster.
//
// The legacy tilesheet only has a single shield silhouette, so every tier of
// armor used to look identical (and identical to a shield). We draw a distinct
// cuirass for each material so Cloth, Leather, Mail, Scale, and Plate Armor
// read correctly both on the floor and in the inventory.
import Phaser from "phaser";
import { ARMOR_TEXTURES } from "./items/tieredEquipment";

export function generateArmorTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ARMOR_TEXTURES[0])) drawCloth(scene);
  if (!scene.textures.exists(ARMOR_TEXTURES[1])) drawLeather(scene);
  if (!scene.textures.exists(ARMOR_TEXTURES[2])) drawMail(scene);
  if (!scene.textures.exists(ARMOR_TEXTURES[3])) drawScale(scene);
  if (!scene.textures.exists(ARMOR_TEXTURES[4])) drawPlate(scene);
}

// Shared torso silhouette: shoulders, a tapering cuirass, and a neck opening.
// Keeping the same outline across tiers makes the material differences read as
// variations of one item class rather than five unrelated icons.
function drawCuirass(
  g: Phaser.GameObjects.Graphics,
  base: number,
  dark: number,
  light: number
): void {
  // Pauldrons.
  g.fillStyle(base, 1);
  g.fillRect(2, 1, 3, 2);
  g.fillRect(11, 1, 3, 2);

  // Torso tapers from the shoulders down to the waist.
  g.fillTriangle(4, 2, 11, 2, 13, 13);
  g.fillTriangle(4, 2, 13, 13, 3, 13);

  // Neck opening.
  g.fillStyle(dark, 1);
  g.fillRect(6, 1, 4, 2);

  // Simple dark outline for the pauldrons (the torso fill is already a clean
  // silhouette, and stroking its two triangles would draw an interior seam).
  g.lineStyle(1, dark, 1);
  g.strokeRect(2, 1, 3, 2);
  g.strokeRect(11, 1, 3, 2);

  // Soft highlight down the left side of the torso.
  g.fillStyle(light, 0.35);
  g.fillRect(4, 3, 1, 9);
}

function drawCloth(scene: Phaser.Scene): void {
  const key = ARMOR_TEXTURES[0];
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const g = scene.make.graphics(undefined, false);
  const base = 0xc9b98a;
  const dark = 0x7d6f4e;
  const light = 0xf0e6c8;
  drawCuirass(g, base, dark, light);
  // Plain woven texture: a few horizontal threads.
  g.fillStyle(light, 0.5);
  for (const y of [5, 8, 11]) g.fillRect(5, y, 6, 1);
  // Simple crew neckline.
  g.fillStyle(dark, 1);
  g.fillRect(6, 2, 4, 1);
  g.generateTexture(key, 16, 16);
  g.destroy();
}

function drawLeather(scene: Phaser.Scene): void {
  const key = ARMOR_TEXTURES[1];
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const g = scene.make.graphics(undefined, false);
  const base = 0x9c6432;
  const dark = 0x4f2f16;
  const light = 0xd39a5a;
  drawCuirass(g, base, dark, light);
  // Center lacing.
  g.lineStyle(1, dark, 1);
  g.lineBetween(8, 4, 8, 11);
  for (const y of [4, 6, 8, 10]) {
    g.lineBetween(6, y, 10, y);
  }
  // Rivets at the shoulders.
  g.fillStyle(light, 1);
  g.fillRect(3, 2, 1, 1);
  g.fillRect(12, 2, 1, 1);
  g.generateTexture(key, 16, 16);
  g.destroy();
}

function drawMail(scene: Phaser.Scene): void {
  const key = ARMOR_TEXTURES[2];
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const g = scene.make.graphics(undefined, false);
  const base = 0x9faab2;
  const dark = 0x4f5b64;
  const light = 0xd6dee4;
  drawCuirass(g, base, dark, light);
  // Chainmail ring pattern, clipped to the torso by drawing inside it.
  for (let y = 4; y <= 11; y += 2) {
    for (let x = 4 + (y % 4 === 0 ? 0 : 1); x <= 11; x += 2) {
      g.fillStyle(dark, 0.8);
      g.fillRect(x, y, 1, 1);
    }
  }
  // Ring highlights catch light on the upper left.
  g.fillStyle(light, 0.7);
  g.fillRect(4, 4, 1, 1);
  g.fillRect(6, 4, 1, 1);
  g.generateTexture(key, 16, 16);
  g.destroy();
}

function drawScale(scene: Phaser.Scene): void {
  const key = ARMOR_TEXTURES[3];
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const g = scene.make.graphics(undefined, false);
  const base = 0x3f9b74;
  const dark = 0x1e5c43;
  const light = 0x7fd6a8;
  drawCuirass(g, base, dark, light);
  // Overlapping scale rows, each row a set of small arcs.
  for (let row = 0; row < 3; row++) {
    const y = 4 + row * 3;
    for (let x = 4 + (row % 2); x <= 10; x += 3) {
      g.fillStyle(light, 1);
      g.fillRect(x, y, 2, 1);
      g.fillStyle(dark, 1);
      g.fillRect(x, y + 1, 2, 1);
      g.fillRect(x, y + 2, 2, 1);
    }
  }
  g.generateTexture(key, 16, 16);
  g.destroy();
}

function drawPlate(scene: Phaser.Scene): void {
  const key = ARMOR_TEXTURES[4];
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const g = scene.make.graphics(undefined, false);
  const base = 0xd3dae0;
  const dark = 0x5f6b74;
  const light = 0xf4f8fb;
  drawCuirass(g, base, dark, light);
  // Chest plate seam.
  g.lineStyle(1, dark, 0.8);
  g.lineBetween(8, 3, 8, 9);
  // Rivets along the seam and shoulders.
  g.fillStyle(light, 1);
  g.fillRect(7, 3, 1, 1);
  g.fillRect(7, 6, 1, 1);
  g.fillRect(7, 9, 1, 1);
  g.fillRect(3, 2, 1, 1);
  g.fillRect(12, 2, 1, 1);
  // Waist belt.
  g.fillStyle(dark, 1);
  g.fillRect(4, 11, 8, 1);
  g.fillStyle(0xe8b23a, 1);
  g.fillRect(7, 11, 2, 1);
  g.generateTexture(key, 16, 16);
  g.destroy();
}
