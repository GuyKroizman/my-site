export interface FPSInputState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  shooting: boolean
}

export class InputManager {
  private state: FPSInputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    shooting: false,
  }
  private mouseDeltaX = 0
  private mouseDeltaY = 0
  private locked = false
  private canvas: HTMLCanvasElement

  onPointerLockChange?: (locked: boolean) => void

  private handleKeyDown = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'KeyW': this.state.forward = true; e.preventDefault(); break
      case 'KeyS': this.state.backward = true; e.preventDefault(); break
      case 'KeyA': this.state.left = true; e.preventDefault(); break
      case 'KeyD': this.state.right = true; e.preventDefault(); break
    }
  }

  private handleKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'KeyW': this.state.forward = false; break
      case 'KeyS': this.state.backward = false; break
      case 'KeyA': this.state.left = false; break
      case 'KeyD': this.state.right = false; break
    }
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.locked) return
    this.mouseDeltaX += e.movementX
    this.mouseDeltaY += e.movementY
  }

  private handleMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      if (!this.locked) {
        this.canvas.requestPointerLock()
        return
      }
      this.state.shooting = true
    }
  }

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.state.shooting = false
    }
  }

  private handlePointerLockChange = () => {
    this.locked = document.pointerLockElement === this.canvas
    if (!this.locked) {
      this.state.forward = false
      this.state.backward = false
      this.state.left = false
      this.state.right = false
      this.state.shooting = false
    }
    this.onPointerLockChange?.(this.locked)
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    document.addEventListener('mousemove', this.handleMouseMove)
    canvas.addEventListener('mousedown', this.handleMouseDown)
    document.addEventListener('mouseup', this.handleMouseUp)
    document.addEventListener('pointerlockchange', this.handlePointerLockChange)
  }

  getState(): Readonly<FPSInputState> {
    return this.state
  }

  isLocked(): boolean {
    return this.locked
  }

  consumeMouseDelta(): { dx: number; dy: number } {
    const dx = this.mouseDeltaX
    const dy = this.mouseDeltaY
    this.mouseDeltaX = 0
    this.mouseDeltaY = 0
    return { dx, dy }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    document.removeEventListener('mousemove', this.handleMouseMove)
    this.canvas.removeEventListener('mousedown', this.handleMouseDown)
    document.removeEventListener('mouseup', this.handleMouseUp)
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange)
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock()
    }
  }
}
