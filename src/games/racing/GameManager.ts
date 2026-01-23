import { levels, getTotalLevels, LevelConfig } from './levels'

export type GameState = 'menu' | 'playing' | 'paused' | 'raceComplete' | 'gameWon' | 'gameLost'

export interface RaceResult {
  winner: string
  second: string
  third: string
  times: { [name: string]: number }
  playerPosition: number
  levelPassed: boolean
}

export interface GameManagerCallbacks {
  onStateChange: (state: GameState) => void
  onLevelChange: (level: LevelConfig) => void
  onRaceResult: (result: RaceResult) => void
  onGameComplete: (won: boolean) => void
}

export class GameManager {
  private currentLevelIndex: number = 0
  private state: GameState = 'menu'
  private callbacks: GameManagerCallbacks
  private lastRaceResult: RaceResult | null = null

  constructor(callbacks: GameManagerCallbacks) {
    this.callbacks = callbacks
  }

  public getCurrentLevel(): LevelConfig {
    return levels[this.currentLevelIndex]
  }

  public getCurrentLevelNumber(): number {
    return this.currentLevelIndex + 1
  }

  public getTotalLevels(): number {
    return getTotalLevels()
  }

  public getState(): GameState {
    return this.state
  }

  public getLastRaceResult(): RaceResult | null {
    return this.lastRaceResult
  }

  public startGame(): void {
    this.currentLevelIndex = 0
    this.state = 'playing'
    this.lastRaceResult = null
    this.callbacks.onStateChange(this.state)
    this.callbacks.onLevelChange(this.getCurrentLevel())
  }

  public handleRaceComplete(results: { 
    winner: string
    second: string
    third: string
    times: { [name: string]: number }
  }): void {
    const currentLevel = this.getCurrentLevel()
    
    // Determine player's position
    let playerPosition = 4 // Default to last if not found
    if (results.winner === 'Player') {
      playerPosition = 1
    } else if (results.second === 'Player') {
      playerPosition = 2
    } else if (results.third === 'Player') {
      playerPosition = 3
    }

    // Check if player passed this level
    const levelPassed = playerPosition <= currentLevel.winCondition.maxPosition

    this.lastRaceResult = {
      ...results,
      playerPosition,
      levelPassed
    }

    this.state = 'raceComplete'
    this.callbacks.onStateChange(this.state)
    this.callbacks.onRaceResult(this.lastRaceResult)
  }

  public proceedAfterRace(): void {
    if (!this.lastRaceResult) return

    if (this.lastRaceResult.levelPassed) {
      // Check if there are more levels
      if (this.currentLevelIndex < levels.length - 1) {
        // Move to next level
        this.currentLevelIndex++
        this.state = 'playing'
        this.lastRaceResult = null
        this.callbacks.onStateChange(this.state)
        this.callbacks.onLevelChange(this.getCurrentLevel())
      } else {
        // All levels completed - game won!
        this.state = 'gameWon'
        this.callbacks.onStateChange(this.state)
        this.callbacks.onGameComplete(true)
      }
    } else {
      // Player didn't pass - game lost
      this.state = 'gameLost'
      this.callbacks.onStateChange(this.state)
      this.callbacks.onGameComplete(false)
    }
  }

  public returnToMenu(): void {
    this.currentLevelIndex = 0
    this.state = 'menu'
    this.lastRaceResult = null
    this.callbacks.onStateChange(this.state)
  }

  public pause(): void {
    if (this.state === 'playing') {
      this.state = 'paused'
      this.callbacks.onStateChange(this.state)
    }
  }

  public resume(): void {
    if (this.state === 'paused') {
      this.state = 'playing'
      this.callbacks.onStateChange(this.state)
    }
  }

  public isLastLevel(): boolean {
    return this.currentLevelIndex >= levels.length - 1
  }
}
