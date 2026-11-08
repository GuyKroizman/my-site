// Rectangular, tile-aligned physical footprints for actors.
//
// Every creature occupies a width x height rectangle of map cells. The shape
// drawn inside that rectangle is presentation only: a round blob that is 3x3
// tiles still owns all nine cells for movement, hits, projectiles and
// inspection.
//
// `entity.x/y` is the ANCHOR cell. `originX/originY` say which cell of the
// rectangle the anchor refers to. The default is the top-left corner, so a 3x3
// creature at (5,5) covers (5,5)..(7,7). Creatures that want another anchor
// (the arena guardian is centre-anchored at the old bodyRadius semantics) say
// so explicitly. The footprint is derived configuration, never saved state.

export type Footprint = {
  width: number;
  height: number;
  originX: number;
  originY: number;
};

export type FootprintAnchor = 'top-left' | 'center' | 'feet';

export type FootprintSpec = {
  width: number;
  height: number;
  // Authoring sugar. Explicit originX/originY win when both are supplied.
  anchor?: FootprintAnchor;
  originX?: number;
  originY?: number;
};

/** One ordinary cell. Shared and frozen so callers cannot mutate the default. */
export const TILE_FOOTPRINT: Footprint = Object.freeze({
  width: 1,
  height: 1,
  originX: 0,
  originY: 0
});

function dimension(value: number, name: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new Error(`Footprint ${name} must be a positive integer (got ${String(value)})`);
  }
  return value;
}

function offset(value: number, size: number, name: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value >= size) {
    throw new Error(`Footprint ${name} must be an integer in [0, ${size - 1}] (got ${String(value)})`);
  }
  return value;
}

/** Validate a requested footprint and resolve its anchor once, at construction. */
export function resolveFootprint(spec: FootprintSpec): Footprint {
  if (!spec || typeof spec !== 'object') throw new Error('Footprint spec is required');
  const width = dimension(spec.width, 'width');
  const height = dimension(spec.height, 'height');

  if (spec.originX !== undefined || spec.originY !== undefined) {
    if (spec.originX === undefined || spec.originY === undefined) {
      throw new Error('Footprint originX and originY must be supplied together');
    }
    return Object.freeze({
      width,
      height,
      originX: offset(spec.originX, width, 'originX'),
      originY: offset(spec.originY, height, 'originY')
    });
  }

  const anchor = spec.anchor ?? 'top-left';
  if (anchor === 'top-left') {
    return Object.freeze({ width, height, originX: 0, originY: 0 });
  }
  if (anchor === 'center') {
    // There is no centre cell in an even-sized rectangle. Fail loudly rather
    // than silently rounding an author's intent to a corner.
    if (width % 2 === 0 || height % 2 === 0) {
      throw new Error(`A centered footprint needs odd width and height (got ${width}x${height})`);
    }
    return Object.freeze({
      width,
      height,
      originX: (width - 1) / 2,
      originY: (height - 1) / 2
    });
  }
  if (anchor === 'feet') {
    // The anchor is the feet row. Even widths place it just right of centre so
    // the rule is deterministic for every size.
    return Object.freeze({
      width,
      height,
      originX: Math.floor(width / 2),
      originY: height - 1
    });
  }
  throw new Error(`Unknown footprint anchor: ${String(anchor)}`);
}

export type FootprintBounds = { x0: number; y0: number; x1: number; y1: number };

/** Inclusive map-cell rectangle covered by this footprint at x,y. */
export function footprintBounds(fp: Footprint, x: number, y: number): FootprintBounds {
  return {
    x0: x - fp.originX,
    y0: y - fp.originY,
    x1: x - fp.originX + fp.width - 1,
    y1: y - fp.originY + fp.height - 1
  };
}

/** Does this footprint at x,y cover the cell (tx,ty)? */
export function footprintContains(
  fp: Footprint, x: number, y: number, tx: number, ty: number
): boolean {
  const b = footprintBounds(fp, x, y);
  return tx >= b.x0 && tx <= b.x1 && ty >= b.y0 && ty <= b.y1;
}

/** Every cell the footprint occupies, row-major. */
export function* footprintTiles(
  fp: Footprint, x: number, y: number
): Generator<[number, number]> {
  const b = footprintBounds(fp, x, y);
  for (let ty = b.y0; ty <= b.y1; ty++) {
    for (let tx = b.x0; tx <= b.x1; tx++) yield [tx, ty];
  }
}

/** Do two footprints overlap when placed at their anchors? */
export function footprintsOverlap(
  a: Footprint, ax: number, ay: number, b: Footprint, bx: number, by: number
): boolean {
  const ab = footprintBounds(a, ax, ay);
  const bb = footprintBounds(b, bx, by);
  return ab.x0 <= bb.x1 && bb.x0 <= ab.x1 && ab.y0 <= bb.y1 && bb.y0 <= ab.y1;
}

/** Chebyshev gap between two footprint rectangles. 0 means touching or
 * overlapping, 1 means one empty cell between them (melee reach). */
export function footprintGap(
  a: Footprint, ax: number, ay: number, b: Footprint, bx: number, by: number
): number {
  const ab = footprintBounds(a, ax, ay);
  const bb = footprintBounds(b, bx, by);
  const dx = Math.max(0, Math.max(bb.x0 - ab.x1, ab.x0 - bb.x1));
  const dy = Math.max(0, Math.max(bb.y0 - ab.y1, ab.y0 - bb.y1));
  return Math.max(dx, dy);
}

/** Footprint centre in tile coordinates (fractional for even sizes). Rendering,
 * camera and markers use pixels; gameplay must use footprint tiles instead. */
export function footprintCenter(
  fp: Footprint, x: number, y: number
): { x: number; y: number } {
  const b = footprintBounds(fp, x, y);
  return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
}

/** Anchor that puts the footprint's centre at the requested tile centre. */
export function footprintAnchorForCenter(
  fp: Footprint, centerX: number, centerY: number
): { x: number; y: number } {
  return {
    x: centerX - (fp.width - 1) / 2 + fp.originX,
    y: centerY - (fp.height - 1) / 2 + fp.originY
  };
}
