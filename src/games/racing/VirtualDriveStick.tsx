import { useCallback, useEffect, useRef, useState } from 'react'
import { NEUTRAL_TOUCH_DRIVE_STATE, type TouchDriveState } from './input'
import type { UpgradeId } from './upgrades'

const JOYSTICK_BASE_WIDTH = 150
const JOYSTICK_BASE_HEIGHT = 120
const JOYSTICK_KNOB_SIZE = 48
const JOYSTICK_RADIUS_X = (JOYSTICK_BASE_WIDTH - JOYSTICK_KNOB_SIZE) / 2
const JOYSTICK_RADIUS_Y = (JOYSTICK_BASE_HEIGHT - JOYSTICK_KNOB_SIZE) / 2
const JOYSTICK_DEADZONE = 0.15

interface VirtualDriveStickProps {
  onStateChange: (state: TouchDriveState) => void
  onShoot?: (shooting: boolean) => void
  showFireButton?: boolean
  fireButtonIcon?: string
  activeWeaponId?: UpgradeId | null
  turboState?: 'hidden' | 'ready' | 'active' | 'cooldown'
  turboCooldownProgress?: number
  onRotateWeapon?: () => void
  showRotateButton?: boolean
  rotateButtonIcon?: string
}

function applyDeadzone(value: number, deadzone: number) {
  const magnitude = Math.abs(value)
  if (magnitude <= deadzone) {
    return 0
  }

  return Math.sign(value) * ((magnitude - deadzone) / (1 - deadzone))
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

  const nx = x / JOYSTICK_RADIUS_X
  const ny = y / JOYSTICK_RADIUS_Y
  const ellipseDist = nx * nx + ny * ny
  if (ellipseDist > 1) {
    const scale = 1 / Math.sqrt(ellipseDist)
    x *= scale
    y *= scale
  }

  return { x, y }
}

function offsetToDriveState(offset: { x: number; y: number }): TouchDriveState {
  const normalizedX = offset.x / JOYSTICK_RADIUS_X
  const normalizedY = -offset.y / JOYSTICK_RADIUS_Y
  const steering = applyDeadzone(normalizedX, JOYSTICK_DEADZONE)
  const throttle = applyDeadzone(normalizedY, JOYSTICK_DEADZONE)

  return { throttle, steering }
}

