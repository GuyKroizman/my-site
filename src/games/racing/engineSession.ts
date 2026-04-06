export class RacingSessionController {
  private raceStartTime: number = 0
  private timerActive: boolean = false
  private pauseStartTime: number = 0
  private totalPauseTime: number = 0
  private playerFailureTime: number | null = null
  private levelMineArmed: boolean = false

  public reset(): void {
    this.raceStartTime = 0
    this.timerActive = false
    this.pauseStartTime = 0
    this.totalPauseTime = 0
    this.playerFailureTime = null
    this.levelMineArmed = false
  }

  public beginRaceIfNeeded(canStart: boolean): boolean {
    if (!canStart || this.timerActive) {
      return false
    }

    this.timerActive = true
    this.raceStartTime = performance.now() / 1000
    return true
  }

  public getElapsedRaceTime(nowSeconds: number = performance.now() / 1000): number {
    if (!this.timerActive) {
      return 0
    }

    return nowSeconds - this.raceStartTime - this.totalPauseTime
  }

  public isTimerActive(): boolean {
    return this.timerActive
  }

  public markLevelMineArmed(): void {
    this.levelMineArmed = true
  }

  public isLevelMineArmed(): boolean {
    return this.levelMineArmed
  }

  public recordPlayerFailure(nowSeconds: number = performance.now() / 1000): void {
    if (this.playerFailureTime === null) {
      this.playerFailureTime = nowSeconds
    }
  }

  public clearPlayerFailure(): void {
    this.playerFailureTime = null
  }

  public getPlayerFailureElapsed(nowSeconds: number = performance.now() / 1000): number | null {
    if (this.playerFailureTime === null) {
      return null
    }

    return nowSeconds - this.playerFailureTime
  }

  public pause(): void {
    this.pauseStartTime = performance.now() / 1000
  }

  public resume(): void {
    const pauseEndTime = performance.now() / 1000
    const pauseDuration = pauseEndTime - this.pauseStartTime
    this.totalPauseTime += pauseDuration
  }
}
