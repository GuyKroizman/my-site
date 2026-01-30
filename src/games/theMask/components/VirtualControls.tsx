import { useRef, useState, useCallback } from 'react'
import type { TouchInputState } from '../types'

const JOYSTICK_BASE_SIZE = 120
const JOYSTICK_KNOB_SIZE = 48
const JOYSTICK_STICK_RADIUS = (JOYSTICK_BASE_SIZE - JOYSTICK_KNOB_SIZE) / 2
const SHOOT_BUTTON_SIZE = 88

interface VirtualControlsProps {
  onTouchInputChange: (state: TouchInputState) => void
}

export function VirtualControls({ onTouchInputChange }: VirtualControlsProps) {
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 })
  const [shootPressed, setShootPressed] = useState(false)
  const joystickPointerId = useRef<number | null>(null)
  const joystickBaseRef = useRef<HTMLDivElement>(null)

  const clampKnob = useCallback(
    (clientX: number, clientY: number) => {
      const el = joystickBaseRef.current
      if (!el) return { x: 0, y: 0 }
      const rect = el.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      let dx = clientX - centerX
      let dy = clientY - centerY
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len > JOYSTICK_STICK_RADIUS) {
        const scale = JOYSTICK_STICK_RADIUS / len
        dx *= scale
        dy *= scale
      }
      return { x: dx, y: dy }
    },
    []
  )

  const offsetToNormalized = useCallback((offset: { x: number; y: number }) => {
    if (JOYSTICK_STICK_RADIUS <= 0) return { x: 0, y: 0 }
    let x = offset.x / JOYSTICK_STICK_RADIUS
    let y = -offset.y / JOYSTICK_STICK_RADIUS
    const len = Math.sqrt(x * x + y * y)
    if (len > 1) {
      x /= len
      y /= len
    }
    return { x, y }
  }, [])

  const notify = useCallback(
    (joy: { x: number; y: number }, shoot: boolean) => {
      onTouchInputChange({ joystick: joy, shoot })
    },
    [onTouchInputChange]
  )

  const handleJoystickPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    if (joystickPointerId.current !== null) return
    joystickPointerId.current = e.pointerId
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const { x, y } = clampKnob(e.clientX, e.clientY)
    setKnobOffset({ x, y })
    notify(offsetToNormalized({ x, y }), shootPressed)
  }

  const handleJoystickPointerMove = (e: React.PointerEvent) => {
    if (joystickPointerId.current !== e.pointerId) return
    e.preventDefault()
    const { x, y } = clampKnob(e.clientX, e.clientY)
    setKnobOffset({ x, y })
    notify(offsetToNormalized({ x, y }), shootPressed)
  }

  const handleJoystickPointerUp = (e: React.PointerEvent) => {
    if (joystickPointerId.current !== e.pointerId) return
    e.preventDefault()
    joystickPointerId.current = null
    setKnobOffset({ x: 0, y: 0 })
    notify({ x: 0, y: 0 }, shootPressed)
  }

  const handleShootPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    setShootPressed(true)
    notify(offsetToNormalized(knobOffset), true)
  }

  const handleShootPointerUp = (e: React.PointerEvent) => {
    e.preventDefault()
    setShootPressed(false)
    notify(offsetToNormalized(knobOffset), false)
  }

  return (
    <>
      {/* Left: Floating Joystick */}
      <div
        ref={joystickBaseRef}
        className="fixed bottom-8 left-8 z-50 select-none"
        style={{
          width: JOYSTICK_BASE_SIZE,
          height: JOYSTICK_BASE_SIZE,
          touchAction: 'none',
        }}
        onPointerDown={handleJoystickPointerDown}
        onPointerMove={handleJoystickPointerMove}
        onPointerUp={handleJoystickPointerUp}
        onPointerCancel={handleJoystickPointerUp}
      >
        <div
          className="absolute rounded-full bg-white/30 border-2 border-white/50"
          style={{
            width: JOYSTICK_BASE_SIZE,
            height: JOYSTICK_BASE_SIZE,
            left: 0,
            top: 0,
          }}
        />
        <div
          className="absolute rounded-full bg-white/70 border-2 border-white shadow-lg pointer-events-none"
          style={{
            width: JOYSTICK_KNOB_SIZE,
            height: JOYSTICK_KNOB_SIZE,
            left: JOYSTICK_BASE_SIZE / 2 - JOYSTICK_KNOB_SIZE / 2 + knobOffset.x,
            top: JOYSTICK_BASE_SIZE / 2 - JOYSTICK_KNOB_SIZE / 2 + knobOffset.y,
          }}
        />
      </div>

      {/* Right: Shoot button */}
      <div
        className="fixed bottom-8 right-8 z-50 select-none"
        style={{
          width: SHOOT_BUTTON_SIZE,
          height: SHOOT_BUTTON_SIZE,
          touchAction: 'none',
        }}
        onPointerDown={handleShootPointerDown}
        onPointerUp={handleShootPointerUp}
        onPointerCancel={handleShootPointerUp}
      >
        <div
          className={`w-full h-full rounded-full border-2 border-white/70 shadow-lg flex items-center justify-center text-2xl transition-transform ${
            shootPressed ? 'bg-red-600 scale-95' : 'bg-red-500'
          }`}
        >
          🔫
        </div>
      </div>
    </>
  )
}
