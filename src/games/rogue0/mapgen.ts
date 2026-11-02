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
  secretRoom?: Room;
};

function carve(map: number[][], room: Room): void {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      map[y][x] = 0;
    }
  }
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Builds the tile sequence of an L-shaped corridor between two points.
// `horizontalFirst` controls which arm runs first; the order matches the
// order the tiles are carved.
function carveLPath(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  horizontalFirst: boolean
): Array<[number, number]> {
  const path: Array<[number, number]> = [];
  let x = ax;
  let y = ay;

  const carveTo = (tx: number, ty: number) => {
    while (x !== tx) {
      path.push([x, y]);
      x += Math.sign(tx - x);
    }
    while (y !== ty) {
      path.push([x, y]);
      y += Math.sign(ty - y);
    }
  };

  if (horizontalFirst) {
    carveTo(bx, ay);
    carveTo(bx, by);
  } else {
    carveTo(ax, by);
    carveTo(bx, by);
  }

  path.push([bx, by]);
  return path;
}

function connect(map: number[][], a: Room, b: Room, doorways: Set<string>): void {
  const horizontalFirst = Math.random() < 0.5;
  const path = carveLPath(a.cx, a.cy, b.cx, b.cy, horizontalFirst);
  for (const [x, y] of path) map[y][x] = 0;

  const exitA = exitDoorwayFromPath(a, path);
  const enterB = enterDoorwayFromPath(b, path);
  if (exitA) doorways.add(`${exitA.x},${exitA.y}`);
  if (enterB) doorways.add(`${enterB.x},${enterB.y}`);
}

function insideRoom(room: Room, x: number, y: number): boolean {
  return x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
}

// The first corridor tile outside `room` after a carved path leaves it;
// the wall opening where the corridor exits the room.
function exitDoorwayFromPath(room: Room, path: Array<[number, number]>): { x: number; y: number } | null {
  for (const [x, y] of path) {
    if (!insideRoom(room, x, y)) return { x, y };
  }
  return null;
}

// The last corridor tile outside `room` before a carved path enters it;
// the wall opening where the corridor enters the room.
function enterDoorwayFromPath(room: Room, path: Array<[number, number]>): { x: number; y: number } | null {
  let lastOutside: { x: number; y: number } | null = null;
  for (const [x, y] of path) {
    if (insideRoom(room, x, y)) return lastOutside;
    lastOutside = { x, y };
  }
  return null;
}

function roomOverlaps(a: Room, b: Room): boolean {
  return (
    a.x < b.x + b.w + 1 &&
    a.x + a.w + 1 > b.x &&
    a.y < b.y + b.h + 1 &&
    a.y + a.h + 1 > b.y
  );
}

// --- Organic chasm shape generation -----------------------------------------

// Deterministic value noise (and fBm) so chasm outlines are organic but
// stable for a given floor seed.
function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  const ux = smoothstep(fx);
  const uy = smoothstep(fy);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, seed: number): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  for (let octave = 0; octave < 3; octave++) {
    value += amplitude * valueNoise(x * frequency, y * frequency, seed + octave * 101);
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / total;
}

