import { LevelConfig } from './types'

export const level1: LevelConfig = {
  id: 1,
  name: "Beginner's Oval",
  description: 'A simple oval track to get you started. Finish in the top 3 to advance.',
  requiredLaps: 4,
  winCondition: {
    maxPosition: 3 // Finish top 3 to win
  },
  cars: [
    {
      x: -1.5,
      z: -10,
      color: 0xff0000,
      name: 'Red Racer',
      isPlayer: false,
      characteristics: {
        // Aggressive speedster - fast but less precise on corners
        maxSpeed: 12,
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
      isPlayer: false,
      characteristics: {
        // Balanced all-rounder - good at everything
        maxSpeed: 11,
        acceleration: 20,
        turnSpeed: 0.04,
        aiAggressiveness: 0.8,
        pathRecalculateInterval: 0.5,
        waypointLookAhead: 3
      }
    },
    {
      x: -1.5,
      z: -13,
      color: 0x000000,
      name: 'Player',
      isPlayer: true,
      characteristics: {
        // Player car characteristics
        maxSpeed: 11,
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
      isPlayer: false,
      characteristics: {
        // Careful navigator - slower top speed but great cornering
        maxSpeed: 10,
        acceleration: 16,
        turnSpeed: 0.045,
        aiAggressiveness: 0.7,
        pathRecalculateInterval: 0.8,
        waypointLookAhead: 5
      }
    }
  ]
}
