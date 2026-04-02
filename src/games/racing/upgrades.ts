export type UpgradeId = 'gun' | 'mines' | 'turbo_boost' | 'tire_upgrade' | 'ram' | 'nothing'

export interface UpgradeOption {
  id: UpgradeId
  name: string
  description: string
  icon: string
  repeatable: boolean
}

export interface PlayerUpgrades {
  hasGun: boolean
  hasMines: boolean
  hasTurboBoost: boolean
  hasTireUpgrade: boolean
  hasRam: boolean
  speedMultiplier: number
  turnSpeedMultiplier: number
  selectedIds: Set<UpgradeId>
}

export const DEFAULT_PLAYER_UPGRADES: PlayerUpgrades = {
  hasGun: false,
  hasMines: false,
  hasTurboBoost: false,
  hasTireUpgrade: false,
  hasRam: false,
  speedMultiplier: 1.0,
  turnSpeedMultiplier: 1.0,
  selectedIds: new Set(),
}

export const UPGRADE_POOL: UpgradeOption[] = [
  {
    id: 'gun',
    name: 'Machine Gun',
    description: 'Shoot forward to damage rivals. Car 15% slower.',
    icon: '\u{1F52B}',
    repeatable: false,
  },
  {
    id: 'mines',
    name: 'Drop Mines',
    description: 'Fire drops a mine behind your car. Activates after 2s. Hurts everyone including you!',
    icon: '\u{1F4A3}',
    repeatable: false,
  },
  {
    id: 'turbo_boost',
    name: 'Turbo Boost',
    description: 'Press fire for a short speed burst. 3s cooldown.',
    icon: '\u{1F680}',
    repeatable: false,
  },
  {
    id: 'tire_upgrade',
    name: 'Tire Upgrade',
    description: 'Better cornering. Turn speed +20%.',
    icon: '\u{1F6DE}',
    repeatable: false,
  },
  {
    id: 'ram',
    name: 'Ram Reinforcement',
    description: 'Collisions damage other cars and push them harder.',
    icon: '\u{1F6E1}',
    repeatable: false,
  },
  {
    id: 'nothing',
    name: 'Change Nothing',
    description: 'Proceed to the next race without modifications.',
    icon: '\u27A1\uFE0F',
    repeatable: true,
  },
]

export function applyUpgrade(current: PlayerUpgrades, upgradeId: UpgradeId): PlayerUpgrades {
  const newSelectedIds = new Set(current.selectedIds)
  if (upgradeId !== 'nothing') {
    newSelectedIds.add(upgradeId)
  }

  switch (upgradeId) {
    case 'gun':
      return { ...current, hasGun: true, speedMultiplier: current.speedMultiplier * 0.85, selectedIds: newSelectedIds }
    case 'mines':
      return { ...current, hasMines: true, selectedIds: newSelectedIds }
    case 'turbo_boost':
      return { ...current, hasTurboBoost: true, selectedIds: newSelectedIds }
    case 'tire_upgrade':
      return { ...current, hasTireUpgrade: true, turnSpeedMultiplier: current.turnSpeedMultiplier * 1.2, selectedIds: newSelectedIds }
    case 'ram':
      return { ...current, hasRam: true, selectedIds: newSelectedIds }
    case 'nothing':
      return { ...current, selectedIds: newSelectedIds }
  }
}

export function getAvailableOptions(current: PlayerUpgrades): UpgradeOption[] {
  return UPGRADE_POOL.filter(opt => opt.repeatable || !current.selectedIds.has(opt.id))
}

export function selectThreeOptions(current: PlayerUpgrades): UpgradeOption[] {
  const available = getAvailableOptions(current)
  const nonNothing = available.filter(o => o.id !== 'nothing')
  const nothing = available.find(o => o.id === 'nothing')!

  // Shuffle non-nothing options and pick 2
  const shuffled = [...nonNothing].sort(() => Math.random() - 0.5)
  const picked = shuffled.slice(0, 2)

  return [...picked, nothing]
}
