// Pure, renderer-free layout for the fullscreen talent tree. The tree lives in
// a large scrollable viewport; the detail panel stays pinned beside/below it.

export type Rect = { x: number; y: number; width: number; height: number };
export type TalentLayoutMode = "wide" | "narrow";
export type TalentNodeBox = { id: string; rect: Rect; branch: number; tier: number };
export type TalentLayout = {
  mode: TalentLayoutMode;
  scale: number;
  panel: Rect;
  viewport: Rect;
  contentHeight: number;
  detail: Rect;
  nodes: TalentNodeBox[];
  rankUp: Rect;
  close: Rect;
};

const BRANCHES = 3;
const TIERS = 3;
const WIDE = { width: 1000, height: 620 };
const NARROW = { width: 360, height: 620 };
const GAP = 20;

function toScreen(rect: Rect, scale: number, ox: number, oy: number): Rect {
  return {
    x: ox + rect.x * scale,
    y: oy + rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

export function talentTreeLayout(
  viewW: number,
  viewH: number,
  nodes: { id: string }[]
): TalentLayout {
  if (!Number.isFinite(viewW) || !Number.isFinite(viewH) || viewW <= 0 || viewH <= 0) {
    throw new RangeError("Talent tree viewport must have positive finite dimensions");
  }
  const mode: TalentLayoutMode = viewW / viewH >= 1.2 ? "wide" : "narrow";
  const design = mode === "wide" ? WIDE : NARROW;
  const scale = Math.min(viewW / design.width, viewH / design.height, 2);
  const ox = (viewW - design.width * scale) / 2;
  const oy = (viewH - design.height * scale) / 2;

  // Tree gets almost the whole screen; detail is a slim pinned strip.
  const viewport: Rect = mode === "wide"
    ? { x: 12, y: 62, width: 690, height: 542 }
    : { x: 8, y: 48, width: 344, height: 352 };
  const detail: Rect = mode === "wide"
    ? { x: 712, y: 62, width: 276, height: 542 }
    : { x: 8, y: 408, width: 344, height: 200 };
  const close: Rect = mode === "wide"
    ? { x: design.width - 116, y: 14, width: 100, height: 38 }
    : { x: design.width - 84, y: 6, width: 76, height: 34 };
  const rankUp: Rect = {
    x: detail.x + 12,
    y: detail.y + detail.height - 58,
    width: detail.width - 24,
    height: 46,
  };

  // Content is wider/taller than the viewport on phones so it scrolls; node
  // rects are in content space (y = 0 at the top of the scrollable area).
  const cellW = viewport.width / BRANCHES;
  const nodeW = mode === "wide" ? Math.min(196, cellW - 14) : cellW - 10;
  const nodeH = 132;
  const rowH = nodeH + GAP;
  const contentHeight = TIERS * rowH + GAP;
  const boxes: TalentNodeBox[] = nodes.slice(0, BRANCHES * TIERS).map((entry, index) => {
    const branch = Math.floor(index / TIERS);
    const tier = index % TIERS;
    return {
      id: entry.id,
      branch,
      tier,
      rect: {
        x: viewport.x + tier * cellW + (cellW - nodeW) / 2,
        y: viewport.y + GAP + branch * rowH,
        width: nodeW,
        height: nodeH,
      },
    };
  });

  // Wide shows tiers left→right and branches top→bottom; narrow stacks tiers
  // vertically with the three branches side by side.
  if (mode === "narrow") {
    const narrowCellW = viewport.width / BRANCHES;
    boxes.forEach(box => {
      box.rect.x = viewport.x + box.branch * narrowCellW + (narrowCellW - nodeW) / 2;
      box.rect.y = viewport.y + GAP + box.tier * rowH;
    });
  }

  return {
    mode,
    scale,
    panel: toScreen({ x: 0, y: 0, ...design }, scale, ox, oy),
    viewport: toScreen(viewport, scale, ox, oy),
    contentHeight: contentHeight * scale,
    detail: toScreen(detail, scale, ox, oy),
    nodes: boxes.map(box => ({ ...box, rect: toScreen(box.rect, scale, ox, oy) })),
    rankUp: toScreen(rankUp, scale, ox, oy),
    close: toScreen(close, scale, ox, oy),
  };
}

export function maxTreeScroll(layout: TalentLayout): number {
  return Math.max(0, layout.contentHeight - layout.viewport.height);
}

export function talentNodeAt(layout: TalentLayout, x: number, y: number, scrollY: number): string | undefined {
  return layout.nodes.find(box =>
    x >= box.rect.x && x < box.rect.x + box.rect.width &&
    y + scrollY >= box.rect.y && y + scrollY < box.rect.y + box.rect.height)?.id;
}

export function rectContains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}
