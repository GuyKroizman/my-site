import { levels, getTotalLevels, LevelConfig } from './levels'
import { UpgradeId, UpgradeOption, PlayerUpgrades, DEFAULT_PLAYER_UPGRADES, applyUpgrade, selectThreeOptions } from './upgrades'

const DEFAULT_START_LEVEL_INDEX = 0

export type GameState = 'menu' | 'playing' | 'paused' | 'raceComplete' | 'upgradeSelection' | 'gameWon'

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
  onUpgradeSelection: (options: UpgradeOption[]) => void
}

export class GameManager {
  private currentLevelIndex: number = DEFAULT_START_LEVEL_INDEX
  private state: GameState = 'menu'
  private callbacks: GameManagerCallbacks
  private lastRaceResult: RaceResult | null = null
  private playerWonFirstPlace: boolean = false
  private playerUpgrades: PlayerUpgrades = { ...DEFAULT_PLAYER_UPGRADES, selectedIds: new Set() }

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

  public getPlayerUpgrades(): PlayerUpgrades {
    return this.playerUpgrades
  }

  public startGame(): void {
    this.currentLevelIndex = DEFAULT_START_LEVEL_INDEX
    this.playerWonFirstPlace = false
    this.state = 'playing'
    this.lastRaceResult = null
    this.playerUpgrades = { ...DEFAULT_PLAYER_UPGRADES, selectedIds: new Set() }
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

    this.playerWonFirstPlace = playerPosition === 1

    this.state = 'raceComplete'
    this.callbacks.onStateChange(this.state)
    this.callbacks.onRaceResult(this.lastRaceResult)
  }

  private getLevelWithGridPosition(): LevelConfig {
    const level = this.getCurrentLevel()
    if (!this.playerWonFirstPlace) return level

    const adjustedCars = level.cars.map(c => ({ ...c }))
    const playerIndex = adjustedCars.findIndex(c => c.isPlayer)
    if (playerIndex === -1) return level

    const playerCar = adjustedCars[playerIndex]
    const frontRowX = 1.5

    if (playerCar.x === frontRowX) return level

    const frontRowCar = adjustedCars.find(c => !c.isPlayer && c.x === frontRowX && c.z === playerCar.z)
    if (frontRowCar) {
      frontRowCar.x = playerCar.x
      playerCar.x = frontRowX
    } else {
      const anyFrontRowCar = adjustedCars.find(c => !c.isPlayer && c.x === frontRowX)
      if (anyFrontRowCar) {
        const tmpX = anyFrontRowCar.x
        anyFrontRowCar.x = playerCar.x
        playerCar.x = tmpX
      }
    }

    return { ...level, cars: adjustedCars }
  }

  public proceedAfterRace(): void {
    if (!this.lastRaceResult) return

    if (this.lastRaceResult.levelPassed) {
      if (this.currentLevelIndex < levels.length - 1) {
        // Show upgrade selection before next level
        const options = selectThreeOptions(this.playerUpgrades)
        this.state = 'upgradeSelection'
        this.lastRaceResult = null
        this.callbacks.onStateChange(this.state)
        this.callbacks.onUpgradeSelection(options)
      } else {
        // All levels completed - game won!
        this.state = 'gameWon'
        this.callbacks.onStateChange(this.state)
        this.callbacks.onGameComplete(true)
      }
    }
  }

  public selectUpgrade(upgradeId: UpgradeId): void {
    this.playerUpgrades = applyUpgrade(this.playerUpgrades, upgradeId)
    this.currentLevelIndex++
    this.state = 'playing'
    this.callbacks.onStateChange(this.state)
    this.callbacks.onLevelChange(this.getLevelWithGridPosition())
  }

  public returnToMenu(): void {
    this.currentLevelIndex = DEFAULT_START_LEVEL_INDEX
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
