import { LevelConfig } from './types'

export const level2: LevelConfig = {
  id: 2,
  name: "Challenger's Circuit",
  description: 'The competition heats up! AI drivers are faster and smarter. Finish in the top 2 to win.',
  requiredLaps: 4,
  winCondition: {
    maxPosition: 2 // Finish top 2 to win
  },
  cars: [
    {
      x: -1.5,
      z: -10,
      color: 0xff0000,
      name: 'Red Racer',
      isPlayer: false,
      characteristics: {
        // More aggressive and faster than level 1
        maxSpeed: 13,
        acceleration: 26,
        turnSpeed: 0.038,
        aiAggressiveness: 0.95,
        pathRecalculateInterval: 0.25,
        waypointLookAhead: 3
      }
    },
    {
      x: 1.5,
      z: -10,
      color: 0x0000ff,
      name: 'Blue Cruiser',
      isPlayer: false,
      characteristics: {
        // Improved all-rounder
        maxSpeed: 12,
        acceleration: 22,
        turnSpeed: 0.042,
        aiAggressiveness: 0.85,
        pathRecalculateInterval: 0.4,
        waypointLookAhead: 4
      }
    },
    {
      x: -1.5,
      z: -13,
      color: 0x000000,
      name: 'Player',
      isPlayer: true,
      characteristics: {
        // Player car stays the same
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
        // Now faster but still good at corners
        maxSpeed: 11.5,
        acceleration: 18,
        turnSpeed: 0.048,
        aiAggressiveness: 0.8,
        pathRecalculateInterval: 0.6,
        waypointLookAhead: 4
      }
    }
  ]
}
