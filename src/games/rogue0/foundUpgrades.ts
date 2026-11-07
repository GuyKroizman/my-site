// Upgrade levels for gear found in the dungeon.
//
// Armor, weapons and wands may be generated plain or already upgraded, but a
// floor find never exceeds +3. Later Scrolls of Upgrade / gems are a separate,
// uncapped progression. Pure module: no Phaser or dungeon dependencies, so
// generation and tests can share it.

import type { Entity } from './entity';

// Hard ceiling for a freshly generated item. Deeper floors do not raise it.
export const MAX_FOUND_UPGRADE = 3;

// Weights for found levels 0, +1, +2 and +3. Most gear is plain; +3 is rare.
export const FOUND_UPGRADE_WEIGHTS = [70, 20, 8, 2] as const;

const TOTAL_WEIGHT = FOUND_UPGRADE_WEIGHTS.reduce((sum, weight) => sum + weight, 0);

// Wands are backpack tools, so they are recognised by their wand texture key
// rather than an equipment slot. The Wizard's weapon-slot spell scrolls are
// starting gear and never generated as loot, so scroll names are excluded.
export function canBeFoundUpgraded(item: Entity): boolean {
  if (item.type !== 'item') return false;
  if (item.equipSlot === 'weapon' || item.equipSlot === 'armor') {
    return !/^scroll/i.test(item.name);
  }
  return !!item.textureKey?.startsWith('wand-');
}

// Roll a found upgrade for a freshly generated item and return its level.
// `random` is injectable so tests can force an outcome. Items that are not
// eligible, or that already carry an upgrade, are left untouched.
export function rollFoundUpgrade(item: Entity, random: () => number = Math.random): number {
  if (!canBeFoundUpgraded(item) || item.level > 0) return item.level;

  let roll = random() * TOTAL_WEIGHT;
  // Fall back to the top level so a (theoretical) random() === 1 still works.
  let level = FOUND_UPGRADE_WEIGHTS.length - 1;
  for (let index = 0; index < FOUND_UPGRADE_WEIGHTS.length; index++) {
    const weight = FOUND_UPGRADE_WEIGHTS[index];
    if (roll < weight) {
      level = index;
      break;
    }
    roll -= weight;
  }

  const cap = Math.min(MAX_FOUND_UPGRADE, Math.max(0, item.maxLevel));
  item.level = Math.min(level, cap);
  // Wands derive charge capacity and damage from the upgrade level.
  (item as Entity & { reconcileChargeScaling?: () => void }).reconcileChargeScaling?.();
  return item.level;
}
