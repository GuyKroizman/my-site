import type Phaser from 'phaser';
import { FIRE_ELEMENTAL_PIXELS, FIRE_ELEMENTAL_PALETTE } from './monsters/fireElementalTexture.ts';

// Native-resolution pixel art only. No gameplay RNG, map edits or simulation time.
export const FACTORY_ASSEMBLER_TEXTURE = 'factory-assembler';
export const FACTORY_DISTILLER_TEXTURE = 'factory-distiller';
export const FACTORY_BELT_TEXTURE = 'factory-belt';
export const FACTORY_CRATE_TEXTURE = 'factory-crate';
export const FACTORY_WAND_TEXTURE = 'wand-fire';
export const FACTORY_FRAMES = 16;
export const FACTORY_BELT_TILES = 3;
export const FACTORY_MACHINE_WIDTH_TILES = 5;
export const FACTORY_MACHINE_HEIGHT_TILES = 3;
export type FactoryMachine = 'assembler' | 'distiller';

const C = {
  outline: 0x181923, shadow: 0x302b32, iron: 0x41454b, steel: 0x727b7c,
  brassDark: 0x725033, brass: 0xba8746, gold: 0xe3b969, light: 0xffe0a0,
  copperDark: 0x713b30, copper: 0xb7613c, copperLight: 0xec9860,
  glassDark: 0x233f46, glass: 0x518b8e, shine: 0xb2e3d5,
  flame: 0xf4742c, hot: 0xffcd64, ember: 0x9d3426,
  wood: 0x805034, woodLight: 0xb78049, steam: 0x91aaa7
};

