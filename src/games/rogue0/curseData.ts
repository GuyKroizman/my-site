// Pure curse data. No runtime imports, so entity.ts and curses.ts can both
// reference names/descriptions/tables without creating a dependency cycle.

export type CurseId = "displacement" | "multiplicity";

export type CurseSlot = "weapon" | "armor" | "ring";

export const CURSE_NAMES: Record<CurseId, string> = {
  displacement: "Displacement",
  multiplicity: "Multiplicity",
};

export const CURSE_FLAVOR: Record<CurseId, string> = {
  displacement:
    "When you are attacked, this armor may teleport you to a random nearby location.",
  multiplicity:
    "When you are attacked, this armor may create a mirror image of you that enemies can target.",
};

// Which curses each slot can roll. Weapon and ring curses are specified in
// PLAN.md but not implemented yet; only armor curses exist in this slice, so
// weapons/rings are never generated cursed (a locked slot must always have an
// observable penalty).
export const CURSE_TABLES: Record<CurseSlot, CurseId[]> = {
  weapon: [],
  armor: ["displacement", "multiplicity"],
  ring: [],
};

// Chance a freshly generated eligible item is cursed.
export const CURSE_GENERATION_CHANCE = 0.25;
// Chance an armor curse procs on a successful enemy hit against the wearer.
export const CURSE_PROC_CHANCE = 0.2;
