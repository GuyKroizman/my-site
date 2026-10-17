import { isBlocking, type FeaturePlacement, type TrapKind } from "./tiles";

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
  features: FeaturePlacement[];
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

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function orthoWalkableCount(map: number[][], x: number, y: number): number {
  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  let count = 0;
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= map[0].length || ny >= map.length) continue;
    if (map[ny][nx] === 0) count++;
  }
  return count;
}

function isRoomInterior(rooms: Room[], x: number, y: number): boolean {
  return rooms.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}

// Grows a small, contiguous blob of room-interior floor tiles for grass and
// water. The seed tile is added to `used` so features never overlap.
function growPatch(
  map: number[][],
  rooms: Room[],
  start: { x: number; y: number },
  size: number,
  used: Set<string>
): Array<{ x: number; y: number }> {
  const patch: Array<{ x: number; y: number }> = [start];
  used.add(`${start.x},${start.y}`);
  let frontier: Array<{ x: number; y: number }> = [start];

  while (patch.length < size && frontier.length > 0) {
    const next: Array<{ x: number; y: number }> = [];

    for (const tile of shuffle(frontier)) {
      const dirs = shuffle<[number, number]>([
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]);

      for (const [dx, dy] of dirs) {
        const nx = tile.x + dx;
        const ny = tile.y + dy;
        if (nx < 0 || ny < 0 || nx >= map[0].length || ny >= map.length) continue;
        if (map[ny][nx] !== 0) continue;
        if (!isRoomInterior(rooms, nx, ny)) continue;

        const k = `${nx},${ny}`;
        if (used.has(k)) continue;

        used.add(k);
        const cell = { x: nx, y: ny };
        patch.push(cell);
        next.push(cell);
        if (patch.length >= size) break;
      }

      if (patch.length >= size) break;
    }

    frontier = next;
  }

  return patch;
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
      cy: Math.floor(y + h / 2)
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

  // --- Terrain feature placement (procedural floors only) ---
  const features: FeaturePlacement[] = [];
  const used = new Set<string>();

  const corridorTiles: Array<{ x: number; y: number }> = [];
  const roomTiles: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (map[y][x] !== 0) continue;
      if (isRoomInterior(rooms, x, y)) {
        roomTiles.push({ x, y });
      } else {
        corridorTiles.push({ x, y });
      }
    }
  }

  // Doors on corridor tiles. They block until opened, which is intentional;
  // dead-end corridor tiles are avoided so a door never guards nothing.
  const doorCandidates = shuffle(
    corridorTiles.filter((t) => orthoWalkableCount(map, t.x, t.y) >= 2)
  );
  const doorCount = Math.min(3, doorCandidates.length);
  for (let i = 0; i < doorCount; i++) {
    const { x, y } = doorCandidates[i];
    features.push({ x, y, feature: "door" });
    used.add(`${x},${y}`);
  }

  // 1-3 grass patches inside rooms.
  const grassPatchCount = 1 + Math.floor(Math.random() * 3);
  for (let p = 0; p < grassPatchCount; p++) {
    const seed = shuffle(roomTiles.filter((t) => !used.has(`${t.x},${t.y}`)))[0];
    if (!seed) break;
    const size = 2 + Math.floor(Math.random() * 3); // 2..4 tiles
    const patch = growPatch(map, rooms, seed, size, used);
    for (const t of patch) {
      features.push({ x: t.x, y: t.y, feature: "grass" });
    }
  }

  // 1-2 water pools inside rooms.
  const waterPatchCount = 1 + Math.floor(Math.random() * 2);
  for (let p = 0; p < waterPatchCount; p++) {
    const seed = shuffle(roomTiles.filter((t) => !used.has(`${t.x},${t.y}`)))[0];
    if (!seed) break;
    const size = 2 + Math.floor(Math.random() * 2); // 2..3 tiles
    const patch = growPatch(map, rooms, seed, size, used);
    for (const t of patch) {
      features.push({ x: t.x, y: t.y, feature: "water" });
    }
  }

  // A couple of hidden traps.
  const trapKinds: TrapKind[] = ["dart", "fire", "frost", "teleport"];
  const trapCount = 2;
  for (let i = 0; i < trapCount; i++) {
    const tile = shuffle(roomTiles.filter((t) => !used.has(`${t.x},${t.y}`)))[0];
    if (!tile) break;
    features.push({
      x: tile.x,
      y: tile.y,
      feature: "trap",
      trap: "hidden",
      trapKind: trapKinds[Math.floor(Math.random() * trapKinds.length)]
    });
    used.add(`${tile.x},${tile.y}`);
  }

  // Optional chasm in a room corner/dead-end so it never severs the only
  // corridor between rooms.
  if (Math.random() < 0.7) {
    const chasmCandidates = shuffle(
      roomTiles.filter(
        (t) =>
          !used.has(`${t.x},${t.y}`) && orthoWalkableCount(map, t.x, t.y) <= 2
      )
    );
    const tile =
      chasmCandidates[0] ??
      shuffle(roomTiles.filter((t) => !used.has(`${t.x},${t.y}`)))[0];
    if (tile) {
      features.push({ x: tile.x, y: tile.y, feature: "chasm" });
      used.add(`${tile.x},${tile.y}`);
    }
  }

  return { map, rooms, features };
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
      [0, -1]
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
      if (isBlocking(x, y)) continue;
      cells.push({ x, y });
    }
  }

  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  return cells.slice(0, count);
}
