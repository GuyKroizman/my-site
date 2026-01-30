import { useEffect, useRef, useState, useCallback } from 'react'
import { TheMaskEngine } from '../games/theMask/TheMaskEngine'
import { MenuScreen, VirtualControls } from '../games/theMask/components'
import type { InputState } from '../games/theMask/types'

const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

const isPortrait = () => window.innerHeight > window.innerWidth

type UIState = 'menu' | 'playing'

export default function TheMask() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameEngineRef = useRef<TheMaskEngine | null>(null)
  const [uiState, setUiState] = useState<UIState>('menu')
  const [isPortraitMode, setIsPortraitMode] = useState(isPortrait())

  useEffect(() => {
    const handleOrientationChange = () => {
      setIsPortraitMode(isPortrait())
    }
    window.addEventListener('resize', handleOrientationChange)
    window.addEventListener('orientationchange', handleOrientationChange)
    return () => {
      window.removeEventListener('resize', handleOrientationChange)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (gameEngineRef.current) {
        gameEngineRef.current.dispose()
        gameEngineRef.current = null
      }
    }
  }, [])

  const startGame = useCallback(() => {
    if (isPortrait()) return
    if (!containerRef.current) return
    if (gameEngineRef.current) {
      gameEngineRef.current.dispose()
      gameEngineRef.current = null
    }
    try {
      const engine = new TheMaskEngine(containerRef.current)
      gameEngineRef.current = engine
      setUiState('playing')
    } catch (e) {
      console.error('Failed to start The Mask:', e)
    }
  }, [])

  const handleBackToMenu = () => {
    if (gameEngineRef.current) {
      gameEngineRef.current.dispose()
      gameEngineRef.current = null
    }
    setUiState('menu')
  }

  const handleControlsChange = (state: InputState) => {
    if (gameEngineRef.current) {
      gameEngineRef.current.setTouchControls(state)
    }
  }

  return (
    <div className="w-full h-screen flex flex-col bg-gray-900 overflow-hidden">
      {uiState === 'playing' && (
        <header className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-800/80 text-white">
          <h1 className="text-lg font-semibold">The Mask</h1>
          <button
            onClick={handleBackToMenu}
            className="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-sm"
          >
            Menu
          </button>
        </header>
      )}

      <div
        ref={containerRef}
        className={`${uiState === 'playing' ? 'flex-1' : ''} w-full relative overflow-hidden`}
      >
        {uiState === 'playing' && isTouchDevice() && (
          <VirtualControls onStateChange={handleControlsChange} />
        )}
      </div>

      {uiState === 'menu' && (
        <div className="flex-1 min-h-0 w-full flex flex-col bg-gradient-to-br from-gray-800 to-gray-900 z-20">
          <MenuScreen isPortraitMode={isPortraitMode} onStartGame={startGame} />
        </div>
      )}
    </div>
  )
}
