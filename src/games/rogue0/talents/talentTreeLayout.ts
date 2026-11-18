// Pure, renderer-free layout for the fullscreen talent tree. The tree is drawn
// on a canvas larger than the viewport in both directions, so it pans freely;
// branches fan outward from their roots and connect with lines.

export type Rect = { x: number; y: number; width: number; height: number };
export type TalentLayoutMode = "wide" | "narrow";
export type TalentNodeBox = { id: string; rect: Rect; branch: number; tier: number };
export type TalentLayout = {
  mode: TalentLayoutMode;
  scale: number;
  panel: Rect;
  viewport: Rect;
  modal: Rect;
  contentWidth: number;
  contentHeight: number;
  nodes: TalentNodeBox[];
  modalRankUp: Rect;
  modalClose: Rect;
  close: Rect;
};

const BRANCHES = 3;
const TIERS = 3;
const CONTENT = {
  wide: { width: 1000, height: 900, radius: 64 },
  narrow: { width: 780, height: 1150, radius: 58 },
} as const;

export function talentTreeLayout(
  viewW: number,
  viewH: number,
  nodes: { id: string }[]
): TalentLayout {
  if (!Number.isFinite(viewW) || !Number.isFinite(viewH) || viewW <= 0 || viewH <= 0) {
    throw new RangeError("Talent tree viewport must have positive finite dimensions");
  }
  const mode: TalentLayoutMode = viewW / viewH >= 1.2 ? "wide" : "narrow";
  const content = CONTENT[mode];
  // Always draw the tree larger than the pane in both axes so panning matters.
  const scale = Math.max(0.55, Math.min(4,
    1.25 * Math.max(viewW / content.width, viewH / content.height)));

  const panel: Rect = { x: 0, y: 0, width: viewW, height: viewH };
  const viewport: Rect = mode === "wide"
    ? { x: 14, y: 62, width: viewW - 28, height: viewH - 76 }
    : { x: 12, y: 52, width: viewW - 24, height: viewH - 64 };
  const close: Rect = mode === "wide"
    ? { x: viewW - 116, y: 14, width: 100, height: 38 }
    : { x: viewW - 84, y: 8, width: 76, height: 34 };

  // Floating detail modal, centred over the tree and only shown on click.
  const modalW = Math.min(440, viewport.width - 24);
  const modalH = Math.min(300, viewport.height - 24);
  const modal: Rect = {
    x: viewport.x + (viewport.width - modalW) / 2,
    y: viewport.y + (viewport.height - modalH) / 2,
    width: modalW,
    height: modalH,
  };
  const modalRankUp: Rect = {
    x: modal.x + 16,
    y: modal.y + modal.height - 58,
    width: modal.width - 32,
    height: 46,
  };
  const modalClose: Rect = { x: modal.x + modal.width - 40, y: modal.y + 8, width: 32, height: 32 };

  const radius = content.radius;
  const yFor = (tier: number) => [140, content.height * 0.46, content.height * 0.78][tier];
  const xFor = (branch: number, tier: number) => mode === "wide"
    ? [300 + branch * 200, 220 + branch * 280, 140 + branch * 360][tier]
    : [190 + branch * 175, 145 + branch * 225, 95 + branch * 265][tier];

  const boxes: TalentNodeBox[] = nodes.slice(0, BRANCHES * TIERS).map((entry, index) => {
    const branch = Math.floor(index / TIERS);
    const tier = index % TIERS;
    // x/y are measured from the top-left of the scrollable content, in screen
    // pixels; the scene offsets them by -scrollX/-scrollY.
    return {
      id: entry.id,
      branch,
      tier,
      rect: {
        x: xFor(branch, tier) * scale,
        y: yFor(tier) * scale,
        width: radius * 2 * scale,
        height: radius * 2 * scale,
      },
    };
  });

  return {
    mode,
    scale,
    panel,
    viewport,
    modal,
    contentWidth: content.width * scale,
    contentHeight: content.height * scale,
    nodes: boxes,
    modalRankUp,
    modalClose,
    close,
  };
}

export function treeScrollBounds(layout: TalentLayout): { maxX: number; maxY: number } {
  return {
    maxX: Math.max(0, layout.contentWidth - layout.viewport.width),
    maxY: Math.max(0, layout.contentHeight - layout.viewport.height),
  };
}

export function talentNodeAt(layout: TalentLayout, x: number, y: number,
  scrollX: number, scrollY: number): string | undefined {
  const cx = x - layout.viewport.x + scrollX;
  const cy = y - layout.viewport.y + scrollY;
  return layout.nodes.find(box =>
    cx >= box.rect.x && cx < box.rect.x + box.rect.width &&
    cy >= box.rect.y && cy < box.rect.y + box.rect.height)?.id;
}

export function rectContains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}
