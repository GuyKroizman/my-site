import type Phaser from "phaser";
import { FIRE_ELEMENTAL_TEXTURE, generateFireElementalTexture } from './monsters/fireElementalTexture.ts';

// Pure presentation for the two Wand Factory machines. Nothing here touches
// the map, path grids, FOV, gameplay RNG or context.simulationTime.
export const FACTORY_CABINET_TEXTURE = 'factory-cabinet';
export const FACTORY_BELT_TEXTURE = 'factory-belt';
export const FACTORY_CRATE_TEXTURE = 'factory-crate';
export const FACTORY_BOTTLE_TEXTURE = 'factory-bottle';
export const FACTORY_PIPE_TEXTURE = 'factory-pipe';
export const FACTORY_CLOCK_TEXTURE = 'factory-clock';
export const FACTORY_CLOCK_HAND_TEXTURE = 'factory-clock-hand';
export const FACTORY_DROP_TEXTURE = (frame: number) => `factory-drop-${frame}`;
export const FACTORY_WAND_TEXTURE = 'wand-fire';
export const FACTORY_DROP_FRAMES = 4;
// A three-tile belt inside a 5x3 clockwork machine, crossed from right to left.
export const FACTORY_BELT_TILES = 3;
export const FACTORY_MACHINE_WIDTH_TILES = 5;
export const FACTORY_MACHINE_HEIGHT_TILES = 3;

const PALETTE: Record<string, number> = {
  b: 0xb08d57, // riveted brass
  c: 0xc9713a, // copper
  w: 0xffe6a8, // highlight / wood
  g: 0x9bd6d6, // gauge glass
  f: 0xff8a2b, // liquid flame
  d: 0x6b3a1f, // dark wood
  k: 0x2c2a38 // shadow
};

const CABINET_ROWS = [
  '................',
  '...bbbbbbbbbb...',
  '..bccccccccccb..',
  '..bcwwccwwcccb..',
  '..bcggccggcccb..',
  '..bccccccccccb..',
  '..bcbbbbbbbbcb..',
  '..bccbbbbbbccb..',
  '..bccccccccccb..',
  '..bcffffffcccb..',
  '..bcffffffcccb..',
  '..bccccccccccb..',
  '..bbbbbbbbbbbb..',
  '..bkkkkkkkkkkb..',
  '...kk......kk...',
  '................'
];

const BOTTLE_ROWS = [
  '..gggg..',
  '..g..g..',
  '..g..g..',
  '..g..g..',
  '.g....g.',
  '.g....g.',
  '.g....g.',
  '.g....g.',
  '.g....g.',
  '..gggg..',
  '........',
  '........'
];

const DROP_ROWS: ReadonlyArray<ReadonlyArray<string>> = [
  ['...f...', '...f...', '..fff..', '..fff..', '...f...', '.......', '.......', '.......'],
  ['...f...', '..fff..', '..fwf..', '.fffff.', '.fffff.', '..fff..', '...f...', '.......'],
  ['...f...', '..fwf..', '.fffff.', 'fffffff', 'fffffff', '.fffff.', '..fff..', '...f...'],
  ['.......', '..f.f..', '.fffff.', 'fffffff', '.fffff.', '..f.f..', '.......', '.......']
];

function drawRows(g: Phaser.GameObjects.Graphics, rows: readonly string[]): void {
  rows.forEach((row, y) => [...row].forEach((pixel, x) => {
    const color = PALETTE[pixel];
    if (color === undefined) return;
    g.fillStyle(color, 1);
    g.fillRect(x, y, 1, 1);
  }));
}

