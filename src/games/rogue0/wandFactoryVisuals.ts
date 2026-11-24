import type Phaser from "phaser";

// Pure presentation for the two Wand Factory machines. Nothing here touches
// the map, path grids, FOV, gameplay RNG or context.simulationTime.
export const FACTORY_CABINET_TEXTURE = 'factory-cabinet';
export const FACTORY_BELT_TEXTURE = 'factory-belt';
export const FACTORY_CRATE_TEXTURE = 'factory-crate';
export const FACTORY_BOTTLE_TEXTURE = 'factory-bottle';
export const FACTORY_DROP_TEXTURE = (frame: number) => `factory-drop-${frame}`;
export const FACTORY_WAND_TEXTURE = 'wand-fire';
export const FACTORY_DROP_FRAMES = 4;

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
  // Always positive: negative tile offsets wrap unpredictably on WebGL.
  return 16 + (clock / 28) % 16;
}

// One full trip from assembler to crate takes 3.3 seconds: a third of the
// old speed, so the wands visibly ride the belt rather than zip along it.
export function factoryWandProgress(clock: number, index: number): number {
  return ((clock / 3300) + index / 3) % 1;
}

export type FactoryHall = { x: number; y: number; w: number; h: number };

type FactoryVisuals = {
  objects: Phaser.GameObjects.GameObject[];
  belt: Phaser.GameObjects.TileSprite;
  wands: Phaser.GameObjects.Sprite[];
  drops: Phaser.GameObjects.Sprite[];
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

  // North-west pillar: the flame distiller and its empty bottle.
  addSprite(2, 3, FACTORY_CABINET_TEXTURE);
  addSprite(4, 5, FACTORY_BOTTLE_TEXTURE, 0.5, 0);
  const drops = [0, 1, 2].map((index) => {
    const sprite = scene.add.sprite(wx(4), wy(4) + index * 2, FACTORY_DROP_TEXTURE(index))
      .setOrigin(0.5, 0);
    sprite.setDepth(21);
    objects.push(sprite);
    watches.push({ sprite, x: hall.x + 4, y: hall.y + 4 });
    return sprite;
  });

  // North-east pillar: the wand assembler, belt and output crate.
  addSprite(14, 3, FACTORY_CABINET_TEXTURE);
  const belt = scene.add.tileSprite(wx(3), wy(4), 10 * 16, 8, FACTORY_BELT_TEXTURE)
    .setOrigin(0, 0.5);
  belt.setDepth(19);
  objects.push(belt);
  watches.push({ sprite: belt, x: hall.x + 3, y: hall.y + 4 });
  addSprite(3, 5, FACTORY_CRATE_TEXTURE);
  const wands = [0, 1, 2].map(() => {
    const sprite = scene.add.sprite(wx(3), wy(4), FACTORY_WAND_TEXTURE)
      .setOrigin(0.5, 0.5);
    sprite.setDepth(20);
    objects.push(sprite);
    watches.push({ sprite, x: hall.x + 3, y: hall.y + 4 });
    return sprite;
  });

  states.set(scene, { objects, belt, wands, drops, watches, clock: 0, lastTime: -1 });
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
    sprite.x = state.belt.x + 8 + progress * (state.belt.width - 16);
    sprite.setAlpha(progress > 0.85 ? (1 - progress) / 0.15 : 1);
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
