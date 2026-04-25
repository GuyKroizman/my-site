import type { LevelDefinition } from './levelTypes'

export const tinyShooterLevels: LevelDefinition[] = [
  {
    id: 'diamond-core',
    name: 'Diamond Core',
    playerSpawn: { x: 0, z: 8 },
    objective: {
      position: { x: 0, z: 0 },
      radius: 2.25,
      maxHealth: 120,
    },
    arenaSize: 200,
    clearCondition: 'defeat-all',
    nextLevelId: null,
    actors: [
      {
        kind: 'animatedEnemy',
        enemyId: 'roboScout',
        position: { x: -32, z: -28 },
        behavior: { type: 'seekObjective' },
      },
      {
        kind: 'animatedEnemy',
        enemyId: 'heavyBot',
        position: { x: 32, z: -30 },
        behavior: { type: 'seekObjective' },
      },
    ],
  },
]

export function getLevelById(levelId: string): LevelDefinition {
  const level = tinyShooterLevels.find((entry) => entry.id === levelId)
  if (!level) {
    throw new Error(`Unknown Tiny Shooter level: ${levelId}`)
  }

  return level
}

export function getFirstTinyShooterLevel(): LevelDefinition {
  return tinyShooterLevels[0]
}