// Carves an organic chasm into the interior of a room. The border stays a
// walkable ring; value noise plus a radial bias splits the interior into chasm
// and floor, then any floor pocket sealed off from the ring is sunk so the
// room never gains an unreachable island.
function growOrganicChasm(room: Room, seed: number): Set<string> {
  const margin = 2;
  const x0 = room.x + margin;
  const y0 = room.y + margin;
  const x1 = room.x + room.w - margin;
  const y1 = room.y + room.h - margin;

  const chasm = new Set<string>();
  const cx = room.cx;
  const cy = room.cy;
  const rx = Math.max(1, (x1 - x0) / 2);
  const ry = Math.max(1, (y1 - y0) / 2);

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const n = fbm(x * 0.16, y * 0.16, seed);
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const radial = Math.max(0, 1 - (dx * dx + dy * dy));
      // Noise shapes the boundary; the radial core guarantees the chasm is
      // always a substantial central mass rather than a stray speck.
      const value = n * 0.55 + radial * 0.45;
      if (value > 0.5 || radial > 0.6) chasm.add(`${x},${y}`);
    }
  }

  if (chasm.size === 0) return chasm;

  // Keep only the largest chasm mass so the feature reads as one big hole
  // rather than a scatter of disconnected pits.
  const unvisited = new Set(chasm);
  let largest: string[] = [];
  while (unvisited.size > 0) {
    const first = unvisited.values().next().value as string;
    const queue = [first];
    unvisited.delete(first);
    const comp: string[] = [];
    for (let i = 0; i < queue.length; i++) {
      comp.push(queue[i]);
      const [x, y] = queue[i].split(",").map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const k = `${x + dx},${y + dy}`;
        if (unvisited.has(k)) {
          unvisited.delete(k);
          queue.push(k);
        }
      }
    }
    if (comp.length > largest.length) largest = comp;
  }
  chasm.clear();
  for (const k of largest) chasm.add(k);

  // Flood from every ring tile to find interior floor that stays reachable.
  const reachable = new Set<string>();
  const queue: Array<[number, number]> = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (x < x0 || x >= x1 || y < y0 || y >= y1) {
        const k = `${x},${y}`;
        if (reachable.has(k)) continue;
        reachable.add(k);
        queue.push([x, y]);
      }
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < room.x || ny < room.y || nx >= room.x + room.w || ny >= room.y + room.h) continue;
      const k = `${nx},${ny}`;
      if (chasm.has(k) || reachable.has(k)) continue;
      reachable.add(k);
      queue.push([nx, ny]);
    }
  }
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const k = `${x},${y}`;
      if (!chasm.has(k) && !reachable.has(k)) chasm.add(k);
    }
  }

  return chasm;
}

// --- Chasm-aware room connection --------------------------------------------

// Shortest carved path between two points that routes around `forbidden` tiles
// (the chasm interior). Walls are fair game: they become corridor.
function bfsConnectPath(
  map: number[][],
  forbidden: Set<string>,
  sx: number,
  sy: number,
  tx: number,
  ty: number
): Array<[number, number]> | null {
  const h = map.length;
  const w = map[0].length;
  const startKey = `${sx},${sy}`;
  const targetKey = `${tx},${ty}`;
  if (forbidden.has(startKey) || forbidden.has(targetKey)) return null;

  const prev = new Map<string, string>([[startKey, ""]]);
  const queue: Array<[number, number]> = [[sx, sy]];

  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    if (x === tx && y === ty) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const k = `${nx},${ny}`;
      if (forbidden.has(k) || prev.has(k)) continue;
      prev.set(k, `${x},${y}`);
      queue.push([nx, ny]);
    }
  }

  if (!prev.has(targetKey)) return null;
  const path: Array<[number, number]> = [];
  let cur = targetKey;
  while (cur !== startKey) {
    const [x, y] = cur.split(",").map(Number);
    path.push([x, y]);
    cur = prev.get(cur)!;
  }
  path.reverse();
  return path;
}

