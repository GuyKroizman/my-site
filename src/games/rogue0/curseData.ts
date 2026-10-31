// Pure curse data. No runtime imports, so entity.ts and curses.ts can both
// reference names/descriptions/tables without creating a dependency cycle.

export type CurseId =
  // Weapon curses
  | "wayward" | "sacrificial" | "displacing" | "annoying" | "friendly" | "polarized" | "exhausting"
  // Armor curses
  | "displacement" | "multiplicity" | "anti-entropy" | "corrosion" | "stench"
  | "overgrowth" | "metabolism" | "bulk"
  // Ring curses
  | "inverted"
  // Wand curses
  | "backfiring"
  // Artifact curses
  | "corrupted";

export type CurseSlot = "weapon" | "armor" | "ring" | "wand" | "artifact";

export const CURSE_NAMES: Record<CurseId, string> = {
  wayward: "Wayward",
  sacrificial: "Sacrificial",
  displacing: "Displacing",
  annoying: "Annoying",
  friendly: "Friendly",
  polarized: "Polarized",
  exhausting: "Exhausting",
  displacement: "Displacement",
  multiplicity: "Multiplicity",
  "anti-entropy": "Anti-entropy",
  corrosion: "Corrosion",
  stench: "Stench",
  overgrowth: "Overgrowth",
  metabolism: "Metabolism",
  bulk: "Bulk",
  inverted: "Inverted",
  backfiring: "Backfiring",
  corrupted: "Corrupted",
};

export const CURSE_FLAVOR: Record<CurseId, string> = {
  wayward: "This weapon is wildly inaccurate; your attacks often miss.",
  sacrificial: "This weapon saps your life force when you strike.",
  displacing: "This weapon may teleport enemies away when you strike.",
  annoying: "This weapon draws nearby enemies to you when you strike.",
  friendly: "This weapon may charm enemies you strike, stopping them from attacking.",
  polarized: "This weapon deals wildly random damage.",
  exhausting: "This weapon may exhaust you when you strike.",
  displacement: "When you are attacked, this armor may teleport you to a random nearby location.",
  multiplicity: "When you are attacked, this armor may create a mirror image of you that enemies can target.",
  "anti-entropy": "When you are attacked, this armor may set you ablaze and freeze nearby enemies.",
  corrosion: "When you are attacked, this armor may splash you with caustic ooze.",
  stench: "When you are attacked, this armor may release a cloud of toxic gas.",
  overgrowth: "When you are attacked, this armor may make grass sprout around you.",
  metabolism: "This armor speeds your metabolism; you hunger much faster.",
  bulk: "This armor is heavy and bulky; you move more slowly.",
  inverted: "This ring's power is inverted, granting the opposite of its normal effect.",
  backfiring: "This wand is volatile; its magic may turn back on you when you zap.",
  corrupted: "This artifact's power is corrupted, working against you.",
};

// Which curses each slot can roll.
export const CURSE_TABLES: Record<CurseSlot, CurseId[]> = {
  weapon: ["wayward", "sacrificial", "displacing", "annoying", "friendly", "polarized", "exhausting"],
  armor: ["displacement", "multiplicity", "anti-entropy", "corrosion", "stench", "overgrowth", "metabolism", "bulk"],
  ring: ["inverted"],
  wand: ["backfiring"],
  artifact: ["corrupted"],
};

// Chance a freshly generated eligible item is cursed.
export const CURSE_GENERATION_CHANCE = 0.25;
// Chance a proc-based curse fires on its trigger (a successful hit).
export const CURSE_PROC_CHANCE = 0.2;
