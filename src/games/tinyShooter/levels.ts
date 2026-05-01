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
    arenaSize: 400,
    clearCondition: 'survival',
    nextLevelId: null,
    actors: [
      {
        kind: 'robotSpawner',
        enemyId: 'roboScout',
        position: { x: -58, z: -64 },
        behavior: { type: 'seekObjective' },
        releaseIntervalSeconds: 7,
        initialDelaySeconds: 2,
      },
      {
        kind: 'robotSpawner',
        enemyId: 'heavyBot',
        position: { x: 58, z: -64 },
        behavior: { type: 'seekObjective' },
        releaseIntervalSeconds: 7,
        initialDelaySeconds: 5.5,
      },
      {
        kind: 'giant',
        position: { x: 0, z: -84 },
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
