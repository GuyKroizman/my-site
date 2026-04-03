import { LevelConfig } from './types'

export const level1: LevelConfig = {
  id: 1,
  name: "Beginner's Oval",
  description: 'A simple oval track to get you started. Finish in the top 3 to advance.',
  requiredLaps: 4,
  groundTheme: 'grass',
  groundCoverStyle: 'grassTufts',
  winCondition: {
    maxPosition: 3 // Finish top 3 to win
  },
  cars: [
    {
      x: -1.5,
      z: -10,
      color: 0xff0000,
      name: 'Red Racer',
      modelPath: '/racing/models/hatchback_car.glb',
      isPlayer: false,
      characteristics: {
        // Aggressive speedster - fast but less precise on corners
        maxSpeed: 9,
        acceleration: 24,
        turnSpeed: 0.035,
        aiAggressiveness: 0.9,
        pathRecalculateInterval: 0.3,
        waypointLookAhead: 2
      }
    },
    {
      x: 1.5,
      z: -10,
      color: 0x0000ff,
      name: 'Blue Cruiser',
      modelPath: '/racing/models/sport_car.glb',
      isPlayer: false,
      characteristics: {
        // Balanced all-rounder - good at everything
        maxSpeed: 8,
        acceleration: 20,
        turnSpeed: 0.04,
        aiAggressiveness: 0.8,
        pathRecalculateInterval: 0.2,
        waypointLookAhead: 3
      }
    },
    {
      x: -1.5,
      z: -13,
      color: 0x000000,
      name: 'Player',
      modelPath: '/racing/models/sport_car2.glb',
      isPlayer: true,
      characteristics: {
        // Player car characteristics
        maxSpeed: 12,
        acceleration: 20,
        turnSpeed: 0.04,
        aiAggressiveness: 0.7,
        pathRecalculateInterval: 0.5,
        waypointLookAhead: 3
      }
    },
    {
      x: 1.5,
      z: -13,
      color: 0x00ff00,
      name: 'Green Machine',
      modelPath: '/racing/models/pickup_truck.glb',
      isPlayer: false,
      characteristics: {
        // Careful navigator - slower top speed but great cornering
        maxSpeed: 10,
        acceleration: 16,
        turnSpeed: 0.045,
        aiAggressiveness: 0.7,
        pathRecalculateInterval: 0.2,
        waypointLookAhead: 5
      }
    }
  ],
  ballDrops: [
    { dropTime: 1 },
    { dropTime: 2 },
  ],
  // 80×60 grid: row 0 = minZ. Space = empty. p = Plant, m = Mushroom, t = Trees (see decorationConfig.ts)
  decorationRows: (() => {
    const rows = Array.from({ length: 60 }, () => '')
    // Infield: plants, mushrooms, and trees near center and outer edges
    const pad = (n: number) => ' '.repeat(n)
    rows[0] = '                                                                               p'
    rows[6] = '    m     t     d                                                               '
    rows[31] = pad(36) + 'p            '
    rows[40] = pad(57) + 'm'
    return rows
  })()
}
