// Per-floor boss halls. Floors 5, 10, 15, 20 and 25 each get their own plan,
// so the run's five guardians are fought in five recognisably different rooms
// instead of one repeated arena.
//
// Layouts are written in hall-local coordinates with the standard map in mind
// (80x50, which leaves a 72x36 span inside the rock border). mapgen clamps the
// footprint to whatever space is left and centres it, so the hall keeps its
// guardian on the map centre and its hidden north branch above the wall.

export type BossArenaLayoutId =
  | 'colonnade'
  | 'longHall'
  | 'octagon'
  | 'cross'
  | 'throne';

export type BossArenaLayout = {
  id: BossArenaLayoutId;
  name: string;
  /** Hall footprint on the standard map. */
  width: number;
  height: number;
  /**
   * Hall-local wall test. `w`/`h` are the hall's actual (possibly clamped)
   * size, so shape rules can scale while fixed pillars stay where they are.
   */
  solid(lx: number, ly: number, w: number, h: number): boolean;
};

// A run of square pillar blocks, each `size` tiles across.
function pillarBlocks(
  positions: Array<[number, number]>,
  size = 2
): (lx: number, ly: number) => boolean {
  return (lx, ly) =>
    positions.some(
      ([bx, by]) =>
        lx >= bx && lx < bx + size && ly >= by && ly < by + size
    );
}

const combined =
  (...tests: Array<(lx: number, ly: number, w: number, h: number) => boolean>) =>
  (lx: number, ly: number, w: number, h: number): boolean =>
    tests.some((test) => test(lx, ly, w, h));

// Floor 5 — the introductory arena. A square hall with four 2x2 pillars set
// exactly 10 walkable tiles apart: the room the first guardian is built for.
const COLONNADE: BossArenaLayout = {
  id: 'colonnade',
  name: 'Pillared Rotunda',
  width: 16,
  height: 16,
  solid: pillarBlocks([
    [1, 1],
    [13, 1],
    [1, 13],
    [13, 13]
  ])
};

// Floor 10 — a long hall split by two rows of three pillars. The centre aisle
// runs from the hero's southern entrance straight to the guardian, and the
// side bays let a ranged fight open up around the columns.
const LONG_HALL: BossArenaLayout = {
  id: 'longHall',
  name: 'Long Colonnade',
  width: 24,
  height: 14,
  solid: pillarBlocks([
    [3, 2],
    [10, 2],
    [17, 2],
    [3, 9],
    [10, 9],
    [17, 9]
  ])
};

// Floor 15 — an octagonal sanctum: the four corners are chamfered away, and
// four obelisks mark the inner corners of the octagon.
const OCTAGON: BossArenaLayout = {
  id: 'octagon',
  name: 'Octagonal Sanctum',
  width: 18,
  height: 18,
  solid: combined(
    (lx, ly, w, h) => {
      // Triangular corner cuts make the octagon.
      const dx = Math.min(lx, w - 1 - lx);
      const dy = Math.min(ly, h - 1 - ly);
      return dx + dy < 3;
    },
    pillarBlocks([
      [4, 4],
      [12, 4],
      [4, 12],
      [12, 12]
    ])
  )
};

// Floor 20 — a cruciform vault: four square corner masses leave a plus-shaped
// room, and a ring of pillars frames the guardian at the crossing.
const CROSS: BossArenaLayout = {
  id: 'cross',
  name: 'Cruciform Vault',
  width: 20,
  height: 20,
  solid: combined(
    (lx, ly, w, h) => {
      const cut = 6;
      const inCornerX = lx < cut || lx >= w - cut;
      const inCornerY = ly < cut || ly >= h - cut;
      return inCornerX && inCornerY;
    },
    pillarBlocks([
      [6, 6],
      [12, 6],
      [6, 12],
      [12, 12]
    ])
  )
};

// Floor 25 — the final throne hall. A full colonnade ring: corner piers plus a
// pier in the middle of every side, so the last fight happens in a circuit of
// eight columns.
const THRONE: BossArenaLayout = {
  id: 'throne',
  name: 'Throne Hall',
  width: 20,
  height: 20,
  solid: pillarBlocks([
    [2, 2],
    [16, 2],
    [2, 16],
    [16, 16],
    [8, 2],
    [8, 16],
    [2, 8],
    [16, 8]
  ])
};

// One layout per boss floor, in floor order: 5, 10, 15, 20, 25.
export const BOSS_ARENA_LAYOUTS: readonly BossArenaLayout[] = [
  COLONNADE,
  LONG_HALL,
  OCTAGON,
  CROSS,
  THRONE
];

export const BOSS_FLOOR_STEP = 5;

/** Index into BOSS_ARENA_LAYOUTS for a boss floor (5 -> 0, 10 -> 1, ...). */
export function bossArenaLayoutIndex(floor: number): number {
  const n = BOSS_ARENA_LAYOUTS.length;
  const step = Math.floor((floor - 1) / BOSS_FLOOR_STEP);
  return ((step % n) + n) % n;
}

export function bossArenaLayout(floor: number): BossArenaLayout {
  return BOSS_ARENA_LAYOUTS[bossArenaLayoutIndex(floor)];
}