// Connects every anchor into one network. Corridors are shortest paths that
// avoid `forbidden`, so rooms can surround the chasm chamber freely.
function connectRoomsSpanning(
  map: number[][],
  anchors: Array<{ x: number; y: number }>,
  forbidden: Set<string>,
  rooms: Room[],
  chasmRoom: Room | undefined,
  doorways: Set<string>
): void {
  if (anchors.length < 2) return;
  const connected = new Set<number>([0]);

  const roomFor = (i: number): Room | undefined =>
    i < rooms.length ? rooms[i] : chasmRoom;

  while (connected.size < anchors.length) {
    let best: { ci: number; ui: number; d: number } | null = null;
    for (const ci of connected) {
      for (let ui = 0; ui < anchors.length; ui++) {
        if (connected.has(ui)) continue;
        const d =
          Math.abs(anchors[ci].x - anchors[ui].x) +
          Math.abs(anchors[ci].y - anchors[ui].y);
        if (!best || d < best.d) best = { ci, ui, d };
      }
    }
    if (!best) break;

    const path = bfsConnectPath(
      map,
      forbidden,
      anchors[best.ci].x,
      anchors[best.ci].y,
      anchors[best.ui].x,
      anchors[best.ui].y
    );
    if (path) {
      for (const [x, y] of path) map[y][x] = 0;

      const startRoom = roomFor(best.ci);
      const endRoom = roomFor(best.ui);
      if (startRoom) {
        const doorway = exitDoorwayFromPath(startRoom, path);
        if (doorway) doorways.add(`${doorway.x},${doorway.y}`);
      }
      if (endRoom) {
        const doorway = enterDoorwayFromPath(endRoom, path);
        if (doorway) doorways.add(`${doorway.x},${doorway.y}`);
      }
    }
    connected.add(best.ui);
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

// Returns true when every walkable floor tile (map === 0) not listed in
// `blocked` is reachable from any other via cardinal steps. Chasms are the
// only permanently blocking feature for this check: doors can be opened, and
// grass/water/traps do not block ground travel.
function isFloorConnected(map: number[][], blocked: Set<string>): boolean {
  const h = map.length;
  const w = map[0].length;
  let sx = -1;
  let sy = -1;
  for (let y = 0; y < h && sx < 0; y++) {
    for (let x = 0; x < w; x++) {
      if (map[y][x] === 0 && !blocked.has(`${x},${y}`)) {
        sx = x;
        sy = y;
        break;
      }
    }
  }
  if (sx < 0) return true;

  const visited = new Set<string>([`${sx},${sy}`]);
  const queue: Array<[number, number]> = [[sx, sy]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (map[ny][nx] !== 0) continue;
      const key = `${nx},${ny}`;
      if (blocked.has(key) || visited.has(key)) continue;
      visited.add(key);
      queue.push([nx, ny]);
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (map[y][x] === 0 && !blocked.has(`${x},${y}`) && !visited.has(`${x},${y}`)) {
        return false;
      }
    }
  }
  return true;
}

// Grows an irregular chasm patch inside rooms. Growth is a random walk over
// fresh room-interior floor, so patches take different sizes and organic
// shapes instead of a fixed single tile. Reserved tiles (room centres and the
// future secret-corridor approach) are never consumed.
function growChasmPatch(
  map: number[][],
  rooms: Room[],
  reserved: Set<string>,
  start: { x: number; y: number },
  size: number,
  used: Set<string>
): Array<{ x: number; y: number }> {
  const patch: Array<{ x: number; y: number }> = [start];
  used.add(`${start.x},${start.y}`);
  const tips: Array<{ x: number; y: number }> = [start];

  let guard = 0;
  while (patch.length < size && tips.length > 0 && guard++ < size * 8) {
    const tip = tips[Math.floor(Math.random() * tips.length)];
    const dirs = shuffle<[number, number]>([
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]);

    let grew = false;
    for (const [dx, dy] of dirs) {
      const nx = tip.x + dx;
      const ny = tip.y + dy;
      if (nx < 0 || ny < 0 || nx >= map[0].length || ny >= map.length) continue;
      if (map[ny][nx] !== 0) continue;
      if (!isRoomInterior(rooms, nx, ny)) continue;
      const key = `${nx},${ny}`;
      if (used.has(key) || reserved.has(key)) continue;

      used.add(key);
      const cell = { x: nx, y: ny };
      patch.push(cell);
      tips.push(cell);
      grew = true;
      break;
    }

    if (!grew) {
      const idx = tips.indexOf(tip);
      if (idx >= 0) tips.splice(idx, 1);
    }
  }

  return patch;
}

// Carves an organic room instead of a plain rectangle. The same value-noise
// fBm used for chasms decides floor vs wall, with a radial bias toward the
// room centre so the shape stays one coherent cavern. Only the floor component
// containing the corridor anchor is kept, so the room can never gain a
// sealed-off pocket.
function carveOrganicRoom(map: number[][], room: Room, seed: number): void {
  const x0 = room.x;
  const y0 = room.y;
  const x1 = room.x + room.w;
  const y1 = room.y + room.h;
  const cx = room.cx;
  const cy = room.cy;
  const rx = Math.max(1, (x1 - x0) / 2);
  const ry = Math.max(1, (y1 - y0) / 2);

  const floor = new Set<string>();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const n = fbm(x * 0.16, y * 0.16, seed);
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const radial = Math.max(0, 1 - (dx * dx + dy * dy));
      const value = n * 0.55 + radial * 0.45;
      // Same noise/radial test the chasms use, inverted: the central mass and
      // noise extensions become floor, while the outer fringe stays wall.
      if (value > 0.5 || radial > 0.6) floor.add(`${x},${y}`);
    }
  }

  // The corridor anchor must always be floor.
  floor.add(`${cx},${cy}`);

  // Keep only the floor component reachable from the centre. Any isolated
  // pockets produced by the noise stay as wall.
  const kept = new Set<string>([`${cx},${cy}`]);
  const queue: Array<[number, number]> = [[cx, cy]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < x0 || ny < y0 || nx >= x1 || ny >= y1) continue;
      const k = `${nx},${ny}`;
      if (!floor.has(k) || kept.has(k)) continue;
      kept.add(k);
      queue.push([nx, ny]);
    }
  }

  for (const k of kept) {
    const [x, y] = k.split(",").map(Number);
    map[y][x] = 0;
  }
}