export function VirtualDriveStick({
  onStateChange,
  onShoot,
  showFireButton = true,
  fireButtonIcon = '',
  activeWeaponId = null,
  turboState = 'hidden',
  turboCooldownProgress = 1,
  onRotateWeapon,
  showRotateButton = false,
  rotateButtonIcon = '',
}: VirtualDriveStickProps) {
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 })
  const [showTurboReadyPulse, setShowTurboReadyPulse] = useState(false)
  const activePointerId = useRef<number | null>(null)
  const baseRef = useRef<HTMLDivElement>(null)
  const previousTurboStateRef = useRef(turboState)

  useEffect(() => {
    const wasReady = previousTurboStateRef.current === 'ready'
    const isReady = turboState === 'ready'
    previousTurboStateRef.current = turboState

    if (activeWeaponId !== 'turbo_boost' || !isReady || wasReady) {
      return
    }

    setShowTurboReadyPulse(true)
    const timeoutId = window.setTimeout(() => {
      setShowTurboReadyPulse(false)
    }, 420)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeWeaponId, turboState])

  const isTurboSelected = activeWeaponId === 'turbo_boost'
  const turboProgress = Math.max(0, Math.min(1, turboCooldownProgress))
  const turboProgressDegrees = turboProgress * 360
  const fireButtonOpacity = isTurboSelected && turboState !== 'ready' ? 0.7 : 1
  const turboRingBackground = turboState === 'cooldown'
    ? `conic-gradient(from -90deg, rgba(250, 204, 21, 0.95) 0deg ${turboProgressDegrees}deg, rgba(255, 255, 255, 0.16) ${turboProgressDegrees}deg 360deg)`
    : turboState === 'active'
      ? 'conic-gradient(from -90deg, rgba(253, 224, 71, 0.85) 0deg 360deg)'
      : 'conic-gradient(from -90deg, rgba(250, 204, 21, 0.92) 0deg 360deg)'

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
        className="fixed bottom-8 z-50 select-none pointer-events-auto"
        style={{
          width: JOYSTICK_BASE_WIDTH,
          height: JOYSTICK_BASE_HEIGHT,
          left: 'max(env(safe-area-inset-left, 0px), 4px)',
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
            width: JOYSTICK_BASE_WIDTH,
            height: JOYSTICK_BASE_HEIGHT,
            left: 0,
            top: 0,
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-px w-[102px] -translate-x-1/2 -translate-y-1/2 bg-white/20"
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 w-px h-[72px] -translate-x-1/2 -translate-y-1/2 bg-white/20"
        />
        <div
          className="pointer-events-none absolute rounded-full border-2 border-white/90 bg-sky-400/75 shadow-lg"
          style={{
            width: JOYSTICK_KNOB_SIZE,
            height: JOYSTICK_KNOB_SIZE,
            left: JOYSTICK_BASE_WIDTH / 2 - JOYSTICK_KNOB_SIZE / 2 + knobOffset.x,
            top: JOYSTICK_BASE_HEIGHT / 2 - JOYSTICK_KNOB_SIZE / 2 + knobOffset.y,
          }}
        />
      </div>
      {showFireButton && (
        <>
          {showRotateButton && (
            <div
              className="fixed z-50 select-none pointer-events-auto flex items-center justify-center"
              style={{
                width: 44,
                height: 44,
                bottom: 'calc(2rem + 88px)',
                right: 'calc(2rem + 18px)',
                borderRadius: '50%',
                background: 'radial-gradient(circle, #555, #333)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                touchAction: 'none',
                fontSize: 20,
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                onRotateWeapon?.()
              }}
              onPointerUp={() => {}}
              onPointerCancel={() => {}}
            >
              {rotateButtonIcon}
            </div>
          )}
          <div
            className="fixed bottom-8 right-8 z-50 select-none pointer-events-auto"
            style={{
              width: 80,
              height: 80,
              touchAction: 'none',
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              onShoot?.(true)
            }}
            onPointerUp={() => onShoot?.(false)}
            onPointerCancel={() => onShoot?.(false)}
          >
            {isTurboSelected && (
              <div
                className="pointer-events-none absolute inset-0 rounded-full transition-transform duration-300 ease-out"
                style={{
                  background: turboRingBackground,
                  opacity: turboState === 'active' ? 0.95 : 1,
                  transform: showTurboReadyPulse ? 'scale(1.14)' : 'scale(1)',
                  boxShadow: showTurboReadyPulse ? '0 0 28px rgba(250, 204, 21, 0.85)' : '0 0 14px rgba(250, 204, 21, 0.35)',
                }}
              />
            )}
            <div
              className="pointer-events-none absolute inset-[6px] rounded-full bg-gray-950/60"
            />
            <div
              className="absolute inset-0 flex items-center justify-center rounded-full transition-all duration-200"
              style={{
                background: turboState === 'active'
                  ? 'radial-gradient(circle, #fde047, #ea580c)'
                  : 'radial-gradient(circle, #ff6600, #cc2200)',
                border: isTurboSelected
                  ? '3px solid rgba(250, 204, 21, 0.9)'
                  : '3px solid rgba(255, 200, 0, 0.7)',
                color: 'white',
                fontWeight: 'bold',
                fontSize: 28,
                opacity: fireButtonOpacity,
                boxShadow: turboState === 'active'
                  ? '0 0 24px rgba(251, 191, 36, 0.75)'
                  : undefined,
              }}
            >
              {fireButtonIcon}
            </div>
          </div>
        </>
      )}
    </>
  )
}
