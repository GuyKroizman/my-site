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
  private previousCheckpoint: Map<Car, number> = new Map()
  private requiredLaps: number = 4
  private finishTimes: Map<Car, number> = new Map()
  private firstFinishTime: number | null = null
  private readonly COMPLETION_DELAY: number = 5 // 5 seconds after first car finishes

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
    this.firstFinishTime = null
    const checkpointCount = track.getCheckpointCount()
    this.cars.forEach(car => {
      this.lastLapProgress.set(car, 0)
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

  public update(_deltaTime: number, _track: Track, raceTime: number = 0) {
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
        // Log when finish line is crossed
        if (car.lapsCompleted === this.requiredLaps - 1) {
          // Log finish line crossing (removed - too verbose)
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
          
          // Record finish time
          this.finishTimes.set(car, raceTime)

          // Track when first car finishes
          if (this.firstFinishTime === null) {
            this.firstFinishTime = raceTime
          }
        }
      }
      
      // Store current checkpoint for next frame comparison
      this.previousCheckpoint.set(car, car.lastCheckpoint)

    })

    // Check if 5 seconds have passed since first car finished
    if (this.firstFinishTime !== null && !this.raceComplete) {
      const timeSinceFirstFinish = raceTime - this.firstFinishTime
      if (timeSinceFirstFinish >= this.COMPLETION_DELAY) {
        this.completeRace()
      }
    }
  }

  private completeRace() {
    this.raceStarted = false
    this.raceComplete = true

    // Stop all cars
    this.cars.forEach(car => {
      car.finished = true
      car.speed = 0
    })

    // Sort finished cars by finish position (only include cars that actually finished)
    const sorted = [...this.finishedCars].sort((a, b) => a.finishPosition - b.finishPosition)

    // Build times map - only include cars that finished
    const times: { [name: string]: number } = {}
    sorted.forEach(car => {
      const time = this.finishTimes.get(car)
      if (time !== undefined) {
        times[car.name] = time
      }
    })

    const results = {
      winner: sorted[0]?.name || 'Unknown',
      second: sorted[1]?.name || 'Unknown',
      third: sorted[2]?.name || 'Unknown',
      times: times
    }

    this.callbacks.onRaceComplete(results)
  }

  public reset(track: Track) {
    this.raceStarted = false
    this.raceComplete = false
    this.finishedCars = []
    this.finishTimes.clear()
    this.firstFinishTime = null
    const checkpointCount = track.getCheckpointCount()
    this.cars.forEach(car => {
      this.lastLapProgress.set(car, 0)
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
