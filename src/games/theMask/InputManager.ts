import type { InputState } from './types'

type Listener = (state: InputState) => void

/** Manages keyboard input (Arrow keys + Space). Mobile controls are HTML overlays. */
export class InputManager {
  private state: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    shoot: false,
  }
  private listeners: Set<Listener> = new Set()
  private keyMap: Record<string, keyof InputState> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    KeyW: 'up',
    KeyS: 'down',
    KeyA: 'left',
    KeyD: 'right',
    ' ': 'shoot',
  }

  constructor() {
    if (typeof window === 'undefined') return
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const key = this.keyMap[e.code]
    if (!key) return
    e.preventDefault()
    if (this.state[key]) return
    this.state = { ...this.state, [key]: true }
    this.notify()
  }

  private handleKeyUp = (e: KeyboardEvent) => {
    const key = this.keyMap[e.code]
    if (!key) return
    e.preventDefault()
    this.state = { ...this.state, [key]: false }
    this.notify()
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.state))
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  /** Called by mobile overlay to set state (e.g. from VirtualControls). */
  setState(partial: Partial<InputState>) {
    this.state = { ...this.state, ...partial }
    this.notify()
  }

  getState(): InputState {
    return this.state
  }

  dispose() {
    if (typeof window === 'undefined') return
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    this.listeners.clear()
  }
}
