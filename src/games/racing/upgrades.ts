export type UpgradeId = 'gun' | 'mines' | 'turbo_boost' | 'glue_trap' | 'ram' | 'nothing'

export interface UpgradeOption {
  id: UpgradeId
  name: string
  description: string
  icon: string
  repeatable: boolean
}

export interface UpgradeContract {
  upgradeId: Exclude<UpgradeId, 'nothing'>
  upgradeName: string
  taskText: string
}

export interface PlayerUpgrades {
  hasGun: boolean
  hasMines: boolean
  hasTurboBoost: boolean
  hasGlueTrap: boolean
  hasRam: boolean
  speedMultiplier: number
  selectedIds: Set<UpgradeId>
}

export const DEFAULT_PLAYER_UPGRADES: PlayerUpgrades = {
  hasGun: false,
  hasMines: false,
  hasTurboBoost: false,
  hasGlueTrap: false,
  hasRam: false,
  speedMultiplier: 1.0,
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
    name: 'Mines',
    description: 'Fire drops a mine behind your car. Activates after 2s. Hurts everyone including you!',
    icon: '\u{1F4A3}',
    repeatable: false,
  },
  {
    id: 'turbo_boost',
    name: 'Boost',
    description: 'Press fire for a short speed burst. 3s cooldown.',
    icon: '\u{1F680}',
    repeatable: false,
  },
  {
    id: 'glue_trap',
    name: 'Glue',
    description: 'Fire drops glue behind your car. First car to touch it slows 50% for 8 seconds.',
    icon: '\u{1F7E2}',
    repeatable: false,
  },
  {
    id: 'ram',
    name: 'Ram',
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

export const UPGRADE_CONTRACTS: UpgradeContract[] = [
  {
    upgradeId: 'mines',
    upgradeName: 'Mines',
    taskText: 'destroy the red car',
  },
  {
    upgradeId: 'gun',
    upgradeName: 'Machine Gun',
    taskText: 'destroy the blue car',
  },
  {
    upgradeId: 'ram',
    upgradeName: 'Ram',
    taskText: 'destroy any car',
  },
  {
    upgradeId: 'turbo_boost',
    upgradeName: 'Boost',
    taskText: 'finish the race under 25 seconds',
  },
  {
    upgradeId: 'glue_trap',
    upgradeName: 'Glue',
    taskText: 'glue at least two cars',
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
    case 'glue_trap':
      return { ...current, hasGlueTrap: true, selectedIds: newSelectedIds }
    case 'ram':
      return { ...current, hasRam: true, selectedIds: newSelectedIds }
    case 'nothing':
      return { ...current, selectedIds: newSelectedIds }
  }
}

export function removeUpgradeEffect(current: PlayerUpgrades, upgradeId: UpgradeId): PlayerUpgrades {
  switch (upgradeId) {
    case 'mines':
      return { ...current, hasMines: false }
    default:
      return current
  }
}

export function getAvailableOptions(current: PlayerUpgrades): UpgradeOption[] {
  return UPGRADE_POOL.filter(opt => opt.repeatable || !current.selectedIds.has(opt.id))
}

export function getAvailableContracts(current: PlayerUpgrades): UpgradeContract[] {
  return UPGRADE_CONTRACTS.filter(contract => !current.selectedIds.has(contract.upgradeId))
}

export function getContractForUpgrade(upgradeId: Exclude<UpgradeId, 'nothing'>): UpgradeContract {
  const contract = UPGRADE_CONTRACTS.find(option => option.upgradeId === upgradeId)
  if (!contract) {
    throw new Error(`Missing contract for upgrade: ${upgradeId}`)
  }

  return contract
}

export function selectRandomContract(current: PlayerUpgrades): UpgradeContract | null {
  const contracts = getAvailableContracts(current)
  if (contracts.length === 0) {
    return null
  }

  const index = Math.floor(Math.random() * contracts.length)
  return contracts[index]
}

const FIRE_BUTTON_WEAPONS: UpgradeId[] = ['gun', 'mines', 'turbo_boost', 'glue_trap']

export function getFireButtonWeapons(upgrades: PlayerUpgrades): UpgradeId[] {
  const weapons: UpgradeId[] = []
  if (upgrades.hasGun) weapons.push('gun')
  if (upgrades.hasMines) weapons.push('mines')
  if (upgrades.hasTurboBoost) weapons.push('turbo_boost')
  if (upgrades.hasGlueTrap) weapons.push('glue_trap')
  return weapons
}

export function getWeaponIcon(id: UpgradeId): string {
  const option = UPGRADE_POOL.find(o => o.id === id)
  return option?.icon ?? ''
}

export function isFireButtonWeapon(id: UpgradeId): boolean {
  return FIRE_BUTTON_WEAPONS.includes(id)
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
