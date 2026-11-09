// Source-image coordinates, independent of Phaser, camera zoom and the HUD.
export const STORE_ART = { width: 600, height: 338 } as const;
export const STORE_COLUMNS = 5;
export const STORE_ROWS = 3;
export const STORE_SLOTS = STORE_COLUMNS * STORE_ROWS;
export const SHELF_BANDS = [[13, 66], [81, 130], [144, 195]] as const;
export type Rect = { x: number; y: number; width: number; height: number };
export type StoreLayout = {
  scale: number;
  offsetX: number;
  offsetY: number;
  mode: 'overlay' | 'stacked';
};

export function shelfSlots(): Rect[] {
  const width = (552 - 46) / STORE_COLUMNS;
  return Array.from({ length: STORE_SLOTS }, (_, index) => {
    const [top, bottom] = SHELF_BANDS[Math.floor(index / STORE_COLUMNS)];
    return { x: 46 + (index % STORE_COLUMNS) * width, y: top, width, height: bottom - top };
  });
}

// Contain, never cover: filling by height alone crops the outer columns on a
// narrow landscape screen. Modals/toolbars use screen-space sizes separately.
export function storeLayout(viewW: number, viewH: number): StoreLayout {
  if (!Number.isFinite(viewW) || !Number.isFinite(viewH) || viewW <= 0 || viewH <= 0) {
    throw new RangeError('Store viewport must have positive finite dimensions');
  }
  const mode = viewW / viewH >= 1.2 ? 'overlay' : 'stacked';
  const availableHeight = mode === 'stacked' ? viewH * 0.65 : viewH;
  const scale = Math.min(viewW / STORE_ART.width, availableHeight / STORE_ART.height,
    mode === 'stacked' ? 1.4 : 3.2);
  return { scale, offsetX: Math.max(0, (viewW - STORE_ART.width * scale) / 2),
    offsetY: mode === 'stacked' ? 0 : Math.max(0, (viewH - STORE_ART.height * scale) / 2), mode };
}

export function artToScreen(rect: Rect, layout: StoreLayout): Rect {
  return { x: layout.offsetX + rect.x * layout.scale, y: layout.offsetY + rect.y * layout.scale,
    width: rect.width * layout.scale, height: rect.height * layout.scale };
}

export function screenToArt(x: number, y: number, layout: StoreLayout): { x: number; y: number } {
  return { x: (x - layout.offsetX) / layout.scale, y: (y - layout.offsetY) / layout.scale };
}

// Half-open bounds assign column boundaries unambiguously; shelf boards and
// surrounding artwork are not item targets.
export function slotAt(x: number, y: number): number | undefined {
  const index = shelfSlots().findIndex(rect => x >= rect.x && x < rect.x + rect.width &&
    y >= rect.y && y < rect.y + rect.height);
  return index < 0 ? undefined : index;
}

export function moveSelection(index: number, dx: number, dy: number): number {
  const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));
  const current = clamp(Number.isFinite(index) ? Math.trunc(index) : 0, STORE_SLOTS - 1);
  const stepX = Number.isFinite(dx) ? Math.sign(dx) : 0;
  const stepY = Number.isFinite(dy) ? Math.sign(dy) : 0;
  return clamp(Math.floor(current / STORE_COLUMNS) + stepY, STORE_ROWS - 1) * STORE_COLUMNS +
    clamp(current % STORE_COLUMNS + stepX, STORE_COLUMNS - 1);
}
