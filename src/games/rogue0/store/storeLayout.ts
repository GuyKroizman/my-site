// Source-image coordinates, independent of Phaser, camera zoom and the HUD.
export const STORE_ART = { width: 600, height: 338 } as const;
export const STORE_COLUMNS = 5;
export const STORE_ROWS = 3;
export const STORE_SLOTS = STORE_COLUMNS * STORE_ROWS;
export const SHELF_BANDS = [[13, 66], [81, 130], [144, 195]] as const;
export type Rect = { x: number; y: number; width: number; height: number };
export type LayoutGeometry = { scale: number; offsetX: number; offsetY: number };
export type StoreLayout = LayoutGeometry & { mode: 'overlay' | 'stacked' };
// Touch portrait: the art keeps its full height and overflows the viewport
// horizontally; the player drags it to browse the columns.
export type StorePanLayout = LayoutGeometry & {
  mode: 'panorama';
  artWidth: number;
  artHeight: number;
  minPanX: number;
  maxPanX: number;
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

// Panorama replaces the contained portrait layout only on touch devices: a
// phone can drag a wider-than-screen image, a narrow desktop window cannot.
export function isPanoramaView(viewW: number, viewH: number, touch: boolean): boolean {
  return touch && viewW > 0 && viewH > 0 && viewW / viewH < 1.2;
}

export function storePanLayout(viewW: number, viewH: number): StorePanLayout {
  if (!Number.isFinite(viewW) || !Number.isFinite(viewH) || viewW <= 0 || viewH <= 0) {
    throw new RangeError('Store viewport must have positive finite dimensions');
  }
  // Height is the binding dimension; the resulting art is wider than a portrait
  // viewport, which is the point. offsetX centres it before any drag.
  const scale = viewH / STORE_ART.height;
  const artWidth = STORE_ART.width * scale;
  const offsetX = (viewW - artWidth) / 2;
  const pan = Math.max(0, (artWidth - viewW) / 2);
  return { scale, offsetX, offsetY: 0, mode: 'panorama', artWidth,
    artHeight: STORE_ART.height * scale, minPanX: -pan, maxPanX: pan };
}

// Pan positions keep the whole viewport covered by art: the most negative pan
// reveals the right edge, the most positive one reveals the left edge.
export function clampPan(layout: StorePanLayout, panX: number): number {
  if (!Number.isFinite(panX)) return 0;
  return Math.max(layout.minPanX, Math.min(layout.maxPanX, panX));
}

export function artToScreen(rect: Rect, layout: LayoutGeometry): Rect {
  return { x: layout.offsetX + rect.x * layout.scale, y: layout.offsetY + rect.y * layout.scale,
    width: rect.width * layout.scale, height: rect.height * layout.scale };
}

export function screenToArt(x: number, y: number, layout: LayoutGeometry): { x: number; y: number } {
  return { x: (x - layout.offsetX) / layout.scale, y: (y - layout.offsetY) / layout.scale };
}

// Hit testing accounts for the current drag offset without baking it into the
// layout, so the art can move every frame without recomputing slot rectangles.
export function panSlotAt(layout: StorePanLayout, panX: number, screenX: number, screenY: number): number | undefined {
  const art = screenToArt(screenX - panX, screenY, layout);
  return slotAt(art.x, art.y);
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
