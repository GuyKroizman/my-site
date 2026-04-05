import { LevelConfig } from './types'

export const level3: LevelConfig = {
  id: 3,
  name: "Speed Demon's Track",
  description: 'The pace intensifies! Faster speeds and tighter competition. Finish in the top 2 to advance.',
  requiredLaps: 4,
  groundTheme: 'grass',
  groundCoverStyle: 'texture',
  winCondition: {
    maxPosition: 2 // Finish top 2 to win
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
        // Even faster speedster
        maxSpeed: 16,
        acceleration: 32,
        turnSpeed: 0.04,
        aiAggressiveness: 0.98,
        pathRecalculateInterval: 0.2,
        waypointLookAhead: 3
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
        // High-performance all-rounder
        maxSpeed: 16,
        acceleration: 28,
        turnSpeed: 0.044,
        aiAggressiveness: 0.9,
        pathRecalculateInterval: 0.35,
        waypointLookAhead: 4
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
        // Player car with enhanced capabilities
        maxSpeed: 16,
        acceleration: 26,
        turnSpeed: 0.06,
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
        // Fast cornering specialist
        maxSpeed: 17,
        acceleration: 24,
        turnSpeed: 0.05,
        aiAggressiveness: 0.85,
        pathRecalculateInterval: 0.55,
        waypointLookAhead: 4
      }
    }
  ],
  ballDrops: [
    { dropTime: 3 },
    { dropTime: 12 },
    { dropTime: 25 },
  ],
  decorationRows: (() => {
    const rows = Array.from({ length: 60 }, () => Array.from({ length: 80 }, () => ' '))
    const place = (row: number, col: number, key: string) => {
      if (row >= 0 && row < rows.length && col >= 0 && col < rows[row].length) {
        rows[row][col] = key
      }
    }

    place(30, 40, 'c')

    ;[
      [4, 14, '1'], [4, 22, '2'], [4, 30, '3'], [4, 50, '1'], [4, 58, '2'], [4, 66, '3'],
      [7, 10, '2'], [7, 18, '3'], [7, 26, '1'], [7, 34, '2'], [7, 46, '3'], [7, 54, '1'], [7, 62, '2'], [7, 70, '3'],
      [10, 10, '1'], [10, 16, '2'], [10, 64, '3'], [10, 70, '1'],
      [10, 22, '3'], [10, 58, '2'],
      [14, 8, '2'], [14, 15, '3'], [14, 65, '1'], [14, 72, '2'],
      [14, 22, '1'], [14, 58, '3'],
      [18, 8, '1'], [18, 72, '3'],
      [18, 16, '2'], [18, 64, '1'],
      [22, 10, '2'], [22, 16, '1'], [22, 64, '2'], [22, 70, '3'],
      [22, 22, '3'], [22, 58, '1'],
      [26, 8, '3'], [26, 72, '1'],
      [26, 16, '1'], [26, 64, '2'],
      [30, 10, '1'], [30, 70, '2'],
      [30, 16, '3'], [30, 64, '1'],
      [34, 8, '2'], [34, 72, '3'],
      [34, 16, '2'], [34, 64, '3'],
      [38, 10, '3'], [38, 16, '2'], [38, 64, '1'], [38, 70, '2'],
      [38, 22, '1'], [38, 58, '3'],
      [42, 8, '1'], [42, 72, '2'],
      [42, 16, '3'], [42, 64, '2'],
      [46, 14, '1'], [46, 22, '2'], [46, 30, '3'], [46, 50, '1'], [46, 58, '2'], [46, 66, '3'],
      [50, 12, '2'], [50, 20, '3'], [50, 28, '1'], [50, 36, '2'], [50, 44, '3'], [50, 52, '1'], [50, 60, '2'], [50, 68, '3'],
      [54, 14, '3'], [54, 24, '1'], [54, 34, '2'], [54, 46, '3'], [54, 56, '1'], [54, 66, '2'],
      [57, 18, '1'], [57, 28, '2'], [57, 40, '3'], [57, 52, '1'], [57, 62, '2'],
    ].forEach(([row, col, key]) => place(row as number, col as number, key as string))

    return rows.map((row) => row.join(''))
  })(),
}
