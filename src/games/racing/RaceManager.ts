import { Car } from './Car'
import { Track } from './Track'
import { RacingGameCallbacks } from './RacingGameEngine'

export class RaceManager {
  private cars: Car[] = []
  private raceStarted: boolean = false
  private raceComplete: boolean = false
  private finishedCars: Car[] = []
  private callbacks: RacingGameCallbacks
  private lastLapProgress: Map<Car, number> = new Map()
  private requiredLaps: number = 4

  constructor(callbacks: RacingGameCallbacks) {
    this.callbacks = callbacks
  }

  public addCar(car: Car) {
    this.cars.push(car)
    this.lastLapProgress.set(car, 0)
  }

  public startRace() {
    this.raceStarted = true
    this.raceComplete = false
    this.finishedCars = []
    this.cars.forEach(car => {
      this.lastLapProgress.set(car, 0)
      car.lapsCompleted = 0
    })
  }

  public update(_deltaTime: number, _track: Track) {
    if (!this.raceStarted || this.raceComplete) return

    // Check for lap completion and race finish
    this.cars.forEach(car => {
      if (car.finished) return

      const currentProgress = car.lapProgress
      const lastProgress = this.lastLapProgress.get(car) || 0

      // Check if car completed a lap (crossed finish line)
      // Progress goes from high (>0.9) to low (<0.1) when crossing finish line
      // Also handle case where progress wraps around
      const progressDiff = currentProgress - lastProgress
      const crossedFinish = (lastProgress > 0.9 && currentProgress < 0.2) || 
                           (lastProgress > 0.95 && currentProgress < 0.3) ||
                           (progressDiff < -0.5) // Large negative jump indicates wrap-around

      if (crossedFinish) {
        // Car completed a lap
        car.lapsCompleted++
        
        // Check if car completed all required laps
        if (car.lapsCompleted >= this.requiredLaps) {
          car.finished = true
          car.finishPosition = this.finishedCars.length + 1
          this.finishedCars.push(car)
          
          // Position car at finish line only if it's actually near the finish line
          // Otherwise, let it continue until it reaches the finish line naturally
          const finishLinePosition = _track.getFinishLinePosition()
          const finishLineZ = finishLinePosition.z
          const distanceToFinishLine = Math.abs(car.position.z - finishLineZ)
          
          // Only teleport if car is reasonably close to finish line (within 10 units)
          // Otherwise, let it drive to the finish line
          if (distanceToFinishLine <= 10.0) {
            car.position.set(car.startX, car.position.y, finishLineZ)
            car.speed = 0
            car.mesh.position.copy(car.position)
          }
          // If car is far from finish line, it will continue moving and finish when it reaches it
          
          // Check if race is complete (all cars finished or 3 positions determined)
          if (this.finishedCars.length >= 3 || this.finishedCars.length === this.cars.length) {
            this.completeRace()
          }
        }
      }

      this.lastLapProgress.set(car, currentProgress)
    })
  }

  private completeRace() {
    this.raceStarted = false
    this.raceComplete = true

    // Stop all cars
    this.cars.forEach(car => {
      car.finished = true
      car.speed = 0
    })

    // Sort finished cars by finish position
    const sorted = [...this.finishedCars].sort((a, b) => a.finishPosition - b.finishPosition)
    
    // Get remaining cars that didn't finish and add them
    const remaining = this.cars.filter(car => !car.finished)
    sorted.push(...remaining)

    const results = {
      winner: sorted[0]?.name || 'Unknown',
      second: sorted[1]?.name || 'Unknown',
      third: sorted[2]?.name || 'Unknown'
    }

    this.callbacks.onRaceComplete(results)
  }

  public reset() {
    this.raceStarted = false
    this.raceComplete = false
    this.finishedCars = []
    this.cars.forEach(car => {
      this.lastLapProgress.set(car, 0)
      car.lapsCompleted = 0
    })
  }

  public isRaceComplete(): boolean {
    return this.raceComplete
  }
}
