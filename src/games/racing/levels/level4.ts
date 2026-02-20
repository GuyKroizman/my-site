import { LevelConfig } from './types'

export const level4: LevelConfig = {
  id: 4,
  name: "Elite Championship",
  description: 'Only the best survive! Maximum speed and precision required. Finish first to win.',
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
        // Elite speedster
        maxSpeed: 18,
        acceleration: 36,
        turnSpeed: 0.042,
        aiAggressiveness: 1.0,
        pathRecalculateInterval: 0.15,
        waypointLookAhead: 4
      }
    },
    {
      x: 1.5,
      z: -10,
      color: 0x0000ff,
      name: 'Blue Cruiser',
      modelPath: '/racing/models/sport_car.fbx',
      isPlayer: false,
      characteristics: {
        // Elite all-rounder
        maxSpeed: 18,
        acceleration: 32,
        turnSpeed: 0.046,
        aiAggressiveness: 0.95,
        pathRecalculateInterval: 0.3,
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
        // Player car at elite level
        maxSpeed: 18,
        acceleration: 30,
        turnSpeed: 0.065,
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
        // Elite cornering specialist
        maxSpeed: 18,
        acceleration: 28,
        turnSpeed: 0.052,
        aiAggressiveness: 0.9,
        pathRecalculateInterval: 0.5,
        waypointLookAhead: 5
      }
    }
  ]
}