export function generateWandFactoryTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(FACTORY_CABINET_TEXTURE)) {
    const g = scene.make.graphics(undefined, false);
    drawRows(g, CABINET_ROWS);
    g.generateTexture(FACTORY_CABINET_TEXTURE, 16, 16);
    g.destroy();
  }
  if (!scene.textures.exists(FACTORY_BOTTLE_TEXTURE)) {
    const g = scene.make.graphics(undefined, false);
    drawRows(g, BOTTLE_ROWS);
    g.generateTexture(FACTORY_BOTTLE_TEXTURE, 8, 12);
    g.destroy();
  }
  if (!scene.textures.exists(FACTORY_CRATE_TEXTURE)) {
    const g = scene.make.graphics(undefined, false);
    g.fillStyle(PALETTE.d, 1);
    g.fillRect(0, 0, 16, 12);
    g.fillStyle(PALETTE.w, 1);
    g.fillRect(1, 1, 14, 10);
    g.fillStyle(PALETTE.d, 1);
    g.fillRect(2, 2, 12, 8);
    g.fillStyle(PALETTE.w, 1);
    g.fillRect(3, 3, 10, 6);
    g.generateTexture(FACTORY_CRATE_TEXTURE, 16, 12);
    g.destroy();
  }
  if (!scene.textures.exists(FACTORY_BELT_TEXTURE)) {
    const g = scene.make.graphics(undefined, false);
    g.fillStyle(PALETTE.k, 1);
    g.fillRect(0, 0, 16, 8);
    g.fillStyle(PALETTE.b, 1);
    g.fillRect(0, 0, 16, 2);
    g.fillRect(0, 6, 16, 2);
    g.fillStyle(PALETTE.c, 1);
    for (let x = 1; x < 16; x += 4) g.fillRect(x, 2, 2, 4);
    g.generateTexture(FACTORY_BELT_TEXTURE, 16, 8);
    g.destroy();
  }
  if (!scene.textures.exists(FACTORY_PIPE_TEXTURE)) {
    const g = scene.make.graphics(undefined, false);
    g.fillStyle(PALETTE.c, 1);
    g.fillRect(0, 2, 8, 4);
    g.fillStyle(PALETTE.f, 1);
    g.fillRect(1, 3, 6, 2);
    g.generateTexture(FACTORY_PIPE_TEXTURE, 8, 8);
    g.destroy();
  }
  if (!scene.textures.exists(FACTORY_CLOCK_TEXTURE)) {
    const g = scene.make.graphics(undefined, false);
    g.fillStyle(PALETTE.b, 1);
    g.fillRect(1, 0, 6, 8);
    g.fillRect(0, 1, 8, 6);
    g.fillStyle(PALETTE.w, 1);
    g.fillRect(2, 1, 4, 6);
    g.fillRect(1, 2, 6, 4);
    g.fillStyle(PALETTE.k, 1);
    g.fillRect(3, 3, 2, 2);
    g.generateTexture(FACTORY_CLOCK_TEXTURE, 8, 8);
    g.destroy();
  }
  if (!scene.textures.exists(FACTORY_CLOCK_HAND_TEXTURE)) {
    const g = scene.make.graphics(undefined, false);
    g.fillStyle(PALETTE.d, 1);
    g.fillRect(0, 0, 1, 4);
    g.generateTexture(FACTORY_CLOCK_HAND_TEXTURE, 1, 4);
    g.destroy();
  }
  generateFireElementalTexture(scene);
  for (let frame = 0; frame < FACTORY_DROP_FRAMES; frame++) {
    const key = FACTORY_DROP_TEXTURE(frame);
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics(undefined, false);
    drawRows(g, DROP_ROWS[frame]);
    g.generateTexture(key, 7, 8);
    g.destroy();
  }
}

/** Presentation-only selectors (no RNG, no world clock writes). */
export function factoryDropFrame(clock: number, index = 0): number {
  return (Math.floor(clock / 140) + index) % FACTORY_DROP_FRAMES;
}

export function factoryBeltOffset(clock: number): number {
  // Half the previous scroll rate; always positive so WebGL UVs stay stable.
  return 16 + (clock / 56) % 16;
}

// One full trip from assembler to crate takes 6.6 seconds: half the previous
// 3.3-second crossing, matching the slower belt.
export function factoryWandProgress(clock: number, index: number): number {
  return ((clock / 6600) + index / 3) % 1;
}

export function factoryClockAngle(clock: number, index = 0): number {
  return (clock / 900 + index * Math.PI) % (Math.PI * 2);
}

export type FactoryHall = { x: number; y: number; w: number; h: number };

type FactoryVisuals = {
  objects: Phaser.GameObjects.GameObject[];
  belt: Phaser.GameObjects.TileSprite;
  wands: Phaser.GameObjects.Sprite[];
  drops: Phaser.GameObjects.Sprite[];
  hands: Phaser.GameObjects.Sprite[];
  watches: Array<{
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.TileSprite;
    x: number; y: number;
  }>;
  clock: number;
  lastTime: number;
};

const states = new WeakMap<Phaser.Scene, FactoryVisuals>();

