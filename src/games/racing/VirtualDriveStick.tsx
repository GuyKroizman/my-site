import { useCallback, useEffect, useRef, useState } from 'react'
import { NEUTRAL_TOUCH_DRIVE_STATE, type TouchDriveState } from './input'
import type { UpgradeId } from './upgrades'

const STEERING_BASE_WIDTH = 176
const STEERING_BASE_HEIGHT = 72
const STEERING_KNOB_SIZE = 56
const STEERING_RADIUS_X = (STEERING_BASE_WIDTH - STEERING_KNOB_SIZE) / 2
const STEERING_DEADZONE = 0.08
const BRAKE_BUTTON_SIZE = 84
const FIRE_BUTTON_SIZE = 80

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

function clampSteeringOffset(clientX: number, baseRef: React.RefObject<HTMLDivElement | null>) {
  const base = baseRef.current
  if (!base) {
    return 0
  }

  const rect = base.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  let x = clientX - centerX
  x = Math.max(-STEERING_RADIUS_X, Math.min(STEERING_RADIUS_X, x))
  return x
}

function steeringOffsetToValue(offsetX: number): number {
  const normalizedX = offsetX / STEERING_RADIUS_X
  return applyDeadzone(normalizedX, STEERING_DEADZONE)
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
  const [steeringOffsetX, setSteeringOffsetX] = useState(0)
  const [showTurboReadyPulse, setShowTurboReadyPulse] = useState(false)
  const [isBraking, setIsBraking] = useState(false)
  const activeSteeringPointerId = useRef<number | null>(null)
  const activeBrakePointerId = useRef<number | null>(null)
  const activeFirePointerId = useRef<number | null>(null)
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

  const emitDriveState = useCallback((nextSteeringOffsetX: number, nextIsBraking: boolean) => {
    onStateChange({
      throttle: nextIsBraking ? -1 : 1,
      steering: steeringOffsetToValue(nextSteeringOffsetX),
    })
  }, [onStateChange])

  useEffect(() => {
    emitDriveState(0, false)
    return () => {
      onStateChange(NEUTRAL_TOUCH_DRIVE_STATE)
      onShoot?.(false)
    }
  }, [emitDriveState, onStateChange, onShoot])

  const resetSteering = useCallback(
    (pointerTarget?: EventTarget | null, pointerId?: number) => {
      if (
        pointerTarget instanceof HTMLElement &&
        typeof pointerId === 'number' &&
        pointerTarget.hasPointerCapture(pointerId)
      ) {
        pointerTarget.releasePointerCapture(pointerId)
      }

      activeSteeringPointerId.current = null
      setSteeringOffsetX(0)
      emitDriveState(0, isBraking)
    },
    [emitDriveState, isBraking]
  )

  const handleSteeringPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (activeSteeringPointerId.current !== null) {
      return
    }

    activeSteeringPointerId.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    const offsetX = clampSteeringOffset(e.clientX, baseRef)
    setSteeringOffsetX(offsetX)
    emitDriveState(offsetX, isBraking)
  }

  const handleSteeringPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeSteeringPointerId.current !== e.pointerId) {
      return
    }

    e.preventDefault()
    const offsetX = clampSteeringOffset(e.clientX, baseRef)
    setSteeringOffsetX(offsetX)
    emitDriveState(offsetX, isBraking)
  }

  const handleSteeringPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeSteeringPointerId.current !== e.pointerId) {
      return
    }

    e.preventDefault()
    resetSteering(e.currentTarget, e.pointerId)
  }

  return (
    <>
      <div
        ref={baseRef}
        className="fixed bottom-8 z-50 select-none pointer-events-auto"
        style={{
          width: STEERING_BASE_WIDTH,
          height: STEERING_BASE_HEIGHT,
          left: 'max(env(safe-area-inset-left, 0px), 4px)',
          touchAction: 'none',
        }}
        onPointerDown={handleSteeringPointerDown}
        onPointerMove={handleSteeringPointerMove}
        onPointerUp={handleSteeringPointerUp}
        onPointerCancel={handleSteeringPointerUp}
      >
        <div
          className="absolute border-2 border-white/60 bg-sky-500/20 shadow-[0_0_24px_rgba(14,165,233,0.25)]"
          style={{
            width: STEERING_BASE_WIDTH,
            height: STEERING_BASE_HEIGHT,
            left: 0,
            top: 0,
            borderRadius: STEERING_BASE_HEIGHT / 2,
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-px w-[126px] -translate-x-1/2 -translate-y-1/2 bg-white/20"
        />
        <div
          className="pointer-events-none absolute rounded-full border-2 border-white/90 bg-sky-400/80 shadow-lg"
          style={{
            width: STEERING_KNOB_SIZE,
            height: STEERING_KNOB_SIZE,
            left: STEERING_BASE_WIDTH / 2 - STEERING_KNOB_SIZE / 2 + steeringOffsetX,
            top: STEERING_BASE_HEIGHT / 2 - STEERING_KNOB_SIZE / 2,
          }}
        />
      </div>
      {showRotateButton && (
        <div
          className="fixed z-50 select-none pointer-events-auto flex items-center justify-center"
          style={{
            width: 44,
            height: 44,
            bottom: showFireButton ? 'calc(2rem + 184px)' : 'calc(2rem + 106px)',
            right: 'calc(2rem + 20px)',
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
      {showFireButton && (
        <div
          className="fixed z-50 select-none pointer-events-auto"
          style={{
            width: FIRE_BUTTON_SIZE,
            height: FIRE_BUTTON_SIZE,
            bottom: 'calc(2rem + 98px)',
            right: '2rem',
            touchAction: 'none',
          }}
          onPointerDown={(e) => {
            activeFirePointerId.current = e.pointerId
            e.currentTarget.setPointerCapture(e.pointerId)
            onShoot?.(true)
          }}
          onPointerUp={(e) => {
            if (activeFirePointerId.current !== e.pointerId) {
              return
            }
            activeFirePointerId.current = null
            onShoot?.(false)
          }}
          onPointerCancel={(e) => {
            if (activeFirePointerId.current !== e.pointerId) {
              return
            }
            activeFirePointerId.current = null
            onShoot?.(false)
          }}
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
      )}
      <div
        className="fixed bottom-8 right-8 z-50 select-none pointer-events-auto"
        style={{
          width: BRAKE_BUTTON_SIZE,
          height: BRAKE_BUTTON_SIZE,
          touchAction: 'none',
        }}
        onPointerDown={(e) => {
          e.preventDefault()
          if (activeBrakePointerId.current !== null) {
            return
          }
          activeBrakePointerId.current = e.pointerId
          e.currentTarget.setPointerCapture(e.pointerId)
          setIsBraking(true)
          emitDriveState(steeringOffsetX, true)
        }}
        onPointerUp={(e) => {
          if (activeBrakePointerId.current !== e.pointerId) {
            return
          }
          e.preventDefault()
          activeBrakePointerId.current = null
          setIsBraking(false)
          emitDriveState(steeringOffsetX, false)
        }}
        onPointerCancel={(e) => {
          if (activeBrakePointerId.current !== e.pointerId) {
            return
          }
          activeBrakePointerId.current = null
          setIsBraking(false)
          emitDriveState(steeringOffsetX, false)
        }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: isBraking
              ? 'radial-gradient(circle, rgba(248,113,113,0.95), rgba(153,27,27,0.95))'
              : 'radial-gradient(circle, rgba(239,68,68,0.9), rgba(127,29,29,0.9))',
            border: '3px solid rgba(255, 255, 255, 0.45)',
            boxShadow: isBraking ? '0 0 24px rgba(248, 113, 113, 0.55)' : '0 0 14px rgba(127, 29, 29, 0.35)',
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[15px] font-black uppercase tracking-[0.18em] text-white">
          Brake
        </div>
      </div>
    </>
  )
}
