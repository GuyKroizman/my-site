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
  const containerRef = useRef<HTMLDivElement>(null)

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
    const container = containerRef.current
    if (!container) return

    const preventDefault = (e: TouchEvent) => {
      e.preventDefault()
    }

    container.addEventListener('touchstart', preventDefault, { passive: false })
    container.addEventListener('touchmove', preventDefault, { passive: false })
    container.addEventListener('touchend', preventDefault, { passive: false })

    return () => {
      container.removeEventListener('touchstart', preventDefault)
      container.removeEventListener('touchmove', preventDefault)
      container.removeEventListener('touchend', preventDefault)
    }
  }, [])

  const buttonClass = (direction: string) => {
    const baseClass = 'flex items-center justify-center text-white font-bold text-2xl select-none touch-none'
    const activeClass = activeButtons.has(direction) 
      ? 'bg-blue-600 scale-95' 
      : 'bg-blue-500 active:bg-blue-600'
    return `${baseClass} ${activeClass} transition-all duration-75`
  }

  return (
    <div 
      ref={containerRef}
      className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 pointer-events-auto"
      style={{ touchAction: 'none' }}
    >
      <div className="relative">
        {/* D-pad layout */}
        <div className="grid grid-cols-3 gap-1">
          {/* Empty top-left */}
          <div></div>
          
          {/* Up button */}
          <button
            className={buttonClass('up')}
            style={{ 
              width: '60px', 
              height: '60px',
              borderRadius: '8px',
              minWidth: '60px',
              minHeight: '60px'
            }}
            onTouchStart={handleTouchStart('up')}
            onTouchEnd={handleTouchEnd('up')}
            onTouchCancel={handleTouchCancel}
            aria-label="Accelerate"
          >
            ↑
          </button>
          
          {/* Empty top-right */}
          <div></div>
          
          {/* Left button */}
          <button
            className={buttonClass('left')}
            style={{ 
              width: '60px', 
              height: '60px',
              borderRadius: '8px',
              minWidth: '60px',
              minHeight: '60px'
            }}
            onTouchStart={handleTouchStart('left')}
            onTouchEnd={handleTouchEnd('left')}
            onTouchCancel={handleTouchCancel}
            aria-label="Turn left"
          >
            ←
          </button>
          
          {/* Center (empty) */}
          <div></div>
          
          {/* Right button */}
          <button
            className={buttonClass('right')}
            style={{ 
              width: '60px', 
              height: '60px',
              borderRadius: '8px',
              minWidth: '60px',
              minHeight: '60px'
            }}
            onTouchStart={handleTouchStart('right')}
            onTouchEnd={handleTouchEnd('right')}
            onTouchCancel={handleTouchCancel}
            aria-label="Turn right"
          >
            →
          </button>
          
          {/* Empty bottom-left */}
          <div></div>
          
          {/* Down button */}
          <button
            className={buttonClass('down')}
            style={{ 
              width: '60px', 
              height: '60px',
              borderRadius: '8px',
              minWidth: '60px',
              minHeight: '60px'
            }}
            onTouchStart={handleTouchStart('down')}
            onTouchEnd={handleTouchEnd('down')}
            onTouchCancel={handleTouchCancel}
            aria-label="Brake/Reverse"
          >
            ↓
          </button>
          
          {/* Empty bottom-right */}
          <div></div>
        </div>
      </div>
    </div>
  )
}
