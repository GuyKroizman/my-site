import { useEffect, useRef, useState } from 'react'
import type { InputState } from '../types'

interface VirtualControlsProps {
  onStateChange: (state: InputState) => void
}

export function VirtualControls({ onStateChange }: VirtualControlsProps) {
  const [activeButtons, setActiveButtons] = useState<Set<string>>(new Set())
  const leftContainerRef = useRef<HTMLDivElement>(null)
  const rightContainerRef = useRef<HTMLDivElement>(null)
  const forwardBackwardControlRef = useRef<HTMLDivElement>(null)
  const activeForwardBackwardTouch = useRef<number | null>(null)

  const updateState = (active: Set<string>) => {
    onStateChange({
      up: active.has('up'),
      down: active.has('down'),
      left: active.has('left'),
      right: active.has('right'),
      shoot: active.has('shoot'),
    })
  }

  const handleTouchStart = (direction: string) => (e: React.TouchEvent) => {
    e.preventDefault()
    const newActive = new Set(activeButtons)
    newActive.add(direction)
    setActiveButtons(newActive)
    updateState(newActive)
  }

  const handleTouchEnd = (direction: string) => (e: React.TouchEvent) => {
    e.preventDefault()
    const newActive = new Set(activeButtons)
    newActive.delete(direction)
    setActiveButtons(newActive)
    updateState(newActive)
  }

  const handleTouchCancel = () => {
    setActiveButtons(new Set())
    updateState(new Set())
  }

  const handleForwardBackwardTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length > 0) {
      const touch = e.touches[0]
      activeForwardBackwardTouch.current = touch.identifier
      updateForwardBackwardState(touch.clientX, touch.clientY)
    }
  }

  const handleForwardBackwardTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (activeForwardBackwardTouch.current !== null) {
      const touch = Array.from(e.touches).find(
        (t) => t.identifier === activeForwardBackwardTouch.current
      )
      if (touch) updateForwardBackwardState(touch.clientX, touch.clientY)
    }
  }

  const handleForwardBackwardTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    if (activeForwardBackwardTouch.current !== null) {
      const touchEnded = Array.from(e.changedTouches).find(
        (t) => t.identifier === activeForwardBackwardTouch.current
      )
      if (touchEnded) {
        activeForwardBackwardTouch.current = null
        const newActive = new Set(activeButtons)
        newActive.delete('up')
        newActive.delete('down')
        setActiveButtons(newActive)
        updateState(newActive)
      }
    }
  }

  const updateForwardBackwardState = (_clientX: number, clientY: number) => {
    if (!forwardBackwardControlRef.current) return
    const rect = forwardBackwardControlRef.current.getBoundingClientRect()
    const touchY = clientY - rect.top
    const tolerance = 10
    const isWithinBounds =
      touchY >= -tolerance && touchY <= rect.height + tolerance
    const newActive = new Set(activeButtons)
    if (isWithinBounds) {
      const midpoint = rect.height / 2
      if (touchY < midpoint) {
        newActive.add('up')
        newActive.delete('down')
      } else {
        newActive.add('down')
        newActive.delete('up')
      }
    } else {
      newActive.delete('up')
      newActive.delete('down')
    }
    setActiveButtons(newActive)
    updateState(newActive)
  }

  useEffect(() => {
    const leftContainer = leftContainerRef.current
    const rightContainer = rightContainerRef.current
    const forwardBackwardControl = forwardBackwardControlRef.current
    const preventDefault = (e: TouchEvent) => e.preventDefault()
    const containers = [leftContainer, rightContainer, forwardBackwardControl].filter(
      Boolean
    ) as HTMLElement[]
    containers.forEach((el) => {
      el.addEventListener('touchstart', preventDefault, { passive: false })
      el.addEventListener('touchmove', preventDefault, { passive: false })
      el.addEventListener('touchend', preventDefault, { passive: false })
    })
    return () => {
      containers.forEach((el) => {
        el.removeEventListener('touchstart', preventDefault)
        el.removeEventListener('touchmove', preventDefault)
        el.removeEventListener('touchend', preventDefault)
      })
    }
  }, [])

  const buttonClass = (direction: string) => {
    const base =
      'flex items-center justify-center text-white font-bold text-2xl select-none touch-none'
    const active = activeButtons.has(direction)
      ? 'bg-blue-600 bg-opacity-70 scale-95'
      : 'bg-blue-500 bg-opacity-70 active:bg-blue-600'
    return `${base} ${active} transition-all duration-75`
  }

  const btnStyle = {
    width: '60px',
    height: '60px',
    borderRadius: '8px',
    minWidth: '60px',
    minHeight: '60px',
  }

  return (
    <>
      <div
        ref={leftContainerRef}
        className="fixed bottom-4 left-4 z-50 pointer-events-auto"
        style={{ touchAction: 'none' }}
      >
        <div
          ref={forwardBackwardControlRef}
          className="relative"
          style={{
            width: '60px',
            height: '128px',
            borderRadius: '8px',
            overflow: 'hidden',
            touchAction: 'none',
          }}
          onTouchStart={handleForwardBackwardTouchStart}
          onTouchMove={handleForwardBackwardTouchMove}
          onTouchEnd={handleForwardBackwardTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          <div
            className={`absolute top-0 left-0 right-0 flex items-center justify-center text-white font-bold text-2xl select-none transition-all duration-75 ${
              activeButtons.has('up') ? 'bg-blue-600 bg-opacity-70' : 'bg-blue-500 bg-opacity-70'
            }`}
            style={{
              height: '50%',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              borderBottom: '2px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            ↑
          </div>
          <div
            className={`absolute bottom-0 left-0 right-0 flex items-center justify-center text-white font-bold text-2xl select-none transition-all duration-75 ${
              activeButtons.has('down') ? 'bg-blue-600 bg-opacity-70' : 'bg-blue-500 bg-opacity-70'
            }`}
            style={{
              height: '50%',
              borderBottomLeftRadius: '8px',
              borderBottomRightRadius: '8px',
            }}
          >
            ↓
          </div>
        </div>
      </div>

      <div
        ref={rightContainerRef}
        className="fixed bottom-4 right-4 z-50 pointer-events-auto flex flex-row gap-2 items-end"
        style={{ touchAction: 'none' }}
      >
        <button
          className={buttonClass('left')}
          style={btnStyle}
          onTouchStart={handleTouchStart('left')}
          onTouchEnd={handleTouchEnd('left')}
          onTouchCancel={handleTouchCancel}
          aria-label="Turn left"
        >
          ←
        </button>
        <button
          className={buttonClass('right')}
          style={btnStyle}
          onTouchStart={handleTouchStart('right')}
          onTouchEnd={handleTouchEnd('right')}
          onTouchCancel={handleTouchCancel}
          aria-label="Turn right"
        >
          →
        </button>
        <button
          className={`${buttonClass('shoot')} bg-red-500 active:bg-red-600`}
          style={{ ...btnStyle, height: '80px' }}
          onTouchStart={handleTouchStart('shoot')}
          onTouchEnd={handleTouchEnd('shoot')}
          onTouchCancel={handleTouchCancel}
          aria-label="Shoot"
        >
          🔫
        </button>
      </div>
    </>
  )
}
