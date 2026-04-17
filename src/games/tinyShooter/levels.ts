import type { LevelDefinition } from './levelTypes'

export const tinyShooterLevels: LevelDefinition[] = [
  {
    id: 'hangar-1',
    name: 'Hangar One',
    playerSpawn: { x: -10, z: -10 },
    arenaSize: 200,
    clearCondition: 'defeat-all',
    nextLevelId: 'hangar-2',
    actors: [
      {
        kind: 'animatedEnemy',
        enemyId: 'roboScout',
        position: { x: -10, z: -18 },
        behavior: { type: 'patrol', distance: 10 },
      },
      {
        kind: 'animatedEnemy',
        enemyId: 'heavyBot',
        position: { x: -18, z: -24 },
        behavior: { type: 'idle' },
      },
      {
        kind: 'giant',
        position: { x: 60, z: 60 },
      },
    ],
  },
  {
    id: 'hangar-2',
    name: 'Hangar Two',
    playerSpawn: { x: -14, z: -14 },
    arenaSize: 200,
    clearCondition: 'defeat-all',
    nextLevelId: null,
    actors: [
      {
        kind: 'animatedEnemy',
        enemyId: 'roboScout',
        position: { x: -16, z: -32 },
        behavior: { type: 'patrol', distance: 14 },
      },
      {
        kind: 'animatedEnemy',
        enemyId: 'roboScout',
        position: { x: 8, z: -20 },
        behavior: { type: 'strafe', distance: 8, headingDegrees: 45 },
      },
      {
        kind: 'animatedEnemy',
        enemyId: 'heavyBot',
        position: { x: 22, z: -12 },
        behavior: { type: 'strafe', distance: 6, headingDegrees: 90 },
      },
      {
        kind: 'giant',
        position: { x: 52, z: 42 },
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
