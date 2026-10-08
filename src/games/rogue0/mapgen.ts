export const MAP_WIDTH = 80;
export const MAP_HEIGHT = 50;

export type Room = {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
};

export type GeneratedMap = {
  map: number[][];
  rooms: Room[];
};

function carve(map: number[][], room: Room): void {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      map[y][x] = 0;
    }
  }
}

function connect(map: number[][], a: Room, b: Room): void {
  const horizontalFirst = Math.random() < 0.5;
  let x = a.cx;
  let y = a.cy;

  const carveTo = (tx: number, ty: number) => {
    while (x !== tx) {
      map[y][x] = 0;
      x += Math.sign(tx - x);
    }
    while (y !== ty) {
      map[y][x] = 0;
      y += Math.sign(ty - y);
    }
  };

  if (horizontalFirst) {
    carveTo(b.cx, a.cy);
    carveTo(b.cx, b.cy);
  } else {
    carveTo(a.cx, b.cy);
    carveTo(b.cx, b.cy);
  }

  map[b.cy][b.cx] = 0;
}

export function generateMap(): GeneratedMap {
  const map: number[][] = Array.from({ length: MAP_HEIGHT }, () =>
    Array(MAP_WIDTH).fill(1)
  );
  const rooms: Room[] = [];

  const maxRooms = 14;
  const maxAttempts = 200;

  for (
    let attempt = 0;
    attempt < maxAttempts && rooms.length < maxRooms;
    attempt++
  ) {
    const w = 4 + Math.floor(Math.random() * 8);
    const h = 4 + Math.floor(Math.random() * 6);
    const x = 1 + Math.floor(Math.random() * (MAP_WIDTH - w - 2));
    const y = 1 + Math.floor(Math.random() * (MAP_HEIGHT - h - 2));

    const room: Room = {
      x,
      y,
      w,
      h,
      cx: Math.floor(x + w / 2),
      cy: Math.floor(y + h / 2),
    };

    const overlaps = rooms.some(
      (r) =>
        x < r.x + r.w + 1 &&
        x + w + 1 > r.x &&
        y < r.y + r.h + 1 &&
        y + h + 1 > r.y
    );

    if (overlaps) continue;

    carve(map, room);
    rooms.push(room);
  }

  for (let i = 1; i < rooms.length; i++) {
    connect(map, rooms[i - 1], rooms[i]);
  }

  return { map, rooms };
}

// BFS to find the farthest walkable tile reachable from a start point.
// `maxX` keeps important tiles out of the columns hidden under the sidebar.
export function findFarthestWalkable(
  map: number[][],
  sx: number,
  sy: number,
  maxX: number = MAP_WIDTH
): { x: number; y: number } {
  const h = map.length;
  const w = map[0].length;
  const dist: number[][] = Array.from({ length: h }, () => Array(w).fill(-1));
  const queue: Array<[number, number]> = [[sx, sy]];
  dist[sy][sx] = 0;

  let best = { x: sx, y: sy, d: 0 };

  while (queue.length) {
    const [x, y] = queue.shift()!;
    const d = dist[y][x];

    if (d > best.d && x < maxX) {
      best = { x, y, d };
    }

    const dirs: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (map[ny][nx] === 1) continue;
      if (dist[ny][nx] !== -1) continue;
      dist[ny][nx] = d + 1;
      queue.push([nx, ny]);
    }
  }

  return best;
}

export function randomWalkableTiles(
  map: number[][],
  count: number,
  exclude: Set<string>,
  maxX: number = MAP_WIDTH
): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[0].length; x++) {
      if (x >= maxX) continue;
      if (map[y][x] !== 0) continue;
      if (exclude.has(`${x},${y}`)) continue;
      cells.push({ x, y });
    }
  }

  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  return cells.slice(0, count);
}