/** Shared by the renderer and pixel-art previews/tests. -1 is transparent. */
export function factoryMachinePixels(kind: FactoryMachine, frame: number): number[][] {
  const width = kind === 'assembler' ? 80 : 64;
  const height = kind === 'assembler' ? 48 : 64;
  const pixels = Array.from({ length: height }, () => Array<number>(width).fill(-1));
  const rect = (x: number, y: number, w: number, h: number, color: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (pixels[yy]?.[xx] !== undefined) pixels[yy][xx] = color;
    }
  };
  const line = (x: number, y: number, xx: number, yy: number, color: number) => {
    const steps = Math.max(Math.abs(xx - x), Math.abs(yy - y), 1);
    for (let i = 0; i <= steps; i++) {
      rect(Math.round(x + (xx - x) * i / steps), Math.round(y + (yy - y) * i / steps), 1, 1, color);
    }
  };
  const panel = (x: number, y: number, w: number, h: number) => {
    rect(x, y, w, h, C.outline);
    rect(x + 1, y + 1, w - 2, h - 2, C.brassDark);
    rect(x + 2, y + 2, w - 4, h - 4, C.iron);
    rect(x + 2, y + 1, w - 4, 1, C.gold);
    for (const xx of [x + 2, x + w - 3]) for (const yy of [y + 2, y + h - 3]) {
      rect(xx, yy, 1, 1, C.light);
      rect(xx, yy + 1, 1, 1, C.shadow);
    }
  };
  const pipe = (x: number, y: number, w: number, h: number) => {
    rect(x, y, w, h, C.outline);
    rect(x + 1, y + 1, w - 2, h - 2, C.copper);
    if (w > h) rect(x + 1, y + 1, w - 2, 1, C.copperLight);
    else rect(x + 1, y + 1, 1, h - 2, C.copperLight);
  };
  const disc = (x: number, y: number, r: number, color: number) => {
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
      if (xx * xx + yy * yy <= r * r + 1) rect(x + xx, y + yy, 1, 1, color);
    }
  };
  const gear = (x: number, y: number, r: number, direction = 1) => {
    const angle = direction * frame * Math.PI / 16;
    for (let tooth = 0; tooth < 8; tooth++) {
      const a = tooth * Math.PI / 4 + angle;
      const xx = x + Math.round(Math.cos(a) * r), yy = y + Math.round(Math.sin(a) * r);
      rect(xx - 1, yy - 1, 3, 3, C.brassDark);
      rect(xx - 1, yy - 1, 2, 2, C.gold);
    }
    disc(x, y, r - 1, C.brass);
    disc(x, y, r - 3, C.shadow);
    for (let spoke = 0; spoke < 4; spoke++) {
      const a = spoke * Math.PI / 2 + angle;
      line(x, y, x + Math.round(Math.cos(a) * (r - 2)), y + Math.round(Math.sin(a) * (r - 2)), C.gold);
    }
    disc(x, y, 1, C.steel);
    rect(x, y, 1, 1, C.light);
  };
  const gauge = (x: number, y: number, phase: number) => {
    disc(x, y, 6, C.outline); disc(x, y, 5, C.brass);
    disc(x, y, 4, C.light);
    for (const [dx, dy] of [[-3, 0], [0, -3], [3, 0], [0, 3]]) rect(x + dx, y + dy, 1, 1, C.brassDark);
    const a = -Math.PI + (frame / 16 + phase) * Math.PI * 2;
    line(x, y, x + Math.round(Math.cos(a) * 3), y + Math.round(Math.sin(a) * 3), C.copperDark);
    rect(x, y, 1, 1, C.outline);
  };
  const steam = (x: number, y: number, phase: number) => {
    for (let i = 0; i < 3; i++) {
      const step = (frame + phase + i * 5) % 16;
      const xx = x + Math.round(Math.sin(step * 0.6) * 2);
      rect(xx, y - Math.floor(step / 2), 2 + Math.floor(step / 6), 1, C.steam);
      if (step < 10) rect(xx - 1, y - Math.floor(step / 2) - 1, 2, 1, C.glass);
    }
  };

  if (kind === 'assembler') {
    // One connected iron chassis, rather than a collection of floating icons.
    panel(12, 9, 67, 35);
    rect(16, 12, 59, 17, C.shadow);
    pipe(19, 7, 48, 5); pipe(64, 8, 5, 17);
    pipe(73, 8, 5, 22); rect(72, 7, 7, 3, C.brass);
    steam(74, 6, 0);
    gear(22, 21, 7); gear(33, 23, 5, -1);
    gauge(43, 17, 0); gauge(57, 17, 0.25);
    // Reciprocating stamping head, with steel guide rails and a copper ram.
    rect(61, 22, 2, 12, C.steel); rect(72, 22, 2, 12, C.steel);
    const stroke = [0, 1, 2, 3, 5, 5, 3, 1][frame % 8];
    pipe(65, 19, 5, 8 + stroke);
    panel(62, 26 + stroke, 11, 4);
    rect(65, 29 + stroke, 5, 1, C.copperLight);
    if (stroke === 5) {
      rect(60, 33, 1, 1, C.hot); rect(75, 32, 1, 1, C.light);
    }
    // Conveyor aperture and bolted legs. The moving belt sits in this opening.
    rect(15, 34, 60, 7, C.outline);
    for (const x of [16, 70]) { panel(x, 40, 7, 7); rect(x - 1, 46, 9, 2, C.outline); }
    rect(39, 42, 19, 3, C.brassDark);
    for (let x = 41; x < 57; x += 3) rect(x, 42, 1, 2, C.gold);
    // An inset wand blueprint / feed hopper identifies the machine at a glance.
    panel(1, 11, 11, 17); rect(3, 14, 7, 10, C.glassDark);
    line(4, 22, 8, 16, C.gold); rect(7, 15, 2, 2, C.hot);
    pipe(8, 28, 8, 5);
  } else {
    // Boiler on the left, coiled condenser on the right, connected to a nozzle.
    panel(3, 50, 58, 9);
    for (const x of [6, 53]) { rect(x, 59, 5, 3, C.iron); rect(x - 1, 62, 7, 2, C.outline); }
    pipe(7, 12, 6, 16); rect(6, 11, 8, 3, C.brass);
    steam(9, 9, 4);
    pipe(23, 12, 28, 5); pipe(47, 14, 5, 25);
    // Tall rounded copper pressure vessel with bright bands and a dark edge.
    rect(5, 24, 27, 25, C.outline); rect(8, 21, 21, 31, C.outline);
    rect(7, 25, 23, 23, C.copperDark); rect(9, 23, 19, 27, C.copper);
    rect(10, 25, 2, 22, C.copperLight); rect(26, 25, 2, 24, C.copperDark);
    for (const y of [24, 46]) {
      rect(6, y, 25, 3, C.brassDark); rect(7, y, 23, 1, C.gold);
      for (const x of [8, 15, 23, 28]) rect(x, y + 1, 1, 1, C.light);
    }
    gauge(19, 21, 0.6);
    // The existing fire elemental is now actually enclosed behind furnace bars.
    panel(10, 29, 18, 17); rect(12, 31, 14, 13, C.outline);
    FIRE_ELEMENTAL_PIXELS.forEach((row, y) => [...row].forEach((pixel, x) => {
      const color = FIRE_ELEMENTAL_PALETTE[pixel];
      if (color !== undefined && y > 2) rect(11 + x, 28 + y, 1, 1, color);
    }));
    rect(17 + frame % 3, 32, 2, 2, frame % 2 ? C.hot : C.flame);
    for (const x of [14, 20, 25]) { rect(x, 30, 1, 15, C.shadow); rect(x + 1, 31, 1, 13, C.brassDark); }
    // Glass condenser, alternating copper coil runs, and a small valve wheel.
    panel(36, 19, 22, 23); rect(39, 22, 16, 17, C.glassDark);
    rect(40, 23, 2, 15, C.glass); rect(43, 22, 1, 16, C.shine);
    for (let y = 23; y < 39; y += 5) {
      pipe(38, y, 19, 4); rect(54, y + 2, 3, 4, C.copperDark);
    }
    gear(34, 44, 4, -1);
    pipe(47, 39, 5, 6); rect(46, 43, 7, 2, C.brass);
    // A small, recognisable glass flask fills, then resets empty each cycle.
    const drop = frame % 4;
    if (frame < 13) { rect(49, 46 + drop, 1, 2, C.flame); rect(49, 46 + drop, 1, 1, C.hot); }
    rect(46, 49, 7, 2, C.shine); rect(46, 51, 1, 3, C.glass);
    rect(52, 51, 1, 3, C.glass); rect(44, 54, 2, 5, C.glass);
    rect(53, 54, 2, 5, C.glass); rect(46, 59, 7, 1, C.shine);
    rect(46, 54, 7, 5, C.glassDark);
    const fill = frame < 14 ? Math.floor(frame / 3) : 0;
    if (fill) { rect(46, 59 - fill, 7, fill, C.flame); rect(46, 59 - fill, 7, 1, C.hot); }
    rect(46, 54, 1, 4, C.shine); rect(52, 55, 1, 3, C.glass);
    // Boiler vents and small bolts on the iron plinth.
    for (let x = 9; x < 29; x += 4) rect(x, 53, 2, 3, C.outline);
  }
  return pixels;
}

