import { levels, getTotalLevels, LevelConfig } from './levels'
import {
  UpgradeContract,
  PlayerUpgrades,
  DEFAULT_PLAYER_UPGRADES,
  applyUpgrade,
  removeUpgradeEffect,
  selectRandomContract,
} from './upgrades'

const DEFAULT_START_LEVEL_INDEX = 4
const TASK_COMPLETION_REWARD = 1000
const BOOST_TASK_FINISH_TIME_SECONDS = 25
const TIME_BONUS_TARGET_SECONDS = 40
const TIME_BONUS_COINS_PER_SECOND = 10
const RED_CAR_COLOR = 0xff0000
const BLUE_CAR_COLOR = 0x0000ff

export type GameState = 'menu' | 'playing' | 'paused' | 'raceComplete' | 'contractDialog'

export interface RaceTelemetry {
  destroyedCarNames: string[]
  eliminatedCars: Array<{ name: string; color: number }>
  playerFinishTime: number | null
  gluedCarNames: string[]
}

export interface ContractDialogData {
  lines: string[]
  upgradeName: string | null
  taskText: string | null
}

export interface RaceResult {
  winner: string
  second: string
  third: string
  times: { [name: string]: number }
  playerPosition: number
  levelPassed: boolean
  placementCoins: number
  timeCoins: number
  taskCoins: number
  coinsEarned: number
  totalCoins: number
  taskCompleted: boolean
  activeTaskText: string | null
}

export interface GameManagerCallbacks {
  onStateChange: (state: GameState) => void
  onLevelChange: (level: LevelConfig) => void
  onRaceResult: (result: RaceResult) => void
  onContractDialog: (dialog: ContractDialogData) => void
}

interface EngineRaceCompleteResult extends RaceTelemetry {
  winner: string
  second: string
  third: string
  times: { [name: string]: number }
}

export class GameManager {
  private currentLevelIndex: number = DEFAULT_START_LEVEL_INDEX
  private state: GameState = 'menu'
  private callbacks: GameManagerCallbacks
  private lastRaceResult: RaceResult | null = null
  private playerWonFirstPlace: boolean = false
  private playerUpgrades: PlayerUpgrades = { ...DEFAULT_PLAYER_UPGRADES, selectedIds: new Set() }
  private activeContract: UpgradeContract | null = null
  private totalCoins: number = 0

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

  public getTotalCoins(): number {
    return this.totalCoins
  }

  public startGame(): void {
    this.currentLevelIndex = DEFAULT_START_LEVEL_INDEX
    this.playerWonFirstPlace = false
    this.state = 'playing'
    this.lastRaceResult = null
    this.totalCoins = 0
    this.activeContract = null
    this.playerUpgrades = { ...DEFAULT_PLAYER_UPGRADES, selectedIds: new Set() }
    this.callbacks.onStateChange(this.state)
    this.callbacks.onLevelChange(this.getCurrentLevel())
  }