// True when every floor tile inside a room is one connected 4-neighbour mass.
// Used to reject pillar placements that would split the room in two.
function isRoomFloorConnected(map: number[][], room: Room): boolean {
  const x0 = room.x;
  const y0 = room.y;
  const x1 = room.x + room.w;
  const y1 = room.y + room.h;

  let sx = -1;
  let sy = -1;
  let total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (map[y][x] === 0) {
        total++;
        if (sx < 0) {
          sx = x;
          sy = y;
        }
      }
    }
  }
  if (sx < 0) return true;

  const visited = new Set<string>([`${sx},${sy}`]);
  const queue: Array<[number, number]> = [[sx, sy]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < x0 || ny < y0 || nx >= x1 || ny >= y1) continue;
      if (map[ny][nx] !== 0) continue;
      const k = `${nx},${ny}`;
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push([nx, ny]);
    }
  }
  return visited.size === total;
}

// Adds free-standing wall tiles (pillars) to a room. Pillars stay clear of the
// corridor anchor and its immediate doorway, never touch each other, and are
// reverted if they would cut the room floor into separate pieces.
function addPillars(map: number[][], room: Room, maxPillars: number): void {
  const x0 = room.x;
  const y0 = room.y;
  const x1 = room.x + room.w;
  const y1 = room.y + room.h;

  const reserved = new Set<string>([`${room.cx},${room.cy}`]);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    reserved.add(`${room.cx + dx},${room.cy + dy}`);
  }

  const candidates: Array<[number, number]> = [];
  for (let y = y0 + 1; y < y1 - 1; y++) {
    for (let x = x0 + 1; x < x1 - 1; x++) {
      if (map[y][x] !== 0) continue;
      if (reserved.has(`${x},${y}`)) continue;
      candidates.push([x, y]);
    }
  }
  shuffle(candidates);

  const pillars: Array<[number, number]> = [];
  for (const [x, y] of candidates) {
    if (pillars.length >= maxPillars) break;
    if (pillars.some(([px, py]) => Math.abs(px - x) + Math.abs(py - y) === 1)) continue;

    map[y][x] = 1;
    if (!isRoomFloorConnected(map, room)) {
      map[y][x] = 0;
      continue;
    }
    pillars.push([x, y]);
  }
}

