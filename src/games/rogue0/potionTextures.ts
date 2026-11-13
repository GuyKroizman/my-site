// Runtime-generated potion flask textures.
//
// The Kenney tilesheet only has a green potion flask (and a heart that reads
// as an apple), so we draw crisp, colored flasks ourselves and store them as
// named single-frame textures. Potion items point at these via `textureKey`.
import Phaser from "phaser";
import { doorTextureKeys, type DoorStyle } from "./dungeonTheme";

export const POTION_COLORS = {
  red: 0xe04a3a,
  green: 0x35c75f,
  blue: 0x3d8bff,
  gold: 0xf0b429,
  purple: 0x9b59ff
} as const;

export function generatePotionTextures(scene: Phaser.Scene): void {
  // Enough distinct colors for every potion name, including legacy potions.
  // Entity assigns these randomly without replacement for each run.
  const colors = [
    POTION_COLORS.red, POTION_COLORS.green, POTION_COLORS.blue,
    POTION_COLORS.gold, POTION_COLORS.purple, 0x28d9da,
    0xff8c32, 0xf276bb, 0xb7e342, 0xf0eee0, 0x82502e, 0x686878
  ];

  colors.forEach((color, i) => {
    const key = `potion-${i}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const g = scene.make.graphics(undefined, false);
    drawFlask(g, color);
    g.generateTexture(key, 16, 16);
    g.destroy();
  });
}

// Generic "unidentified" icons — one per item category, so the inventory can
// tell a potion from a scroll (etc.) without revealing what it actually is.
export function generateUnknownItemTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists("unknown-potion")) {
    const g = scene.make.graphics(undefined, false);
    drawFlask(g, 0x9a9a9a);
    g.generateTexture("unknown-potion", 16, 16);
    g.destroy();
  }
  if (!scene.textures.exists("unknown-scroll")) {
    const g = scene.make.graphics(undefined, false);
    g.fillStyle(0xd8d0c0, 1);
    g.fillRect(3, 3, 10, 10);
    g.fillStyle(0x8a8274, 1);
    g.fillRect(3, 3, 10, 2);
    g.fillRect(3, 11, 10, 2);
    g.generateTexture("unknown-scroll", 16, 16);
    g.destroy();
  }
  // Keep the same wand silhouette before and after identification.
  const wandColors: Record<string, number> = {
    "unknown-wand": 0x9a9a9a,
    "wand-fire": 0xff793f,
    "wand-ice": 0x80dfff,
    "wand-shock": 0xffe36b,
    "wand-magic": 0xdac8ff
  };
  for (const [key, color] of Object.entries(wandColors)) {
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics(undefined, false);
    g.lineStyle(2, 0x8a5a2b, 1);
    g.lineBetween(3, 13, 12, 4);
    g.fillStyle(color, 1);
    g.fillCircle(13, 3, 2);
    g.generateTexture(key, 16, 16);
    g.destroy();
  }
  if (!scene.textures.exists("unknown-ring")) {
    const g = scene.make.graphics(undefined, false);
    g.lineStyle(2, 0xc9a227, 1);
    g.strokeCircle(8, 8, 5);
    g.generateTexture("unknown-ring", 16, 16);
    g.destroy();
  }
  if (!scene.textures.exists("unknown-artifact")) {
    const g = scene.make.graphics(undefined, false);
    g.fillStyle(0x8b6fae, 1);
    g.fillTriangle(8, 1, 15, 8, 8, 15);
    g.fillTriangle(8, 1, 1, 8, 8, 15);
    g.generateTexture("unknown-artifact", 16, 16);
    g.destroy();
  }
  if (!scene.textures.exists("unknown-item")) {
    const g = scene.make.graphics(undefined, false);
    g.fillStyle(0x6a6a6a, 1);
    g.fillRect(5, 3, 6, 10);
    g.generateTexture("unknown-item", 16, 16);
    g.destroy();
  }
}

// Doors are drawn per dungeon region so a doorway reads differently as the
// hero descends: oak planks on floors 1-4, banded iron on 6-9, sandstone slab
// on 11-14, crystal on 16-19 and glowing basalt on 21-24. Panels are 21px tall
// (they reach the floor at local y=16 with a 5px wall-height rise); the open
// door style is a doorstep on the floor. Style textures are cached, so a run
// that never leaves the first region only ever builds the oak set.
export function generateDoorThresholdTexture(scene: Phaser.Scene): void {
  for (const style of DOOR_STYLES) {
    const keys = doorTextureKeys(style);
    // Front face (north–south passage) and narrow side panel (east–west
    // passage). The side art is drawn narrow rather than rotated, which would
    // put the handle and planks sideways.
    generateCachedTexture(scene, keys.front, 16, 21, g => drawDoorPanel(g, style, false));
    generateCachedTexture(scene, keys.side, 16, 21, g => drawDoorPanel(g, style, true));
    generateCachedTexture(scene, keys.threshold, 16, 16, g => drawDoorThreshold(g, style, false));
    generateCachedTexture(scene, keys.thresholdSide, 16, 16, g => drawDoorThreshold(g, style, true));
  }
}

const DOOR_STYLES: DoorStyle[] = ['wood', 'iron', 'stone-slab', 'crystal', 'basalt'];

function generateCachedTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics(undefined, false);
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
}

function drawDoorPanel(g: Phaser.GameObjects.Graphics, style: DoorStyle, side: boolean): void {
  if (side) {
    drawSideDoor(g, style);
    return;
  }
  switch (style) {
    case 'wood': {
      g.fillStyle(0x292b28, 1);
      g.fillRect(1, 0, 14, 21);
      g.fillStyle(0x73502d, 1);
      g.fillRect(2, 1, 12, 19);
      g.fillStyle(0x936b38, 1);
      for (const x of [3, 7, 11]) g.fillRect(x, 2, 2, 17);
      g.fillStyle(0x4a3525, 1);
      for (const x of [6, 10]) g.fillRect(x, 1, 1, 19);
      g.fillStyle(0x424640, 1);
      g.fillRect(2, 5, 12, 2);
      g.fillRect(2, 15, 12, 2);
      g.fillStyle(0xb69c60, 1);
      g.fillRect(11, 10, 2, 2);
      return;
    }
    case 'iron': {
      // Cold blue-grey iron plates under two riveted steel bands.
      g.fillStyle(0x1b2331, 1);
      g.fillRect(1, 0, 14, 21);
      g.fillStyle(0x455568, 1);
      g.fillRect(2, 1, 12, 19);
      g.fillStyle(0x55697f, 1);
      for (const x of [3, 7, 11]) g.fillRect(x, 2, 2, 17);
      g.fillStyle(0x33414f, 1);
      for (const x of [6, 10]) g.fillRect(x, 1, 1, 19);
      g.fillStyle(0x7a8fa8, 1);
      g.fillRect(2, 5, 12, 2);
      g.fillRect(2, 15, 12, 2);
      g.fillStyle(0xc3d3e0, 1);
      for (const y of [5, 15]) for (const x of [4, 8, 12]) g.fillRect(x, y, 1, 1);
      g.fillStyle(0xb9cad9, 1);
      g.fillRect(11, 10, 2, 2);
      return;
    }
    case 'stone-slab': {
      // Warm sandstone block with a lit lintel and carved grooves.
      g.fillStyle(0x3a2b1c, 1);
      g.fillRect(1, 0, 14, 21);
      g.fillStyle(0xa8855a, 1);
      g.fillRect(2, 1, 12, 19);
      g.fillStyle(0xc6a973, 1);
      g.fillRect(2, 1, 12, 2);
      g.fillStyle(0x8a6a43, 1);
      for (const x of [5, 10]) g.fillRect(x, 3, 1, 17);
      g.fillStyle(0x6d5233, 1);
      g.fillRect(2, 8, 12, 2);
      g.fillRect(2, 16, 12, 1);
      g.fillStyle(0xd8bd85, 1);
      g.fillRect(11, 11, 2, 2);
      return;
    }
    case 'crystal': {
      // Faceted violet crystal with bright edges and a couple of glints.
      g.fillStyle(0x2a2340, 1);
      g.fillRect(1, 0, 14, 21);
      g.fillStyle(0x6a5590, 1);
      g.fillRect(2, 1, 12, 19);
      g.fillStyle(0x8d76b5, 1);
      for (const x of [4, 8]) g.fillRect(x, 2, 2, 17);
      g.fillStyle(0xc9b6ea, 1);
      g.fillRect(6, 2, 1, 17);
      g.fillStyle(0x463a63, 1);
      g.fillRect(2, 6, 12, 1);
      g.fillRect(2, 14, 12, 1);
      g.fillStyle(0xe8dcff, 1);
      g.fillRect(12, 3, 1, 2);
      g.fillRect(3, 12, 1, 2);
      g.fillStyle(0xc0a6e4, 1);
      g.fillRect(11, 10, 2, 2);
      return;
    }
    case 'basalt': {
      // Black basalt with cooling cracks still glowing from within.
      g.fillStyle(0x1a1518, 1);
      g.fillRect(1, 0, 14, 21);
      g.fillStyle(0x453b40, 1);
      g.fillRect(2, 1, 12, 19);
      g.fillStyle(0x574c51, 1);
      for (const x of [3, 7, 11]) g.fillRect(x, 2, 2, 17);
      g.fillStyle(0x2a2327, 1);
      for (const x of [6, 10]) g.fillRect(x, 1, 1, 19);
      g.fillStyle(0x332a2e, 1);
      g.fillRect(2, 5, 12, 2);
      g.fillRect(2, 15, 12, 2);
      g.fillStyle(0xc23c22, 1);
      for (const [x, y] of [[4, 3], [5, 4], [5, 5], [4, 6], [4, 7], [9, 9], [10, 10], [10, 11], [9, 12]]) {
        g.fillRect(x, y, 1, 1);
      }
      g.fillStyle(0xffa04a, 1);
      g.fillRect(5, 5, 1, 1);
      g.fillRect(9, 12, 1, 1);
      g.fillStyle(0xff8a3d, 1);
      g.fillRect(11, 10, 2, 2);
      return;
    }
  }
}

function drawSideDoor(g: Phaser.GameObjects.Graphics, style: DoorStyle): void {
  const frame = {
    'wood': 0x292525,
    'iron': 0x1b2331,
    'stone-slab': 0x3a2b1c,
    'crystal': 0x2a2340,
    'basalt': 0x1a1518
  }[style];
  const panel = {
    'wood': 0x67401f,
    'iron': 0x455568,
    'stone-slab': 0xa8855a,
    'crystal': 0x6a5590,
    'basalt': 0x453b40
  }[style];
  const highlight = {
    'wood': 0xa17435,
    'iron': 0x7a8fa8,
    'stone-slab': 0xc6a973,
    'crystal': 0xc9b6ea,
    'basalt': 0x574c51
  }[style];
  const seam = {
    'wood': 0x402c1e,
    'iron': 0x33414f,
    'stone-slab': 0x6d5233,
    'crystal': 0x463a63,
    'basalt': 0x2a2327
  }[style];
  g.fillStyle(frame, 1);
  g.fillRect(5, 0, 6, 21);
  g.fillStyle(panel, 1);
  g.fillRect(6, 1, 4, 19);
  g.fillStyle(highlight, 1);
  g.fillRect(6, 2, 1, 17);
  g.fillStyle(seam, 1);
  g.fillRect(7, 4, 3, 1);
  g.fillRect(7, 16, 3, 1);
  if (style === 'iron') {
    g.fillStyle(0xc3d3e0, 1);
    g.fillRect(8, 10, 1, 1);
  } else if (style === 'crystal') {
    g.fillStyle(0xe8dcff, 1);
    g.fillRect(8, 8, 1, 2);
  } else if (style === 'basalt') {
    g.fillStyle(0xc23c22, 1);
    g.fillRect(8, 9, 1, 2);
    g.fillStyle(0xffa04a, 1);
    g.fillRect(8, 10, 1, 1);
  }
}

function drawDoorThreshold(g: Phaser.GameObjects.Graphics, style: DoorStyle, side: boolean): void {
  const accent = {
    'wood': 0x8a5a2b,
    'iron': 0x7a8fa8,
    'stone-slab': 0xa8855a,
    'crystal': 0x9c86c6,
    'basalt': 0x8a3b2a
  }[style];
  if (style === 'stone-slab') {
    // A worn stone sill instead of a dotted timber doorstep.
    g.fillStyle(0x6d5233, 1);
    if (side) g.fillRect(6, 1, 4, 14);
    else g.fillRect(1, 11, 14, 4);
    g.fillStyle(accent, 1);
    if (side) g.fillRect(7, 1, 2, 13);
    else g.fillRect(1, 12, 14, 2);
    g.fillStyle(0xc6a973, 1);
    if (side) g.fillRect(7, 4, 2, 1);
    else g.fillRect(4, 12, 2, 1);
    return;
  }
  g.fillStyle(accent, 1);
  if (side) {
    for (let y = 1; y <= 13; y += 3) g.fillRect(7, y, 2, 2);
  } else {
    for (let x = 1; x <= 13; x += 3) g.fillRect(x, 12, 2, 2);
  }
  // A single bright glint keeps the iron, crystal and basalt sills distinct
  // from the plain timber dots without changing the footprint.
  const glint = { 'wood': undefined, 'iron': 0xc3d3e0, 'stone-slab': undefined, 'crystal': 0xe8dcff, 'basalt': 0xffa04a }[style];
  if (glint !== undefined) {
    g.fillStyle(glint, 1);
    if (side) g.fillRect(8, 7, 1, 1);
    else g.fillRect(7, 12, 1, 1);
  }
}

// Draws a 16x16 round-bottom flask: cork, glass neck + bulb, colored liquid,
// a dark outline, and a glass shine.
function drawFlask(g: Phaser.GameObjects.Graphics, liquid: number): void {
  // Cork.
  g.fillStyle(0x8a5a2b, 1);
  g.fillRect(6, 0, 4, 2);

  // Glass neck + bulb (light, translucent blue-gray).
  g.fillStyle(0xdceaf2, 1);
  g.fillRect(6, 2, 4, 2);
  g.fillCircle(8, 9, 6);

  // Colored liquid inside the bulb.
  g.fillStyle(liquid, 1);
  g.fillCircle(8, 10, 4);

  // Outline for definition.
  g.lineStyle(1, 0x5a707e, 1);
  g.strokeCircle(8, 9, 6);
  g.strokeRect(6, 2, 4, 2);

  // Shine highlight.
  g.fillStyle(0xffffff, 0.55);
  g.fillRect(6, 7, 2, 3);
}