  public handleRaceComplete(results: EngineRaceCompleteResult): void {
    const currentLevel = this.getCurrentLevel()
    const playerPosition = getPlayerPosition(results)
    const levelPassed = playerPosition <= currentLevel.winCondition.maxPosition
    const placementCoins = getPlacementCoins(playerPosition)
    const timeCoins = getTimeCoins(results.playerFinishTime)
    const taskCompleted = this.evaluateActiveTask(results)
    const taskCoins = taskCompleted ? TASK_COMPLETION_REWARD : 0
    const coinsEarned = placementCoins + timeCoins + taskCoins

    this.totalCoins += coinsEarned

    this.lastRaceResult = {
      winner: results.winner,
      second: results.second,
      third: results.third,
      times: results.times,
      playerPosition,
      levelPassed,
      placementCoins,
      timeCoins,
      taskCoins,
      coinsEarned,
      totalCoins: this.totalCoins,
      taskCompleted,
      activeTaskText: this.activeContract?.taskText ?? null,
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
    if (!this.lastRaceResult || !this.lastRaceResult.levelPassed) return

    if (this.currentLevelIndex >= levels.length - 1) {
      return
    }

    const completedLevelNumber = this.currentLevelIndex + 1
    const dialog = completedLevelNumber === 1
      ? this.buildIntroDialog()
      : this.buildPostTaskDialog(completedLevelNumber, this.lastRaceResult.taskCompleted)

    if (!dialog) {
      this.advanceToNextLevel()
      return
    }

    this.state = 'contractDialog'
    this.lastRaceResult = null
    this.callbacks.onStateChange(this.state)
    this.callbacks.onContractDialog(dialog)
  }

  public acknowledgeContractDialog(): void {
    if (this.state !== 'contractDialog') {
      return
    }

    this.advanceToNextLevel()
  }

  public returnToMenu(): void {
    this.currentLevelIndex = DEFAULT_START_LEVEL_INDEX
    this.state = 'menu'
    this.lastRaceResult = null
    this.activeContract = null
    this.totalCoins = 0
    this.playerUpgrades = { ...DEFAULT_PLAYER_UPGRADES, selectedIds: new Set() }
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

  private advanceToNextLevel(): void {
    this.currentLevelIndex++
    this.state = 'playing'
    this.callbacks.onStateChange(this.state)
    this.callbacks.onLevelChange(this.getLevelWithGridPosition())
  }

  private buildIntroDialog(): ContractDialogData | null {
    const grantedContract = this.grantRandomUpgradeContract()
    if (!grantedContract) {
      return null
    }

    return this.createDialog(grantedContract, [
      'You did pretty good at that race so I decided to approve the loan you did not ask for.',
      'I told my boys to install <upgrade name> in your car.',
      'In return I expect you to:',
      '<task>',
    ])
  }

  private buildPostTaskDialog(completedLevelNumber: number, taskCompleted: boolean): ContractDialogData | null {
    if (taskCompleted) {
      this.completeActiveContract()
      const grantedContract = this.grantRandomUpgradeContract()
      if (!grantedContract) {
        return null
      }

      return this.createDialog(grantedContract, [
        'Well done',
        'Your upgrade is <upgrade name>',
        'in return I expect you to <task>',
      ])
    }

    if (!this.activeContract) {
      return null
    }

    const warningTemplate = getMissedTaskWarning(completedLevelNumber)
    return this.createDialog(this.activeContract, [warningTemplate])
  }

  private completeActiveContract(): void {
    if (!this.activeContract) {
      return
    }

    this.playerUpgrades = removeUpgradeEffect(this.playerUpgrades, this.activeContract.upgradeId)
    this.activeContract = null
  }

  private grantRandomUpgradeContract(): UpgradeContract | null {
    const grantedContract = selectRandomContract(this.playerUpgrades)
    if (!grantedContract) {
      return null
    }

    this.playerUpgrades = applyUpgrade(this.playerUpgrades, grantedContract.upgradeId)
    this.activeContract = grantedContract
    return grantedContract
  }

  private createDialog(contract: UpgradeContract, templates: string[]): ContractDialogData {
    return {
      lines: templates.map(template => this.interpolateTemplate(template, contract)),
      upgradeName: contract.upgradeName,
      taskText: contract.taskText,
    }
  }

  private interpolateTemplate(template: string, contract: UpgradeContract): string {
    return template
      .split('<task>').join(contract.taskText)
      .split('<upgrade name>').join(contract.upgradeName)
  }

  private evaluateActiveTask(results: RaceTelemetry): boolean {
    if (!this.activeContract) {
      return false
    }

    switch (this.activeContract.upgradeId) {
      case 'mines':
        return results.eliminatedCars.some((car) => car.color === RED_CAR_COLOR)
      case 'gun':
        return results.eliminatedCars.some((car) => car.color === BLUE_CAR_COLOR)
      case 'ram':
        return results.eliminatedCars.length > 0
      case 'turbo_boost':
        return results.playerFinishTime !== null && results.playerFinishTime < BOOST_TASK_FINISH_TIME_SECONDS
      case 'glue_trap':
        return results.gluedCarNames.length >= 2
    }
  }
}

function getPlayerPosition(results: Pick<EngineRaceCompleteResult, 'winner' | 'second' | 'third'>): number {
  if (results.winner === 'Player') return 1
  if (results.second === 'Player') return 2
  if (results.third === 'Player') return 3
  return 4
}

function getPlacementCoins(playerPosition: number): number {
  switch (playerPosition) {
    case 1:
      return 300
    case 2:
      return 200
    case 3:
      return 100
    default:
      return 0
  }
}

function getTimeCoins(playerFinishTime: number | null): number {
  if (playerFinishTime === null || playerFinishTime >= TIME_BONUS_TARGET_SECONDS) {
    return 0
  }

  return Math.max(0, Math.floor((TIME_BONUS_TARGET_SECONDS - playerFinishTime) * TIME_BONUS_COINS_PER_SECOND))
}

function getMissedTaskWarning(completedLevelNumber: number): string {
  switch (completedLevelNumber) {
    case 2:
      return 'No upgrade for you, you better <task> in the next race'
    case 3:
      return 'You disappoint me. No upgrade for you, you better <task> in the next race'
    case 4:
      return 'Last chance <task>'
    default:
      return 'No upgrade for you, you better <task> in the next race'
  }
}
