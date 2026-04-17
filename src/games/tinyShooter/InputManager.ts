import { GAMEPAD_DEADZONE } from './types'

export interface FPSInputState {
  moveX: number
  moveZ: number
  lookX: number
  lookY: number
  shooting: boolean
}

export interface GamepadStatus {
  connected: boolean
  active: boolean
  id: string | null
}

const DEFAULT_INPUT_STATE: FPSInputState = {
  moveX: 0,
  moveZ: 0,
  lookX: 0,
  lookY: 0,
  shooting: false,
}

export class InputManager {
  private state: FPSInputState = { ...DEFAULT_INPUT_STATE }
  private keyboardState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  }
  private mouseShooting = false
  private mouseDeltaX = 0
  private mouseDeltaY = 0
  private locked = false
  private canvas: HTMLCanvasElement
  private activeGamepadIndex: number | null = null
  private connectedGamepadId: string | null = null
  private lastGamepadStatusKey = ''

  onPointerLockChange?: (locked: boolean) => void
  onGamepadStatusChange?: (status: GamepadStatus) => void

  private handleKeyDown = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'KeyW': this.keyboardState.forward = true; e.preventDefault(); break
      case 'KeyS': this.keyboardState.backward = true; e.preventDefault(); break
      case 'KeyA': this.keyboardState.left = true; e.preventDefault(); break
      case 'KeyD': this.keyboardState.right = true; e.preventDefault(); break
    }
  }

  private handleKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'KeyW': this.keyboardState.forward = false; break
      case 'KeyS': this.keyboardState.backward = false; break
      case 'KeyA': this.keyboardState.left = false; break
      case 'KeyD': this.keyboardState.right = false; break
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
      this.mouseShooting = true
    }
  }

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.mouseShooting = false
    }
  }

  private handlePointerLockChange = () => {
    this.locked = document.pointerLockElement === this.canvas
    if (!this.locked) {
      this.keyboardState.forward = false
      this.keyboardState.backward = false
      this.keyboardState.left = false
      this.keyboardState.right = false
      this.mouseShooting = false
    }
    this.onPointerLockChange?.(this.locked)
  }

  private handleGamepadConnected = (event: GamepadEvent) => {
    this.connectedGamepadId = event.gamepad.id
    this.selectActiveGamepad()
    this.emitGamepadStatus()
  }

  private handleGamepadDisconnected = (event: GamepadEvent) => {
    if (this.activeGamepadIndex === event.gamepad.index) {
      this.activeGamepadIndex = null
      this.state.lookX = 0
      this.state.lookY = 0
      this.state.shooting = false
    }
    this.connectedGamepadId = this.getFirstConnectedGamepad()?.id ?? null
    this.selectActiveGamepad()
    this.emitGamepadStatus()
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    document.addEventListener('mousemove', this.handleMouseMove)
    canvas.addEventListener('mousedown', this.handleMouseDown)
    document.addEventListener('mouseup', this.handleMouseUp)
    document.addEventListener('pointerlockchange', this.handlePointerLockChange)
    window.addEventListener('gamepadconnected', this.handleGamepadConnected)
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected)

    this.connectedGamepadId = this.getFirstConnectedGamepad()?.id ?? null
    this.selectActiveGamepad()
    this.emitGamepadStatus()
  }

  private getGamepads(): Gamepad[] {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return []
    }

    return Array.from(navigator.getGamepads()).filter((pad): pad is Gamepad => pad !== null)
  }

  private getFirstConnectedGamepad(): Gamepad | null {
    return this.getGamepads()[0] ?? null
  }

  private selectActiveGamepad(): void {
    const pads = this.getGamepads()
    const standardPad = pads.find((pad) => pad.mapping === 'standard')
    const nextPad = standardPad ?? pads[0] ?? null
    this.activeGamepadIndex = nextPad?.index ?? null
  }

  private emitGamepadStatus(): void {
    const pads = this.getGamepads()
    const activePad = this.getActiveGamepad()
    const connectedPad = pads.find((pad) => pad.id === this.connectedGamepadId) ?? pads[0] ?? null
    const status = {
      connected: pads.length > 0,
      active: activePad !== null,
      id: activePad?.id ?? connectedPad?.id ?? null,
    }
    const statusKey = `${status.connected}:${status.active}:${status.id ?? ''}`
    if (statusKey === this.lastGamepadStatusKey) return

    this.lastGamepadStatusKey = statusKey
    this.onGamepadStatusChange?.(status)
  }

  private getActiveGamepad(): Gamepad | null {
    const pads = this.getGamepads()
    if (pads.length === 0) return null

    if (this.activeGamepadIndex !== null) {
      const activePad = pads.find((pad) => pad.index === this.activeGamepadIndex)
      if (activePad) return activePad
    }

    this.selectActiveGamepad()
    return this.activeGamepadIndex === null
      ? null
      : pads.find((pad) => pad.index === this.activeGamepadIndex) ?? null
  }

  private normalizeAxis(value: number | undefined): number {
    const axis = value ?? 0
    if (Math.abs(axis) < GAMEPAD_DEADZONE) return 0

    const magnitude = (Math.abs(axis) - GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE)
    return Math.sign(axis) * Math.min(magnitude, 1)
  }

  update(): void {
    const keyboardMoveX = (this.keyboardState.right ? 1 : 0) - (this.keyboardState.left ? 1 : 0)
    const keyboardMoveZ = (this.keyboardState.backward ? 1 : 0) - (this.keyboardState.forward ? 1 : 0)

    const gamepad = this.getActiveGamepad()
    if (!gamepad) {
      this.state = {
        moveX: keyboardMoveX,
        moveZ: keyboardMoveZ,
        lookX: 0,
        lookY: 0,
        shooting: this.locked && this.mouseShooting,
      }
      this.emitGamepadStatus()
      return
    }

    const gamepadMoveX = this.normalizeAxis(gamepad.axes[0])
    const gamepadMoveZ = this.normalizeAxis(gamepad.axes[1])
    const gamepadLookX = this.normalizeAxis(gamepad.axes[2])
    const gamepadLookY = this.normalizeAxis(gamepad.axes[3])
    const triggerShoot = (gamepad.buttons[7]?.value ?? 0) > 0.2
    const bumperShoot = gamepad.buttons[5]?.pressed ?? false

    this.connectedGamepadId = gamepad.id
    this.state = {
      moveX: gamepadMoveX !== 0 ? gamepadMoveX : keyboardMoveX,
      moveZ: gamepadMoveZ !== 0 ? gamepadMoveZ : keyboardMoveZ,
      lookX: gamepadLookX,
      lookY: gamepadLookY,
      shooting: triggerShoot || bumperShoot || (this.locked && this.mouseShooting),
    }
    this.emitGamepadStatus()
  }

  getState(): Readonly<FPSInputState> {
    return this.state
  }

  isLocked(): boolean {
    return this.locked
  }

  hasActiveGamepad(): boolean {
    return this.getActiveGamepad() !== null
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
    window.removeEventListener('gamepadconnected', this.handleGamepadConnected)
    window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected)
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock()
    }
  }
}