export function factoryMachineFrame(clock: number): number {
  return Math.floor(clock / 180) % FACTORY_FRAMES;
}
export function factoryBeltOffset(clock: number): number {
  return 16 + Math.floor(clock / 56) % 16;
}
export function factoryWandProgress(clock: number, index: number): number {
  return ((clock / 6600) + index / 3) % 1;
}

export function generateWandFactoryTextures(scene: Phaser.Scene): void {
  for (const kind of ['assembler', 'distiller'] as const) {
    const key = kind === 'assembler' ? FACTORY_ASSEMBLER_TEXTURE : FACTORY_DISTILLER_TEXTURE;
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics(undefined, false);
    const width = kind === 'assembler' ? 80 : 64, height = kind === 'assembler' ? 48 : 64;
    for (let frame = 0; frame < FACTORY_FRAMES; frame++) {
      factoryMachinePixels(kind, frame).forEach((row, y) => row.forEach((color, x) => {
        if (color < 0) return;
        g.fillStyle(color, 1); g.fillRect(frame * width + x, y, 1, 1);
      }));
    }
    g.generateTexture(key, width * FACTORY_FRAMES, height); g.destroy();
    const texture = scene.textures.get(key);
    // Tile-sized atlas frames keep fog clipping exact, without WebGL masks.
    for (let frame = 0; frame < FACTORY_FRAMES; frame++) {
      for (let y = 0; y < height / 16; y++) for (let x = 0; x < width / 16; x++) {
        texture.add(`${frame}:${x}:${y}`, 0, frame * width + x * 16, y * 16, 16, 16);
      }
    }
  }
  if (!scene.textures.exists(FACTORY_BELT_TEXTURE)) {
    const g = scene.make.graphics(undefined, false);
    g.fillStyle(C.outline); g.fillRect(0, 0, 16, 6);
    g.fillStyle(C.steel); g.fillRect(0, 0, 16, 1);
    g.fillStyle(C.brassDark); g.fillRect(0, 5, 16, 1);
    for (let x = 0; x < 16; x += 4) {
      g.fillStyle(C.iron); g.fillRect(x, 1, 3, 3);
      g.fillStyle(C.brass); g.fillRect(x, 4, 2, 1);
    }
    g.generateTexture(FACTORY_BELT_TEXTURE, 16, 6); g.destroy();
  }
  if (!scene.textures.exists(FACTORY_CRATE_TEXTURE)) {
    const g = scene.make.graphics(undefined, false);
    g.fillStyle(C.outline); g.fillRect(0, 1, 16, 14);
    g.fillStyle(C.wood); g.fillRect(1, 2, 14, 12);
    g.fillStyle(C.shadow); g.fillRect(2, 2, 12, 4);
    g.fillStyle(C.woodLight);
    for (const y of [1, 7, 12]) g.fillRect(1, y, 14, 1);
    for (const x of [2, 13]) g.fillRect(x, 6, 1, 7);
    g.fillStyle(C.brass);
    for (const x of [1, 14]) for (const y of [7, 12]) g.fillRect(x, y, 1, 1);
    g.generateTexture(FACTORY_CRATE_TEXTURE, 16, 16); g.destroy();
  }
}

