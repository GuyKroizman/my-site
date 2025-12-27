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
  private lastLoggedProgress: Map<Car, number> = new Map()
  private previousCheckpoint: Map<Car, number> = new Map()
  private requiredLaps: number = 2

  constructor(callbacks: RacingGameCallbacks) {
    this.callbacks = callbacks
  }

  public addCar(car: Car, track: Track) {
    this.cars.push(car)
    this.lastLapProgress.set(car, 0)
    this.previousCheckpoint.set(car, -1)
    // Initialize checkpoint tracking array to match track's checkpoint count
    const checkpointCount = track.getCheckpointCount()
    if (car.checkpointPassed.length !== checkpointCount) {
      car.checkpointPassed = new Array(checkpointCount).fill(false)
    }
  }

  public startRace(track: Track) {
    this.raceStarted = true
    this.raceComplete = false
    this.finishedCars = []
    const checkpointCount = track.getCheckpointCount()
    this.cars.forEach(car => {
      this.lastLapProgress.set(car, 0)
      this.lastLoggedProgress.set(car, 0)
      this.previousCheckpoint.set(car, -1)
      car.lapsCompleted = 0
      car.lastCheckpoint = -1
      // Ensure checkpoint array matches track's checkpoint count
      if (car.checkpointPassed.length !== checkpointCount) {
        car.checkpointPassed = new Array(checkpointCount).fill(false)
      } else {
        car.checkpointPassed.fill(false)
      }
    })
  }

  public update(_deltaTime: number, _track: Track) {
    if (!this.raceStarted || this.raceComplete) return

    // Check for lap completion and race finish
    this.cars.forEach(car => {
      if (car.finished) return

      // Check if car completed a lap using checkpoint system
      // A lap is completed when car passes checkpoint 0 (finish line) after passing all other checkpoints (1-4)
      const previousLastCheckpoint = this.previousCheckpoint.get(car) ?? -1
      
      // Check if car just passed checkpoint 0 (finish line)
      // All other checkpoints must have been passed before finishing
      // Get total checkpoint count from track (assuming checkpoint 0 is finish line)
      const totalCheckpoints = _track.getCheckpointCount()
      const finishLineCheckpointId = 0
      
      // Check if all checkpoints except the finish line have been passed
      let allOtherCheckpointsPassed = true
      for (let i = 1; i < totalCheckpoints; i++) {
        if (!car.checkpointPassed[i]) {
          allOtherCheckpointsPassed = false
          break
        }
      }
      
      if (car.lastCheckpoint === finishLineCheckpointId && previousLastCheckpoint !== finishLineCheckpointId && allOtherCheckpointsPassed) {
        // Log when finish line is crossed (for all cars, but concise)
        if (car.lapsCompleted === this.requiredLaps - 1) {
          console.log(`[FINISH LINE CROSSED] ${car.name}:`, {
            checkpoint: car.lastCheckpoint,
            allOtherCheckpointsPassed: allOtherCheckpointsPassed,
            totalCheckpoints: totalCheckpoints,
            willFinish: car.lapsCompleted + 1 >= this.requiredLaps
          })
        }

        // Car completed a lap
        car.lapsCompleted++
        
        // Reset checkpoint tracking for next lap
        car.checkpointPassed.fill(false)
        car.lastCheckpoint = -1

        // Check if car completed all required laps
        if (car.lapsCompleted >= this.requiredLaps) {
          car.finished = true
          car.finishPosition = this.finishedCars.length + 1
          this.finishedCars.push(car)

          // Check if race is complete (all cars finished or 3 positions determined)
          if (this.finishedCars.length >= 3 || this.finishedCars.length === this.cars.length) {
            this.completeRace()
          }
        }
      }
      
      // Store current checkpoint for next frame comparison
      this.previousCheckpoint.set(car, car.lastCheckpoint)

      // Log checkpoint progress during final lap - only for first car
      if (car.lapsCompleted === this.requiredLaps - 1 && car === this.cars[0]) {
        const lastLogged = this.lastLoggedProgress.get(car) || -1
        if (car.lastCheckpoint !== lastLogged && car.lastCheckpoint !== -1) {
          console.log(`[FINAL LAP] ${car.name}:`, {
            checkpoint: car.lastCheckpoint,
            checkpointsPassed: car.checkpointPassed.map((p, i) => p ? i : null).filter(i => i !== null)
          })
          this.lastLoggedProgress.set(car, car.lastCheckpoint)
        }
      }
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

  public reset(track: Track) {
    this.raceStarted = false
    this.raceComplete = false
    this.finishedCars = []
    const checkpointCount = track.getCheckpointCount()
    this.cars.forEach(car => {
      this.lastLapProgress.set(car, 0)
      this.lastLoggedProgress.set(car, 0)
      this.previousCheckpoint.set(car, -1)
      car.lapsCompleted = 0
      car.lastCheckpoint = -1
      // Ensure checkpoint array matches track's checkpoint count
      if (car.checkpointPassed.length !== checkpointCount) {
        car.checkpointPassed = new Array(checkpointCount).fill(false)
      } else {
        car.checkpointPassed.fill(false)
      }
    })
  }

  public isRaceComplete(): boolean {
    return this.raceComplete
  }
}
