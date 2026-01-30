import { useRef, useState, useCallback } from 'react'
import type { TouchInputState } from '../types'

const JOYSTICK_BASE_SIZE = 120
const JOYSTICK_KNOB_SIZE = 48
const JOYSTICK_STICK_RADIUS = (JOYSTICK_BASE_SIZE - JOYSTICK_KNOB_SIZE) / 2

interface VirtualControlsProps {
  onTouchInputChange: (state: TouchInputState) => void
}

/** Screen Y increases downward; joystick "up" (finger toward top) => positive y. */
function offsetToNormalized(offset: { x: number; y: number }) {
  if (JOYSTICK_STICK_RADIUS <= 0) return { x: 0, y: 0 }
  let x = offset.x / JOYSTICK_STICK_RADIUS
  let y = -offset.y / JOYSTICK_STICK_RADIUS
  const len = Math.sqrt(x * x + y * y)
  if (len > 1) {
    x /= len
    y /= len
  }
  return { x, y }
}

export function VirtualControls({ onTouchInputChange }: VirtualControlsProps) {
  const [moveKnob, setMoveKnob] = useState({ x: 0, y: 0 })
  const [aimKnob, setAimKnob] = useState({ x: 0, y: 0 })
  const movePointerId = useRef<number | null>(null)
  const aimPointerId = useRef<number | null>(null)
  const leftBaseRef = useRef<HTMLDivElement>(null)
  const rightBaseRef = useRef<HTMLDivElement>(null)

  const notify = useCallback(
    (joystick: { x: number; y: number }, aim: { x: number; y: number }) => {
      onTouchInputChange({ joystick, aim })
    },
    [onTouchInputChange]
  )

  const clampKnob = useCallback(
    (clientX: number, clientY: number, baseRef: React.RefObject<HTMLDivElement | null>) => {
      const el = baseRef.current
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

  const handleMoveDown = (e: React.PointerEvent) => {
    e.preventDefault()
    if (movePointerId.current !== null) return
    movePointerId.current = e.pointerId
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const offset = clampKnob(e.clientX, e.clientY, leftBaseRef)
    setMoveKnob(offset)
    notify(offsetToNormalized(offset), offsetToNormalized(aimKnob))
  }

  const handleMoveMove = (e: React.PointerEvent) => {
    if (movePointerId.current !== e.pointerId) return
    e.preventDefault()
    const offset = clampKnob(e.clientX, e.clientY, leftBaseRef)
    setMoveKnob(offset)
    notify(offsetToNormalized(offset), offsetToNormalized(aimKnob))
  }

  const handleMoveUp = (e: React.PointerEvent) => {
    if (movePointerId.current !== e.pointerId) return
    e.preventDefault()
    movePointerId.current = null
    setMoveKnob({ x: 0, y: 0 })
    notify({ x: 0, y: 0 }, offsetToNormalized(aimKnob))
  }

  const handleAimDown = (e: React.PointerEvent) => {
    e.preventDefault()
    if (aimPointerId.current !== null) return
    aimPointerId.current = e.pointerId
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const offset = clampKnob(e.clientX, e.clientY, rightBaseRef)
    setAimKnob(offset)
    notify(offsetToNormalized(moveKnob), offsetToNormalized(offset))
  }

  const handleAimMove = (e: React.PointerEvent) => {
    if (aimPointerId.current !== e.pointerId) return
    e.preventDefault()
    const offset = clampKnob(e.clientX, e.clientY, rightBaseRef)
    setAimKnob(offset)
    notify(offsetToNormalized(moveKnob), offsetToNormalized(offset))
  }

  const handleAimUp = (e: React.PointerEvent) => {
    if (aimPointerId.current !== e.pointerId) return
    e.preventDefault()
    aimPointerId.current = null
    setAimKnob({ x: 0, y: 0 })
    notify(offsetToNormalized(moveKnob), { x: 0, y: 0 })
  }

  return (
    <>
      {/* Left: Movement joystick */}
      <div
        ref={leftBaseRef}
        className="fixed bottom-8 left-8 z-50 select-none"
        style={{
          width: JOYSTICK_BASE_SIZE,
          height: JOYSTICK_BASE_SIZE,
          touchAction: 'none',
        }}
        onPointerDown={handleMoveDown}
        onPointerMove={handleMoveMove}
        onPointerUp={handleMoveUp}
        onPointerCancel={handleMoveUp}
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
            left: JOYSTICK_BASE_SIZE / 2 - JOYSTICK_KNOB_SIZE / 2 + moveKnob.x,
            top: JOYSTICK_BASE_SIZE / 2 - JOYSTICK_KNOB_SIZE / 2 + moveKnob.y,
          }}
        />
      </div>

      {/* Right: Aim joystick (hold direction to shoot) */}
      <div
        ref={rightBaseRef}
        className="fixed bottom-8 right-8 z-50 select-none"
        style={{
          width: JOYSTICK_BASE_SIZE,
          height: JOYSTICK_BASE_SIZE,
          touchAction: 'none',
        }}
        onPointerDown={handleAimDown}
        onPointerMove={handleAimMove}
        onPointerUp={handleAimUp}
        onPointerCancel={handleAimUp}
      >
        <div
          className="absolute rounded-full bg-red-500/30 border-2 border-red-400/50"
          style={{
            width: JOYSTICK_BASE_SIZE,
            height: JOYSTICK_BASE_SIZE,
            left: 0,
            top: 0,
          }}
        />
        <div
          className="absolute rounded-full bg-red-500/80 border-2 border-white shadow-lg pointer-events-none"
          style={{
            width: JOYSTICK_KNOB_SIZE,
            height: JOYSTICK_KNOB_SIZE,
            left: JOYSTICK_BASE_SIZE / 2 - JOYSTICK_KNOB_SIZE / 2 + aimKnob.x,
            top: JOYSTICK_BASE_SIZE / 2 - JOYSTICK_KNOB_SIZE / 2 + aimKnob.y,
          }}
        />
      </div>
    </>
  )
}
