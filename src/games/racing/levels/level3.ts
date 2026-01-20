import { LevelConfig } from './types'

export const level3: LevelConfig = {
  id: 3,
  name: "Speed Demon's Track",
  description: 'The pace intensifies! Faster speeds and tighter competition. Finish in the top 2 to advance.',
  requiredLaps: 5,
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
      isPlayer: false,
      characteristics: {
        // High-performance all-rounder
        maxSpeed: 15,
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
      isPlayer: true,
      characteristics: {
        // Player car with enhanced capabilities
        maxSpeed: 14,
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
      isPlayer: false,
      characteristics: {
        // Fast cornering specialist
        maxSpeed: 14.5,
        acceleration: 24,
        turnSpeed: 0.05,
        aiAggressiveness: 0.85,
        pathRecalculateInterval: 0.55,
        waypointLookAhead: 4
      }
    }
  ]
}
