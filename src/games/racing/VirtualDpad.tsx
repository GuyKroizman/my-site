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
    const leftContainer = leftContainerRef.current
    const rightContainer = rightContainerRef.current
    
    const preventDefault = (e: TouchEvent) => {
      e.preventDefault()
    }

    const containers = [leftContainer, rightContainer].filter(Boolean) as HTMLElement[]
    
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
      {/* Forward/Backward buttons - bottom left, stacked vertically */}
      <div 
        ref={leftContainerRef}
        className="fixed bottom-4 left-4 z-50 pointer-events-auto flex flex-col gap-2"
        style={{ touchAction: 'none' }}
      >
        {/* Forward button */}
        <button
          className={buttonClass('up')}
          style={buttonStyle}
          onTouchStart={handleTouchStart('up')}
          onTouchEnd={handleTouchEnd('up')}
          onTouchCancel={handleTouchCancel}
          aria-label="Accelerate"
        >
          ↑
        </button>
        
        {/* Backward button */}
        <button
          className={buttonClass('down')}
          style={buttonStyle}
          onTouchStart={handleTouchStart('down')}
          onTouchEnd={handleTouchEnd('down')}
          onTouchCancel={handleTouchCancel}
          aria-label="Brake/Reverse"
        >
          ↓
        </button>
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
