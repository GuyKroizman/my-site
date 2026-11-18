// Pure, renderer-free layout for the fullscreen talent tree. Same role as
// storeLayout: one function, contain-never-cover scaling, testable hit boxes.

export type Rect = { x: number; y: number; width: number; height: number };
export type TalentLayoutMode = "wide" | "narrow";
export type TalentNodeBox = { id: string; rect: Rect; branch: number; tier: number };
export type TalentLayout = {
  mode: TalentLayoutMode;
  scale: number;
  panel: Rect;
  tree: Rect;
  detail: Rect;
  nodes: TalentNodeBox[];
  rankUp: Rect;
  close: Rect;
};

const BRANCHES = 3;
const TIERS = 3;
const WIDE = { width: 1000, height: 620 };
const NARROW = { width: 360, height: 620 };

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

  const tree: Rect = mode === "wide"
    ? { x: 16, y: 66, width: 650, height: 538 }
    : { x: 8, y: 52, width: 344, height: 320 };
  const detail: Rect = mode === "wide"
    ? { x: 682, y: 66, width: 302, height: 538 }
    : { x: 8, y: 380, width: 344, height: 228 };
  const close: Rect = mode === "wide"
    ? { x: design.width - 116, y: 16, width: 100, height: 38 }
    : { x: design.width - 84, y: 8, width: 76, height: 36 };
  const rankUp: Rect = {
    x: detail.x + 12,
    y: detail.y + detail.height - 58,
    width: detail.width - 24,
    height: 46,
  };

  // Branch-major data (three nodes per branch). Wide shows tiers left→right
  // and branches top→bottom; narrow stacks tiers vertically in each column.
  const cellW = tree.width / BRANCHES;
  const cellH = tree.height / TIERS;
  const nodeW = mode === "wide" ? Math.min(196, cellW - 8) : cellW - 10;
  const nodeH = mode === "wide" ? Math.min(96, cellH - 10) : Math.min(64, cellH - 10);
  const boxes: TalentNodeBox[] = nodes.slice(0, BRANCHES * TIERS).map((entry, index) => {
    const branch = Math.floor(index / TIERS);
    const tier = index % TIERS;
    const col = mode === "wide" ? tier : branch;
    const row = mode === "wide" ? branch : tier;
    return {
      id: entry.id,
      branch,
      tier,
      rect: toScreen({
        x: tree.x + col * cellW + (cellW - nodeW) / 2,
        y: tree.y + row * cellH + (cellH - nodeH) / 2,
        width: nodeW,
        height: nodeH,
      }, scale, ox, oy),
    };
  });

  return {
    mode,
    scale,
    panel: toScreen({ x: 0, y: 0, ...design }, scale, ox, oy),
    tree: toScreen(tree, scale, ox, oy),
    detail: toScreen(detail, scale, ox, oy),
    nodes: boxes,
    rankUp: toScreen(rankUp, scale, ox, oy),
    close: toScreen(close, scale, ox, oy),
  };
}

export function talentNodeAt(layout: TalentLayout, x: number, y: number): string | undefined {
  return layout.nodes.find(box =>
    x >= box.rect.x && x < box.rect.x + box.rect.width &&
    y >= box.rect.y && y < box.rect.y + box.rect.height)?.id;
}

export function rectContains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}
