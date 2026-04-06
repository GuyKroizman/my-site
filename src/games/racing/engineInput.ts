export interface EngineInputBindings {
  onFirePressedChange: (pressed: boolean) => void
  onRotateWeapon: () => void
}

export class RacingEngineInputController {
  private keyDownHandler: ((event: KeyboardEvent) => void) | null = null
  private keyUpHandler: ((event: KeyboardEvent) => void) | null = null

  constructor(private readonly bindings: EngineInputBindings) {}

  public attach(): void {
    this.keyDownHandler = (event: KeyboardEvent) => {
      if (event.code === 'KeyX') {
        this.bindings.onFirePressedChange(true)
      }
      if (event.code === 'KeyZ') {
        this.bindings.onRotateWeapon()
      }
    }

    this.keyUpHandler = (event: KeyboardEvent) => {
      if (event.code === 'KeyX') {
        this.bindings.onFirePressedChange(false)
      }
    }

    window.addEventListener('keydown', this.keyDownHandler)
    window.addEventListener('keyup', this.keyUpHandler)
  }

  public dispose(): void {
    if (this.keyDownHandler) {
      window.removeEventListener('keydown', this.keyDownHandler)
      this.keyDownHandler = null
    }
    if (this.keyUpHandler) {
      window.removeEventListener('keyup', this.keyUpHandler)
      this.keyUpHandler = null
    }
  }
}