export type FactoryHall = { x: number; y: number; w: number; h: number };
type Watch = { sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.TileSprite };
type FactoryVisuals = {
  objects: Phaser.GameObjects.GameObject[];
  belts: Phaser.GameObjects.TileSprite[];
  wands: Phaser.GameObjects.Sprite[];
  tiles: Array<{ sprite: Phaser.GameObjects.Sprite; x: number; y: number }>;
  watches: Watch[];
  map: Phaser.Tilemaps.Tilemap;
  beltX: number; beltY: number;
  clock: number; lastTime: number;
};
const states = new WeakMap<Phaser.Scene, FactoryVisuals>();

export function createWandFactoryVisuals(
  scene: Phaser.Scene, hall: FactoryHall | undefined, map: Phaser.Tilemaps.Tilemap | undefined
): void {
  clearWandFactoryVisuals(scene);
  if (!hall || !map) return;
  generateWandFactoryTextures(scene);
  const wx = (x: number) => map.tileToWorldX(hall.x + x)!;
  const wy = (y: number) => map.tileToWorldY(hall.y + y)!;
  const objects: FactoryVisuals['objects'] = [], watches: Watch[] = [];
  const tiles: FactoryVisuals['tiles'] = [];
  const track = <T extends Watch['sprite']>(sprite: T): T => {
    objects.push(sprite); watches.push({ sprite }); return sprite;
  };
  for (const [key, left, top, cols, rows] of [
    [FACTORY_DISTILLER_TEXTURE, 1, 1, 4, 4],
    [FACTORY_ASSEMBLER_TEXTURE, 8, 1, 5, 3]
  ] as const) {
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const sprite = track(scene.add.sprite(wx(left + x), wy(top + y), key, `0:${x}:${y}`)
        .setOrigin(0, 0).setDepth(20));
      tiles.push({ sprite, x, y });
    }
  }
  const beltX = wx(9), beltY = wy(1) + 34;
  // Separate belt tiles avoid revealing the whole conveyor through a single visible cell.
  const belts = Array.from({ length: FACTORY_BELT_TILES }, (_, i) => track(
    scene.add.tileSprite(beltX + i * 16, beltY, 16, 6, FACTORY_BELT_TEXTURE)
      .setOrigin(0, 0).setDepth(21)));
  track(scene.add.sprite(wx(8), wy(4), FACTORY_CRATE_TEXTURE).setOrigin(0, 0).setDepth(23));
  const wands = [0, 1, 2].map(() => track(
    scene.add.sprite(beltX, beltY, FACTORY_WAND_TEXTURE).setOrigin(0.5, 0.5).setDepth(22)));
  states.set(scene, { objects, belts, wands, tiles, watches, map, beltX, beltY, clock: 0, lastTime: -1 });
  updateWandFactoryVisuals(scene, 0, true);
  // Don't count time since scene start as animation time on first update.
  states.get(scene)!.lastTime = -1;
}

export function updateWandFactoryVisuals(
  scene: Phaser.Scene, now: number, paused: boolean, visibleTiles?: ReadonlySet<string>
): void {
  const state = states.get(scene);
  if (!state) return;
  if (state.lastTime < 0) state.lastTime = now;
  state.clock += paused ? 0 : Math.max(0, now - state.lastTime);
  state.lastTime = now;
  for (const belt of state.belts) belt.tilePositionX = factoryBeltOffset(state.clock);
  const frame = factoryMachineFrame(state.clock);
  for (const tile of state.tiles) tile.sprite.setFrame(`${frame}:${tile.x}:${tile.y}`);
  state.wands.forEach((sprite, index) => {
    const progress = factoryWandProgress(state.clock, index);
    const travel = Math.min(progress / 0.8, 1), fall = Math.max(0, (progress - 0.8) / 0.2);
    sprite.x = Math.round(state.beltX + 40 - travel * 40 - fall * 8);
    sprite.y = Math.round(state.beltY - 1 + fall * 20);
    sprite.setAlpha(fall > 0.75 ? (1 - fall) * 4 : 1);
  });
  for (const { sprite } of state.watches) {
    // Moving wands use their current tile, not their original spawn point.
    const x = state.map.worldToTileX(sprite.x), y = state.map.worldToTileY(sprite.y);
    sprite.setVisible(!visibleTiles || visibleTiles.has(`${x},${y}`));
  }
}

export function clearWandFactoryVisuals(scene: Phaser.Scene): void {
  const state = states.get(scene);
  if (!state) return;
  for (const object of state.objects) object.destroy();
  states.delete(scene);
}
