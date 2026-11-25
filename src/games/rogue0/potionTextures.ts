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

// Doors keep their regional silhouettes, but use contrasting colors rather
// than copying the walls: amber / copper / teal / gold / icy cyan. Panels are
// 21px tall (floor at local y=16 plus a 5px wall-height rise); open doors leave
// a matching doorstep. All five sets are generated once and cached.
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

// One palette feeds front panels, side panels and open thresholds so the
// doorway stays recognizable in either orientation/state. Dark outlines keep
// the bright faces readable even against the lightest wall highlights.
const DOOR_PALETTES = {
  wood: {
    frame: 0x382517, panel: 0xc18335, highlight: 0xefb95b, seam: 0x795022,
    band: 0x634326, glint: 0xffe2a0, handle: 0xffe2a0, accent: 0xefb95b,
    facet: 0xffd485, crack: 0xefb95b
  },
  iron: {
    frame: 0x40241c, panel: 0xc8794d, highlight: 0xefa673, seam: 0x81462f,
    band: 0xe9a16b, glint: 0xffdfac, handle: 0xffdfac, accent: 0xefa673,
    facet: 0xffdfac, crack: 0xefa673
  },
  'stone-slab': {
    frame: 0x123b3c, panel: 0x389f9f, highlight: 0x7ee0ce, seam: 0x216463,
    band: 0x226b70, glint: 0xc4fff0, handle: 0xc4fff0, accent: 0x62ccbf,
    facet: 0x7ee0ce, crack: 0x7ee0ce
  },
  crystal: {
    frame: 0x44321a, panel: 0xd5ad45, highlight: 0xf5d778, seam: 0x8b682c,
    band: 0x8b682c, glint: 0xfff4c5, handle: 0xfff4c5, accent: 0xf5d778,
    facet: 0xffe9a3, crack: 0xf5d778
  },
  basalt: {
    frame: 0x173743, panel: 0x68b6c9, highlight: 0xa1e2eb, seam: 0x366f84,
    band: 0x3e7e91, glint: 0xe2ffff, handle: 0xe2ffff, accent: 0xa1e2eb,
    facet: 0xa1e2eb, crack: 0xb7f6ff
  }
} satisfies Record<DoorStyle, Record<'frame' | 'panel' | 'highlight' | 'seam' | 'band' | 'glint' | 'handle' | 'accent' | 'facet' | 'crack', number>>;

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
  const palette = DOOR_PALETTES[style];
  switch (style) {
    case 'wood': {
      g.fillStyle(palette.frame, 1);
      g.fillRect(1, 0, 14, 21);
      g.fillStyle(palette.panel, 1);
      g.fillRect(2, 1, 12, 19);
      g.fillStyle(palette.highlight, 1);
      for (const x of [3, 7, 11]) g.fillRect(x, 2, 2, 17);
      g.fillStyle(palette.seam, 1);
      for (const x of [6, 10]) g.fillRect(x, 1, 1, 19);
      g.fillStyle(palette.band, 1);
      g.fillRect(2, 5, 12, 2);
      g.fillRect(2, 15, 12, 2);
      g.fillStyle(palette.handle, 1);
      g.fillRect(11, 10, 2, 2);
      return;
    }
    case 'iron': {
      // Copper-clad iron contrasts with the crypt's cold blue walls.
      g.fillStyle(palette.frame, 1);
      g.fillRect(1, 0, 14, 21);
      g.fillStyle(palette.panel, 1);
      g.fillRect(2, 1, 12, 19);
      g.fillStyle(palette.highlight, 1);
      for (const x of [3, 7, 11]) g.fillRect(x, 2, 2, 17);
      g.fillStyle(palette.seam, 1);
      for (const x of [6, 10]) g.fillRect(x, 1, 1, 19);
      g.fillStyle(palette.band, 1);
      g.fillRect(2, 5, 12, 2);
      g.fillRect(2, 15, 12, 2);
      g.fillStyle(palette.glint, 1);
      for (const y of [5, 15]) for (const x of [4, 8, 12]) g.fillRect(x, y, 1, 1);
      g.fillStyle(palette.handle, 1);
      g.fillRect(11, 10, 2, 2);
      return;
    }
    case 'stone-slab': {
      // Teal stone with a lit lintel stands apart from warm sandstone.
      g.fillStyle(palette.frame, 1);
      g.fillRect(1, 0, 14, 21);
      g.fillStyle(palette.panel, 1);
      g.fillRect(2, 1, 12, 19);
      g.fillStyle(palette.highlight, 1);
      g.fillRect(2, 1, 12, 2);
      g.fillStyle(palette.seam, 1);
      for (const x of [5, 10]) g.fillRect(x, 3, 1, 17);
      g.fillStyle(palette.band, 1);
      g.fillRect(2, 8, 12, 2);
      g.fillRect(2, 16, 12, 1);
      g.fillStyle(palette.handle, 1);
      g.fillRect(11, 11, 2, 2);
      return;
    }
    case 'crystal': {
      // Golden crystal facets contrast with the region's violet walls.
      g.fillStyle(palette.frame, 1);
      g.fillRect(1, 0, 14, 21);
      g.fillStyle(palette.panel, 1);
      g.fillRect(2, 1, 12, 19);
      g.fillStyle(palette.highlight, 1);
      for (const x of [4, 8]) g.fillRect(x, 2, 2, 17);
      g.fillStyle(palette.facet, 1);
      g.fillRect(6, 2, 1, 17);
      g.fillStyle(palette.band, 1);
      g.fillRect(2, 6, 12, 1);
      g.fillRect(2, 14, 12, 1);
      g.fillStyle(palette.glint, 1);
      g.fillRect(12, 3, 1, 2);
      g.fillRect(3, 12, 1, 2);
      g.fillStyle(palette.handle, 1);
      g.fillRect(11, 10, 2, 2);
      return;
    }
    case 'basalt': {
      // Frost-blue mineral coating and luminous cracks against dark lava rock.
      g.fillStyle(palette.frame, 1);
      g.fillRect(1, 0, 14, 21);
      g.fillStyle(palette.panel, 1);
      g.fillRect(2, 1, 12, 19);
      g.fillStyle(palette.highlight, 1);
      for (const x of [3, 7, 11]) g.fillRect(x, 2, 2, 17);
      g.fillStyle(palette.seam, 1);
      for (const x of [6, 10]) g.fillRect(x, 1, 1, 19);
      g.fillStyle(palette.band, 1);
      g.fillRect(2, 5, 12, 2);
      g.fillRect(2, 15, 12, 2);
      g.fillStyle(palette.crack, 1);
      for (const [x, y] of [[4, 3], [5, 4], [5, 5], [4, 6], [4, 7], [9, 9], [10, 10], [10, 11], [9, 12]]) {
        g.fillRect(x, y, 1, 1);
      }
      g.fillStyle(palette.glint, 1);
      g.fillRect(5, 5, 1, 1);
      g.fillRect(9, 12, 1, 1);
      g.fillStyle(palette.handle, 1);
      g.fillRect(11, 10, 2, 2);
      return;
    }
  }
}

