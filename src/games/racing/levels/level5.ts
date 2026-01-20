import { LevelConfig } from './types'

export const level5: LevelConfig = {
  id: 5,
  name: "Master's Challenge",
  description: 'The ultimate test! Push your skills to the limit. Finish first to claim victory.',
  requiredLaps: 4,
  winCondition: {
    maxPosition: 1 // Must finish first to win
  },
  cars: [
    {
      x: -1.5,
      z: -10,
      color: 0xff0000,
      name: 'Red Racer',
      isPlayer: false,
      characteristics: {
        // Master level speedster
        maxSpeed: 20,
        acceleration: 40,
        turnSpeed: 0.044,
        aiAggressiveness: 1.0,
        pathRecalculateInterval: 0.1,
        waypointLookAhead: 4
      }
    },
    {
      x: 1.5,
      z: -10,
      color: 0x0000ff,
      name: 'Blue Cruiser',
      isPlayer: false,
      characteristics: {
        // Master level all-rounder
        maxSpeed: 20,
        acceleration: 36,
        turnSpeed: 0.048,
        aiAggressiveness: 0.98,
        pathRecalculateInterval: 0.25,
        waypointLookAhead: 5
      }
    },
    {
      x: -1.5,
      z: -13,
      color: 0x000000,
      name: 'Player',
      isPlayer: true,
      characteristics: {
        // Player car at master level
        maxSpeed: 20,
        acceleration: 34,
        turnSpeed: 0.07,
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
        // Master level cornering specialist
        maxSpeed: 20.5,
        acceleration: 32,
        turnSpeed: 0.055,
        aiAggressiveness: 0.95,
        pathRecalculateInterval: 0.45,
        waypointLookAhead: 5
      }
    }
  ]
}
