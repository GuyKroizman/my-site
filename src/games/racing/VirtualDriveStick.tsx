import { useCallback, useRef, useState } from 'react'
import { NEUTRAL_TOUCH_DRIVE_STATE, type TouchDriveState } from './input'

const JOYSTICK_BASE_SIZE = 120
const JOYSTICK_KNOB_SIZE = 48
const JOYSTICK_STICK_RADIUS = (JOYSTICK_BASE_SIZE - JOYSTICK_KNOB_SIZE) / 2
const JOYSTICK_DEADZONE = 0.15
const STEERING_CURVE_EXPONENT = 1

interface VirtualDriveStickProps {
  onStateChange: (state: TouchDriveState) => void
  onShoot?: (shooting: boolean) => void
}

function applyDeadzone(value: number, deadzone: number) {
  const magnitude = Math.abs(value)
  if (magnitude <= deadzone) {
    return 0
  }

  return Math.sign(value) * ((magnitude - deadzone) / (1 - deadzone))
}

function shapeSteering(value: number) {
  if (value === 0) {
    return 0
  }

  return Math.sign(value) * Math.pow(Math.abs(value), STEERING_CURVE_EXPONENT)
}

function clampOffset(
  clientX: number,
  clientY: number,
  baseRef: React.RefObject<HTMLDivElement | null>
) {
  const base = baseRef.current
  if (!base) {
    return { x: 0, y: 0 }
  }

  const rect = base.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  let x = clientX - centerX
  let y = clientY - centerY
  const distance = Math.hypot(x, y)

  if (distance > JOYSTICK_STICK_RADIUS) {
    const scale = JOYSTICK_STICK_RADIUS / distance
    x *= scale
    y *= scale
  }

  return { x, y }
}

function offsetToDriveState(offset: { x: number; y: number }): TouchDriveState {
  if (JOYSTICK_STICK_RADIUS <= 0) {
    return NEUTRAL_TOUCH_DRIVE_STATE
  }

  const normalizedX = offset.x / JOYSTICK_STICK_RADIUS
  const normalizedY = -offset.y / JOYSTICK_STICK_RADIUS
  const steering = shapeSteering(applyDeadzone(normalizedX, JOYSTICK_DEADZONE))
  const throttle = applyDeadzone(normalizedY, JOYSTICK_DEADZONE)

  return { throttle, steering }
}

export function VirtualDriveStick({ onStateChange, onShoot }: VirtualDriveStickProps) {
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 })
  const activePointerId = useRef<number | null>(null)
  const baseRef = useRef<HTMLDivElement>(null)

  const emitState = useCallback(
    (offset: { x: number; y: number }) => {
      onStateChange(offsetToDriveState(offset))
    },
    [onStateChange]
  )

  const resetStick = useCallback(
    (pointerTarget?: EventTarget | null, pointerId?: number) => {
      if (
        pointerTarget instanceof HTMLElement &&
        typeof pointerId === 'number' &&
        pointerTarget.hasPointerCapture(pointerId)
      ) {
        pointerTarget.releasePointerCapture(pointerId)
      }

      activePointerId.current = null
      setKnobOffset({ x: 0, y: 0 })
      onStateChange(NEUTRAL_TOUCH_DRIVE_STATE)
    },
    [onStateChange]
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (activePointerId.current !== null) {
      return
    }

    activePointerId.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    const offset = clampOffset(e.clientX, e.clientY, baseRef)
    setKnobOffset(offset)
    emitState(offset)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) {
      return
    }

    e.preventDefault()
    const offset = clampOffset(e.clientX, e.clientY, baseRef)
    setKnobOffset(offset)
    emitState(offset)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) {
      return
    }

    e.preventDefault()
    resetStick(e.currentTarget, e.pointerId)
  }

  return (
    <>
      <div
        ref={baseRef}
        className="fixed bottom-8 left-8 z-50 select-none pointer-events-auto"
        style={{
          width: JOYSTICK_BASE_SIZE,
          height: JOYSTICK_BASE_SIZE,
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="absolute rounded-full border-2 border-white/60 bg-sky-500/20 shadow-[0_0_24px_rgba(14,165,233,0.25)]"
          style={{
            width: JOYSTICK_BASE_SIZE,
            height: JOYSTICK_BASE_SIZE,
            left: 0,
            top: 0,
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-px w-[72px] -translate-x-1/2 -translate-y-1/2 bg-white/20"
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 w-px h-[72px] -translate-x-1/2 -translate-y-1/2 bg-white/20"
        />
        <div
          className="pointer-events-none absolute rounded-full border-2 border-white/90 bg-sky-400/75 shadow-lg"
          style={{
            width: JOYSTICK_KNOB_SIZE,
            height: JOYSTICK_KNOB_SIZE,
            left: JOYSTICK_BASE_SIZE / 2 - JOYSTICK_KNOB_SIZE / 2 + knobOffset.x,
            top: JOYSTICK_BASE_SIZE / 2 - JOYSTICK_KNOB_SIZE / 2 + knobOffset.y,
          }}
        />
      </div>
      <div
        className="fixed bottom-8 right-8 z-50 select-none pointer-events-auto flex items-center justify-center"
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #ff6600, #cc2200)',
          border: '3px solid rgba(255, 200, 0, 0.7)',
          touchAction: 'none',
          color: 'white',
          fontWeight: 'bold',
          fontSize: 13,
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          onShoot?.(true)
        }}
        onPointerUp={() => onShoot?.(false)}
        onPointerCancel={() => onShoot?.(false)}
      >
        FIRE
      </div>
    </>
  )
}