function drawSideDoor(g: Phaser.GameObjects.Graphics, style: DoorStyle): void {
  const { frame, panel, highlight, seam, glint, crack } = DOOR_PALETTES[style];
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
    g.fillStyle(glint, 1);
    g.fillRect(8, 10, 1, 1);
  } else if (style === 'crystal') {
    g.fillStyle(glint, 1);
    g.fillRect(8, 8, 1, 2);
  } else if (style === 'basalt') {
    g.fillStyle(crack, 1);
    g.fillRect(8, 9, 1, 2);
    g.fillStyle(glint, 1);
    g.fillRect(8, 10, 1, 1);
  }
}

function drawDoorThreshold(g: Phaser.GameObjects.Graphics, style: DoorStyle, side: boolean): void {
  const { accent, seam, highlight, glint } = DOOR_PALETTES[style];
  if (style === 'stone-slab') {
    // A worn stone sill instead of a dotted timber doorstep.
    g.fillStyle(seam, 1);
    if (side) g.fillRect(6, 1, 4, 14);
    else g.fillRect(1, 11, 14, 4);
    g.fillStyle(accent, 1);
    if (side) g.fillRect(7, 1, 2, 13);
    else g.fillRect(1, 12, 14, 2);
    g.fillStyle(highlight, 1);
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
  if (style !== 'wood') {
    g.fillStyle(glint, 1);
    if (side) g.fillRect(8, 7, 1, 1);
    else g.fillRect(7, 12, 1, 1);
  }
}

// Draws a 16x16 round-bottom flask: cork, glass neck + bulb, colored liquid,
// a dark outline, and a glass shine.
export function drawFlask(g: Phaser.GameObjects.Graphics, liquid: number): void {
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