export function generateMap(floor = 1): GeneratedMap {
  // The introductory floor has half the area and half the rooms.
  const width = floor === 1 ? 50 : MAP_WIDTH;
  const height = floor === 1 ? 40 : MAP_HEIGHT;
  const map: number[][] = Array.from({ length: height }, () =>
    Array(width).fill(1)
  );
  const rooms: Room[] = [];

  // Floors 6+ carve a big chasm chamber at a random spot: a walkable ring
  // around a noise-shaped chasm. Regular rooms fill the rest of the map and a
  // spanning network of corridors links everything without crossing the chasm.
  const bigChasm = floor >= 6;
  let chasmRoom: Room | undefined;
  let chasmTiles: Set<string> | undefined;

  if (bigChasm) {
    const roomW = 14 + Math.floor(Math.random() * 11); // 14..24 wide
    const roomH = 10 + Math.floor(Math.random() * 9); // 10..18 tall
    const x = clampInt(
      2 + Math.floor(Math.random() * Math.max(1, width - roomW - 3)),
      2,
      width - roomW - 2
    );
    const y = clampInt(
      12 + Math.floor(Math.random() * Math.max(1, height - roomH - 13)),
      12,
      height - roomH - 2
    );

    chasmRoom = {
      x,
      y,
      w: roomW,
      h: roomH,
      cx: Math.floor(x + roomW / 2),
      cy: Math.floor(y + roomH / 2)
    };
    carve(map, chasmRoom);
    chasmTiles = growOrganicChasm(chasmRoom, Math.floor(Math.random() * 1_000_000));
  }

  const maxRooms = floor === 1 ? 7 : 14;
  const maxAttempts = 200;

  for (
    let attempt = 0;
    attempt < maxAttempts && rooms.length < maxRooms;
    attempt++
  ) {
    const w = 4 + Math.floor(Math.random() * 8);
    const h = 4 + Math.floor(Math.random() * 6);
    const x = 1 + Math.floor(Math.random() * (width - w - 2));
    // Reserve space for the hidden corridor and a walled 3x3 treasure room.
    const y = 10 + Math.floor(Math.random() * (height - h - 11));

    const room: Room = {
      x,
      y,
      w,
      h,
      cx: Math.floor(x + w / 2),
      cy: Math.floor(y + h / 2)
    };

    const overlaps =
      (chasmRoom ? roomOverlaps(room, chasmRoom) : false) ||
      rooms.some((r) => roomOverlaps(room, r));

    if (overlaps) continue;

    // Floors 6+ start to vary: some rooms get organic noise-shaped
    // outlines and some get free-standing pillars.
    const organic =
      floor >= 6 && room.w >= 6 && room.h >= 5 && Math.random() < 0.5;
    if (organic) {
      carveOrganicRoom(map, room, Math.floor(Math.random() * 1_000_000));
    } else {
      carve(map, room);
    }

    rooms.push(room);

    if (floor >= 6 && Math.random() < 0.45) {
      addPillars(map, room, 1 + Math.floor(Math.random() * 3));
    }
  }

  // Doorways are tracked while corridors are carved so each room entrance can
  // get a door exactly once, including organic rooms and the chasm chamber.
  const doorways = new Set<string>();

  if (bigChasm && chasmRoom && chasmTiles) {
    // Regular rooms anchor on their centres; the chasm chamber anchors on its
    // walkable ring so corridors enter the room without touching the chasm.
    const anchors = [
      ...rooms.map((r) => ({ x: r.cx, y: r.cy })),
      { x: chasmRoom.x + 1, y: chasmRoom.cy }
    ];
    connectRoomsSpanning(map, anchors, chasmTiles, rooms, chasmRoom, doorways);
  } else {
    for (let i = 1; i < rooms.length; i++) {
      connect(map, rooms[i - 1], rooms[i], doorways);
    }
  }

  if (chasmRoom) rooms.push(chasmRoom);

  // --- Terrain feature placement (procedural floors only) ---
  const features: FeaturePlacement[] = [];
  const used = new Set<string>();

  const roomTiles: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (map[y][x] !== 0) continue;
      if (isRoomInterior(rooms, x, y)) {
        roomTiles.push({ x, y });
      }
    }
  }

  // The big chasm overlays the chamber's interior floor, leaving the
  // surrounding ring walkable. Reserve those tiles before doors and terrain
  // so nothing else ever spawns on the chasm.
  if (chasmTiles) {
    for (const key of chasmTiles) {
      const [x, y] = key.split(",").map(Number);
      features.push({ x, y, feature: "chasm" });
      used.add(key);
    }
  }

  // A closed door marks every entrance where a corridor meets a room. The
  // doorway set was built while corridors were carved, so each is a single
  // opening tile rather than a stretch of corridor running beside a room.
  for (const key of doorways) {
    const [x, y] = key.split(",").map(Number);
    if (map[y]?.[x] !== 0) continue;
    features.push({ x, y, feature: "door" });
    used.add(key);
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
  const trapKinds: TrapKind[] = ["dart", "fire", "frost", "teleport", "summon", "alarm", "geyser", "confusion"];
  const trapCount = 2;
  for (let i = 0; i < trapCount; i++) {
    const tile = shuffle(roomTiles.filter((t) => !used.has(`${t.x},${t.y}`)))[0];
    if (!tile) break;
    const trapKind = trapKinds[Math.floor(Math.random() * trapKinds.length)];
    features.push({
      x: tile.x,
      y: tile.y,
      feature: "trap",
      trap: "hidden",
      trapKind,
      trapReusable: trapKind === "frost" || trapKind === "teleport" || trapKind === "alarm"
    });
    used.add(`${tile.x},${tile.y}`);
  }

  // Chasms come in varied multi-tile patches. Each candidate is grown inside
  // rooms and only committed when the floor, with that patch blocking ground
  // travel, stays fully connected — so a chasm can never cut the player off
  // from any reachable section of the map.
  const reserved = new Set(rooms.map((r) => `${r.cx},${r.cy}`));
  // Keep the small random chasm patches out of the big chasm chamber so its
  // ring remains a clean walkable loop around the one large chasm.
  if (chasmRoom) {
    for (let y = chasmRoom.y; y < chasmRoom.y + chasmRoom.h; y++) {
      for (let x = chasmRoom.x; x < chasmRoom.x + chasmRoom.w; x++) {
        reserved.add(`${x},${y}`);
      }
    }
  }
  const secretApproachY = map.findIndex((row) => row.includes(0));
  if (secretApproachY >= 0) {
    const secretApproachX = map[secretApproachY].indexOf(0);
    if (secretApproachX >= 0) reserved.add(`${secretApproachX},${secretApproachY}`);
  }

  const chasmPatchCount = 1 + (Math.random() < 0.4 ? 1 : 0);
  for (let p = 0; p < chasmPatchCount; p++) {
    const targetSize = 2 + Math.floor(Math.random() * 5); // 2..6 tiles
    const candidates = shuffle(
      roomTiles.filter(
        (t) => !used.has(`${t.x},${t.y}`) && !reserved.has(`${t.x},${t.y}`)
      )
    );

    let attempts = 0;
    for (const seed of candidates) {
      if (attempts++ >= 20) break;
      const trialUsed = new Set(used);
      const patch = growChasmPatch(map, rooms, reserved, seed, targetSize, trialUsed);
      if (patch.length < 2) continue;

      const blocked = new Set<string>();
      for (const t of patch) blocked.add(`${t.x},${t.y}`);
      // Previously committed chasm patches also block ground travel.
      for (const f of features) {
        if (f.feature === "chasm") blocked.add(`${f.x},${f.y}`);
      }

      if (!isFloorConnected(map, blocked)) continue;

      for (const t of patch) {
        features.push({ x: t.x, y: t.y, feature: "chasm" });
        used.add(`${t.x},${t.y}`);
      }
      break;
    }
  }

  // One visible pressure plate: unlike hidden status traps it can be used
  // deliberately by throwing an object onto it.
  const arrowTile = shuffle(roomTiles.filter(t => !used.has(`${t.x},${t.y}`)))[0];
  if (arrowTile) features.push({ ...arrowTile, feature: "trap", trap: "visible", trapKind: "arrow" });

  // The northernmost floor belongs to the connected dungeon. Above it the
  // reserved band is solid wall, so the branch cannot accidentally reconnect
  // around the secret. Keep two approach tiles, the searchable end wall,
  // and two hidden corridor tiles, then open into a small treasure room.
  const northY = map.findIndex(row => row.includes(0));
  let secretRoom: Room | undefined;
  if (northY >= 10) {
    const x = map[northY].indexOf(0);
    for (const offset of [1, 2, 4, 5]) map[northY - offset][x] = 0;
    features.push({ x, y: northY - 3, feature: "secretDoor" });
    const left = Math.max(1, Math.min(width - 4, x - 1));
    secretRoom = { x: left, y: northY - 8, w: 3, h: 3, cx: left + 1, cy: northY - 7 };
    carve(map, secretRoom);
    // Not in rooms: spawn/stairs and ordinary room terrain must stay outside.
  }

  return { map, rooms, features, secretRoom };
}

// BFS to find the farthest walkable tile reachable from a start point.
// `maxX` keeps important tiles out of the columns hidden under the sidebar.
export function findFarthestWalkable(
  map: number[][],
  sx: number,
  sy: number,
  maxX: number = MAP_WIDTH,
  blocked: (x: number, y: number) => boolean = () => false
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
      if (blocked(nx, ny)) continue;
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
