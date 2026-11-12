/** Sort by ground contact, not the lifted artwork. Keep the whole world below
 * fog (100), including on large maps. Tie offsets are fractions of a pixel. */
export function worldDepth(worldY: number, kind: 'item' | 'terrain' | 'actor'): number {
  const foot = Math.max(0, worldY + 16) + (kind === 'actor' ? 0.2 : kind === 'terrain' ? 0.1 : 0);
  return 1 + 80 * foot / (foot + 32);
}

/** How a ground item's artwork sits inside its 16px cell. Only the sprite is
 * affected; the entity keeps its tile anchor for depth, inspection and saves. */
export type FloorItemView = { scale: number; centred: boolean };

const FILLED_CELL_VIEW: FloorItemView = { scale: 1, centred: false };
// Small finds — potions and glyph stones — draw half size in the middle of
// their cell instead of filling it. Inventory icons are unaffected: they
// always draw at 100%.
const CENTRED_HALF_VIEW: FloorItemView = { scale: 0.5, centred: true };

/** Artwork size and position for an item's floor texture. Glyph-stone keys are
 * GLYPH_STONE_TEXTURES ("glyph-stone-…"), potion appearances are "potion-N". */
export function floorItemView(textureKey?: string): FloorItemView {
  if (textureKey?.startsWith('glyph-stone-') || textureKey?.startsWith('potion-')) {
    return CENTRED_HALF_VIEW;
  }
  return FILLED_CELL_VIEW;
}

type FloorSprite = {
  x: number;
  y: number;
  setScale(scale: number): unknown;
  setPosition(x: number, y: number): unknown;
};

/** Shrink a freshly placed floor sprite and, when the view asks for it, inset
 * the art so it sits in the middle of the cell rather than hugging the cell's
 * top-left corner. Items that fill a tile are left exactly where they are. */
export function presentFloorItem(sprite: FloorSprite, textureKey?: string): void {
  const view = floorItemView(textureKey);
  if (view.scale !== 1) sprite.setScale(view.scale);
  if (!view.centred) return;
  // Half of the 16px cell that the shrunken artwork no longer fills.
  const inset = 8 * (1 - view.scale);
  sprite.setPosition(sprite.x + inset, sprite.y + inset);
}

/** Passage direction, not the direction the door panel faces. Out-of-map
 * neighbors count as walls; ambiguous junctions retain the front-facing door. */
export function doorPassage(level: number[][], x: number, y: number): 'horizontal' | 'vertical' {
  const floor = (dx: number, dy: number) => level[y + dy]?.[x + dx] === 0 ? 1 : 0;
  return floor(-1, 0) + floor(1, 0) > floor(0, -1) + floor(0, 1) ? 'horizontal' : 'vertical';
}

// Lift artwork without changing grid positions, tween destinations or hitboxes.
export const UPRIGHT_LIFT = 5;

/** Taller art grows upward; feet remain at local y=16 for every actor. */
export function actorOriginY(frameHeight: number): number {
  return 1 - 16 / frameHeight;
}

/** Origin that keeps a sprite centred on its cell and its feet on the cell's
 * bottom edge. Larger art (the boss) must account for scale or it drifts
 * south-east of its logical tile and clicks land on the wrong tile. */
export function actorOrigin(frameWidth: number, frameHeight: number, scale = 1): { x: number; y: number } {
  const width = frameWidth * scale;
  const height = frameHeight * scale;
  return {
    x: width > 16 ? 0.5 - 8 / width : 0,
    y: height >= 16 ? 1 - 16 / height : actorOriginY(frameHeight)
  };
}

/** Only the north edge of a solid wall projects into walkable space. */
export function wallOverhang(level: number[][], x: number, y: number): boolean {
  return level[y]?.[x] === 1 && level[y - 1]?.[x] === 0;
}

/** Feather inward onto explored terrain only. Unknown cells stay opaque;
 * this is presentation, never an expansion of FOV or targeting range. */
export function fogFeatherRects(seen: Array<boolean[] | null | undefined>): Array<{ x: number; y: number; width: number; height: number; alpha: number }> {
  const rects: Array<{ x: number; y: number; width: number; height: number; alpha: number }> = [];
  const fade = [0.88, 0.66, 0.43, 0.23, 0.09];
  for (let y = 0; y < seen.length; y++) {
    // Exploration is sparse: untouched rows don't exist (or deserialize as
    // null). Treat them as unknown without mutating the exploration map.
    const row = seen[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        if (seen[y + dy]?.[x + dx]) continue;
        fade.forEach((alpha, i) => {
          rects.push({
            x: x * 16 + (dx < 0 ? i : dx > 0 ? 15 - i : 0),
            y: y * 16 + (dy < 0 ? i : dy > 0 ? 15 - i : 0),
            width: dx === 0 ? 16 : 1,
            height: dy === 0 ? 16 : 1,
            alpha
          });
        });
      }
    }
  }
  return rects;
}

// Only one foreground entity is drawn per cell.
export function foregroundEntities<T extends { x?: number; y?: number; type: string }>(entities: T[], player?: T): Set<T> {
  const cells = new Map<string, T>();
  const priority = (entity: T) => entity === player ? 3 : entity.type === 'item' ? 1 : 2;
  for (const entity of entities) {
    if (entity.x === undefined || entity.y === undefined) continue;
    const key = `${entity.x},${entity.y}`;
    const current = cells.get(key);
    // Stable item choice: first item wins until removed from the cell.
    if (!current || priority(entity) > priority(current)) cells.set(key, entity);
  }
  return new Set(cells.values());
}

