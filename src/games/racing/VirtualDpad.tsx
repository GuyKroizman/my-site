import { useEffect, useRef, useState } from 'react'

export interface DpadState {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

interface VirtualDpadProps {
  onStateChange: (state: DpadState) => void
}

export function VirtualDpad({ onStateChange }: VirtualDpadProps) {
  const [activeButtons, setActiveButtons] = useState<Set<string>>(new Set())
  const leftContainerRef = useRef<HTMLDivElement>(null)
  const rightContainerRef = useRef<HTMLDivElement>(null)
  const forwardBackwardControlRef = useRef<HTMLDivElement>(null)
  const activeForwardBackwardTouch = useRef<number | null>(null)

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

  // Handle forward/backward control touch
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
        t => t.identifier === activeForwardBackwardTouch.current
      )
      if (touch) {
        updateForwardBackwardState(touch.clientX, touch.clientY)
      }
    }
  }

  const handleForwardBackwardTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    // Check if the active touch ended
    if (activeForwardBackwardTouch.current !== null) {
      const touchEnded = Array.from(e.changedTouches).find(
        t => t.identifier === activeForwardBackwardTouch.current
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

  const handleForwardBackwardTouchCancel = () => {
    activeForwardBackwardTouch.current = null
    const newActive = new Set(activeButtons)
    newActive.delete('up')
    newActive.delete('down')
    setActiveButtons(newActive)
    updateState(newActive)
  }

  const updateForwardBackwardState = (clientX: number, clientY: number) => {
    if (!forwardBackwardControlRef.current) return
    
    const rect = forwardBackwardControlRef.current.getBoundingClientRect()
    const touchX = clientX - rect.left
    const touchY = clientY - rect.top
    
    // Allow some tolerance outside bounds for better UX (10px margin)
    const tolerance = 10
    const isWithinBounds = 
      touchX >= -tolerance && 
      touchX <= rect.width + tolerance && 
      touchY >= -tolerance && 
      touchY <= rect.height + tolerance
    
    const newActive = new Set(activeButtons)
    
    if (isWithinBounds) {
      const controlHeight = rect.height
      const midpoint = controlHeight / 2
      
      // Top half = forward (up), bottom half = backward (down)
      if (touchY < midpoint) {
        newActive.add('up')
        newActive.delete('down')
      } else {
        newActive.add('down')
        newActive.delete('up')
      }
    } else {
      // Touch moved outside control area - clear state
      newActive.delete('up')
      newActive.delete('down')
    }
    
    setActiveButtons(newActive)
    updateState(newActive)
  }

  const updateState = (active: Set<string>) => {
    onStateChange({
      up: active.has('up'),
      down: active.has('down'),
      left: active.has('left'),
      right: active.has('right'),
    })
  }

  // Prevent default touch behaviors (scrolling, zooming)
  useEffect(() => {
    const leftContainer = leftContainerRef.current
    const rightContainer = rightContainerRef.current
    const forwardBackwardControl = forwardBackwardControlRef.current
    
    const preventDefault = (e: TouchEvent) => {
      e.preventDefault()
    }

    const containers = [leftContainer, rightContainer, forwardBackwardControl].filter(Boolean) as HTMLElement[]
    
    containers.forEach(container => {
      container.addEventListener('touchstart', preventDefault, { passive: false })
      container.addEventListener('touchmove', preventDefault, { passive: false })
      container.addEventListener('touchend', preventDefault, { passive: false })
    })

    return () => {
      containers.forEach(container => {
        container.removeEventListener('touchstart', preventDefault)
        container.removeEventListener('touchmove', preventDefault)
        container.removeEventListener('touchend', preventDefault)
      })
    }
  }, [])

  const buttonClass = (direction: string) => {
    const baseClass = 'flex items-center justify-center text-white font-bold text-2xl select-none touch-none'
    const activeClass = activeButtons.has(direction) 
      ? 'bg-blue-600 scale-95' 
      : 'bg-blue-500 active:bg-blue-600'
    return `${baseClass} ${activeClass} transition-all duration-75`
  }

  const buttonStyle = {
    width: '60px',
    height: '60px',
    borderRadius: '8px',
    minWidth: '60px',
    minHeight: '60px'
  }

  return (
    <>
      {/* Forward/Backward control - bottom left, single connected control */}
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
            height: '128px', // 60px + 8px gap + 60px = 128px (same as two buttons with gap-2)
            borderRadius: '8px',
            overflow: 'hidden',
            touchAction: 'none'
          }}
          onTouchStart={handleForwardBackwardTouchStart}
          onTouchMove={handleForwardBackwardTouchMove}
          onTouchEnd={handleForwardBackwardTouchEnd}
          onTouchCancel={handleForwardBackwardTouchCancel}
        >
          {/* Forward section (top half) */}
          <div
            className={`absolute top-0 left-0 right-0 flex items-center justify-center text-white font-bold text-2xl select-none transition-all duration-75 ${
              activeButtons.has('up')
                ? 'bg-blue-600'
                : 'bg-blue-500'
            }`}
            style={{
              height: '50%',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              borderBottom: '2px solid rgba(255, 255, 255, 0.3)'
            }}
          >
            ↑
          </div>
          
          {/* Backward section (bottom half) */}
          <div
            className={`absolute bottom-0 left-0 right-0 flex items-center justify-center text-white font-bold text-2xl select-none transition-all duration-75 ${
              activeButtons.has('down')
                ? 'bg-blue-600'
                : 'bg-blue-500'
            }`}
            style={{
              height: '50%',
              borderBottomLeftRadius: '8px',
              borderBottomRightRadius: '8px'
            }}
          >
            ↓
          </div>
        </div>
      </div>

      {/* Left/Right buttons - bottom right, side by side */}
      <div 
        ref={rightContainerRef}
        className="fixed bottom-4 right-4 z-50 pointer-events-auto flex flex-row gap-2"
        style={{ touchAction: 'none' }}
      >
        {/* Left button */}
        <button
          className={buttonClass('left')}
          style={buttonStyle}
          onTouchStart={handleTouchStart('left')}
          onTouchEnd={handleTouchEnd('left')}
          onTouchCancel={handleTouchCancel}
          aria-label="Turn left"
        >
          ←
        </button>
        
        {/* Right button */}
        <button
          className={buttonClass('right')}
          style={buttonStyle}
          onTouchStart={handleTouchStart('right')}
          onTouchEnd={handleTouchEnd('right')}
          onTouchCancel={handleTouchCancel}
          aria-label="Turn right"
        >
          →
        </button>
      </div>
    </>
  )
}
