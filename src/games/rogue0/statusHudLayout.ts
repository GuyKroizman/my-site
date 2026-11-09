// Geometry for the HUD status-icon column.
//
// The icons live directly under the hero portrait in the top-left corner. They
// wrap into extra columns when a long stack of buffs would otherwise reach the
// message strip, so no active effect is ever silently hidden. Pure arithmetic:
// no Phaser, no gameplay state.

/** Height of the message strip above the bottom controls (see UI.layout). */
export const LOG_STRIP_HEIGHT = 48;
/** Gap between the message strip and the bottom controls (see UI.layout). */
export const LOG_STRIP_GAP = 6;
/** Distance of every HUD element from the screen edge. */
export const HUD_EDGE = 8;

export type StatusIconBox = {
  /** Top-left corner of the icon box. */
  x: number;
  y: number;
  /** False when the viewport is too small for this slot. */
  visible: boolean;
};

export type StatusIconLayout = {
  boxes: StatusIconBox[];
  rows: number;
  startX: number;
  startY: number;
  /** First y the column may not cross (top of the message strip). */
  bottom: number;
};

export function statusIconLayout(options: {
  width: number;
  height: number;
  count: number;
  /** Toolbar/portrait button size from getHudMetrics. */
  toolbarSize: number;
  iconSize: number;
  gap: number;
}): StatusIconLayout {
  const { width, height, count, toolbarSize, iconSize, gap } = options;
  const stride = iconSize + gap;
  const startX = HUD_EDGE;
  const startY = HUD_EDGE + toolbarSize + 4;
  const bottom = height - toolbarSize - HUD_EDGE - LOG_STRIP_HEIGHT - LOG_STRIP_GAP - 6;
  const rows = Math.max(1, Math.floor((bottom - startY + gap) / stride));
  const boxes: StatusIconBox[] = [];
  for (let i = 0; i < count; i++) {
    const x = startX + Math.floor(i / rows) * stride;
    const y = startY + (i % rows) * stride;
    boxes.push({
      x,
      y,
      visible: x + iconSize <= width - HUD_EDGE && y + iconSize <= bottom + gap
    });
  }
  return { boxes, rows, startX, startY, bottom };
}
