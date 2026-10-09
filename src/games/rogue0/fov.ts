// @ts-nocheck
// Field-of-view and line-of-sight helpers for tile-based maps.
// `map` is a 2D array where 0 = walkable, 1 = wall.

function bresenhamLine(x0, y0, x1, y1) {
  const points = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;

  while (true) {
    points.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }

  return points;
}

export function hasLineOfSight(map, x0, y0, x1, y1) {
  const points = bresenhamLine(x0, y0, x1, y1);

  // Intermediate tiles block vision; the endpoints themselves are visible.
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    if (map[y] && map[y][x] === 1) return false;
  }

  return true;
}

export function canSee(map, x0, y0, x1, y1, radius) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (dx * dx + dy * dy > radius * radius) return false;
  return hasLineOfSight(map, x0, y0, x1, y1);
}

export function computeFOV(map, px, py, radius) {
  const visible = new Set();
  const r = Math.floor(radius);

  for (let y = py - r; y <= py + r; y++) {
    for (let x = px - r; x <= px + r; x++) {
      if (x < 0 || y < 0 || x >= map[0].length || y >= map.length) continue;

      const dx = x - px;
      const dy = y - py;
      if (dx * dx + dy * dy > r * r) continue;

      if (hasLineOfSight(map, px, py, x, y)) {
        visible.add(`${x},${y}`);
      }
    }
  }

  return visible;
}
