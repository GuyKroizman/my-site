import * as THREE from 'three'
import { Car } from './Car'
import { Mine } from './Mine'
import type { LevelConfig, BallDropConfig, CarConfig } from './levels'
import type { PlayerUpgrades } from './upgrades'

const PLAYER_DEFAULT_TURN_MULTIPLIER = 1.2

export function createRaceCars(
  scene: THREE.Scene,
  levelConfig: LevelConfig,
  onCarCreated: (car: Car) => void
): Car[] {
  Car.resetAiIndex()

  const cars: Car[] = []
  levelConfig.cars.forEach((config: CarConfig) => {
    const car = new Car(
      config.x,
      0.5,
      config.z,
      config.color,
      config.name,
      config.isPlayer,
      config.characteristics,
      config.modelPath
    )
    cars.push(car)
    scene.add(car.mesh)
    car.addHealthBarToScene(scene)
    onCarCreated(car)
  })

  return cars
}

export function applyPlayerRaceUpgrades(cars: Car[], upgrades: PlayerUpgrades): void {
  const playerCar = cars.find(car => car.isPlayer)
  if (!playerCar) {
    return
  }

  playerCar.applyPermanentSpeedMultiplier(upgrades.speedMultiplier)
  playerCar.applyPermanentTurnMultiplier(PLAYER_DEFAULT_TURN_MULTIPLIER)
  playerCar.hasRam = upgrades.hasRam
}

export function createLevelMine(scene: THREE.Scene, levelConfig: LevelConfig, randomPointOnTrack: () => THREE.Vector3): Mine | null {
  if (levelConfig.id < 2) {
    return null
  }

  const minePos = randomPointOnTrack()
  return new Mine(scene, minePos.x, minePos.z, 2.0, false)
}

export function clonePendingBallDrops(levelConfig: LevelConfig): BallDropConfig[] {
  return [...(levelConfig.ballDrops ?? [])]
}