export function createWandFactoryVisuals(
  scene: Phaser.Scene, hall: FactoryHall | undefined, map: Phaser.Tilemaps.Tilemap | undefined
): void {
  clearWandFactoryVisuals(scene);
  if (!hall || !map) return;
  generateWandFactoryTextures(scene);
  const wx = (lx: number) => map.tileToWorldX(hall.x + lx)!;
  const wy = (ly: number) => map.tileToWorldY(hall.y + ly)!;
  const objects: Phaser.GameObjects.GameObject[] = [];
  const watches: FactoryVisuals['watches'] = [];

  const addSprite = (x: number, y: number, key: string, originX = 0.5, originY = 1) => {
    const sprite = scene.add.sprite(wx(x), wy(y), key).setOrigin(originX, originY);
    sprite.setDepth(20);
    objects.push(sprite);
    watches.push({ sprite, x: hall.x + x, y: hall.y + y });
    return sprite;
  };

  // North-west pillar: a captured fire element feeds the distiller. Its
  // copper pipe carries extracted flame to the nozzle above an empty bottle.
  addSprite(2, 3, FACTORY_CABINET_TEXTURE);
  addSprite(3, 3, FIRE_ELEMENTAL_TEXTURE, 0.5, 1);
  addSprite(4, 4, FACTORY_PIPE_TEXTURE, 0.5, 0.5);
  addSprite(4, 5, FACTORY_BOTTLE_TEXTURE, 0.5, 0);
  const drops = [0, 1, 2].map((index) => {
    const sprite = scene.add.sprite(wx(4), wy(4) + index * 2, FACTORY_DROP_TEXTURE(index))
      .setOrigin(0.5, 0);
    sprite.setDepth(21);
    objects.push(sprite);
    watches.push({ sprite, x: hall.x + 4, y: hall.y + 4 });
    return sprite;
  });

  // North-east pillar: a 5x3 clockwork assembler. A three-tile belt runs
  // right-to-left inside it and drops finished wands into an outside crate.
  addSprite(13, 3, FACTORY_CABINET_TEXTURE);
  for (const lx of [10, 12]) {
    addSprite(lx, 3, FACTORY_CLOCK_TEXTURE, 0.5, 0.5);
  }
  const hands = [10, 12].map((lx) => {
    const sprite = scene.add.sprite(wx(lx) + 4, wy(3) + 4, FACTORY_CLOCK_HAND_TEXTURE)
      .setOrigin(0.5, 1);
    sprite.setDepth(21);
    objects.push(sprite);
    watches.push({ sprite, x: hall.x + lx, y: hall.y + 3 });
    return sprite;
  });
  const belt = scene.add.tileSprite(wx(9), wy(4), FACTORY_BELT_TILES * 16, 8, FACTORY_BELT_TEXTURE)
    .setOrigin(0, 0.5);
  belt.setDepth(19);
  objects.push(belt);
  watches.push({ sprite: belt, x: hall.x + 9, y: hall.y + 4 });
  addSprite(8, 5, FACTORY_CRATE_TEXTURE);
  const wands = [0, 1, 2].map(() => {
    const sprite = scene.add.sprite(wx(11), wy(4), FACTORY_WAND_TEXTURE)
      .setOrigin(0.5, 0.5);
    sprite.setDepth(20);
    objects.push(sprite);
    watches.push({ sprite, x: hall.x + 9, y: hall.y + 4 });
    return sprite;
  });

  states.set(scene, { objects, belt, wands, drops, hands, watches, clock: 0, lastTime: -1 });
}

export function updateWandFactoryVisuals(
  scene: Phaser.Scene, now: number, paused: boolean,
  visibleTiles?: ReadonlySet<string>
): void {
  const state = states.get(scene);
  if (!state) return;
  if (state.lastTime < 0) state.lastTime = now;
  state.clock += paused ? 0 : Math.max(0, now - state.lastTime);
  state.lastTime = now;
  state.belt.tilePositionX = factoryBeltOffset(state.clock);

  state.drops.forEach((sprite, _index) => {
    const frame = factoryDropFrame(state.clock, _index);
    sprite.setTexture(FACTORY_DROP_TEXTURE(frame));
    sprite.setAlpha(frame === FACTORY_DROP_FRAMES - 1 ? 0.35 : 1);
  });
  state.wands.forEach((sprite, index) => {
    const progress = factoryWandProgress(state.clock, index);
    // Right to left, then over the lip and down into the crate.
    sprite.x = state.belt.x + state.belt.width - 8 - progress * (state.belt.width - 16);
    const fall = Math.max(0, (progress - 0.8) / 0.2);
    sprite.y = state.belt.y + fall * 20;
    sprite.setAlpha(fall > 0 ? 1 - fall : 1);
  });
  state.hands.forEach((hand, index) => {
    hand.rotation = factoryClockAngle(state.clock, index);
  });
  for (const watch of state.watches) {
    watch.sprite.setVisible(!visibleTiles || visibleTiles.has(`${watch.x},${watch.y}`));
  }
}

export function clearWandFactoryVisuals(scene: Phaser.Scene): void {
  const state = states.get(scene);
  if (!state) return;
  for (const object of state.objects) object.destroy();
  states.delete(scene);
}
