// Per-floor boss identity. Boss floors still share the single-hall generator,
// sparse loot and no-reinforcement policy; this module only decides *which*
// encounter owns a floor and how that floor is cleared.
import {
  BOSS_FLOOR_LAYOUTS,
  type BossArenaLayout,
} from './bossArenas.ts';

export type BossEncounterKind = 'maw' | 'wandFactory';
export type BossWinCondition = 'boss-slain' | 'all-hostiles-cleared';

export type BossEncounter = {
  kind: BossEncounterKind;
  layout: BossArenaLayout;
  win: BossWinCondition;
};

const BOSS_ENCOUNTERS: Readonly<Record<number, BossEncounter>> = {
  5: { kind: 'maw', layout: BOSS_FLOOR_LAYOUTS[5], win: 'boss-slain' },
  10: { kind: 'wandFactory', layout: BOSS_FLOOR_LAYOUTS[10], win: 'all-hostiles-cleared' },
  // The Writhing Maw is a placeholder here until these floors get their own
  // encounters (PLAN.md, Phase 8).
  15: { kind: 'maw', layout: BOSS_FLOOR_LAYOUTS[15], win: 'boss-slain' },
  20: { kind: 'maw', layout: BOSS_FLOOR_LAYOUTS[20], win: 'boss-slain' },
  25: { kind: 'maw', layout: BOSS_FLOOR_LAYOUTS[25], win: 'boss-slain' }
};

export function bossEncounter(floor: number): BossEncounter | undefined {
  return BOSS_ENCOUNTERS[floor];
}

export function isMawFloor(floor: number): boolean {
  return bossEncounter(floor)?.kind === 'maw';
}

export function isWandFactoryFloor(floor: number): boolean {
  return bossEncounter(floor)?.kind === 'wandFactory';
}

/** Structural context: hostile monsters, never items, corpses or friendly decoys. */
type HostileLike = {
  type?: string;
  healthPoints?: number;
  isDecoy?: boolean;
  friendly?: boolean;
};

export function hasLivingHostiles(context: { entities?: readonly HostileLike[] }): boolean {
  return (context.entities ?? []).some((entity) =>
    entity.type === 'enemy' && (entity.healthPoints ?? 0) > 0 &&
    entity.isDecoy !== true && entity.friendly !== true);
}
