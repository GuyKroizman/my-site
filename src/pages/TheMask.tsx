import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { TheMaskEngine } from '../games/theMask/TheMaskEngine'
import { MenuScreen, VirtualControls, PausedDialog } from '../games/theMask/components'
import type { TouchInputState } from '../games/theMask/types'

const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

const isPortrait = () => window.innerHeight > window.innerWidth
const isLandscape = () => window.innerWidth > window.innerHeight
const isMobileLandscape = () => isTouchDevice() && isLandscape()

type UIState = 'menu' | 'playing' | 'paused' | 'gameOver'

export default function TheMask() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameEngineRef = useRef<TheMaskEngine | null>(null)
  const [uiState, setUiState] = useState<UIState>('menu')
  const [isPortraitMode, setIsPortraitMode] = useState(isPortrait())
  const [hideHeader, setHideHeader] = useState(isMobileLandscape())
  const [playerHealth, setPlayerHealth] = useState(200)
  const [playerMaxHealth, setPlayerMaxHealth] = useState(200)

  useEffect(() => {
    const handleOrientationChange = () => {
      const portrait = isPortrait()
      const landscape = isLandscape()
      setIsPortraitMode(portrait)
      setHideHeader(isMobileLandscape())

      if (uiState === 'playing' && portrait && gameEngineRef.current) {
        gameEngineRef.current.pause()
        setUiState('paused')
      }
      if (uiState === 'paused' && landscape && gameEngineRef.current) {
        gameEngineRef.current.resume()
        setUiState('playing')
      }
    }
    window.addEventListener('resize', handleOrientationChange)
    window.addEventListener('orientationchange', handleOrientationChange)
    return () => {
      window.removeEventListener('resize', handleOrientationChange)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [uiState])

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
      const engine = new TheMaskEngine(containerRef.current, {
        mobile: isTouchDevice(),
        onGameOver: () => setUiState('gameOver'),
        onHealthChange: (health, maxHealth) => {
          setPlayerHealth(health)
          setPlayerMaxHealth(maxHealth)
        },
      })
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
    setPlayerHealth(200)
    setPlayerMaxHealth(200)
  }

  const handleTouchInputChange = (state: TouchInputState) => {
    if (gameEngineRef.current) {
      gameEngineRef.current.setTouchControls(state)
    }
  }

  return (
    <div className="w-full h-screen flex flex-col bg-gray-900 overflow-hidden">
      {!hideHeader && (
        <header className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-800/80 text-white z-30">
          <h1 className="text-lg font-semibold">The Mask</h1>
          {uiState === 'playing' || uiState === 'paused' || uiState === 'gameOver' ? (
            <button
              onClick={handleBackToMenu}
              className="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-sm"
            >
              Menu
            </button>
          ) : (
            <Link to="/" className="text-base text-blue-400 underline hover:text-blue-300">
              Back to Menu
            </Link>
          )}
        </header>
      )}

      <div
        ref={containerRef}
        className={`${uiState === 'playing' || uiState === 'paused' || uiState === 'gameOver' ? 'flex-1' : ''} w-full relative overflow-hidden min-h-0`}
      >
        {(uiState === 'playing' || uiState === 'paused') && (
          <div className="absolute top-2 left-2 right-2 z-20 flex justify-center pointer-events-none">
            <div className="bg-gray-900/80 rounded-lg px-3 py-1.5 flex items-center gap-2 min-w-[120px] max-w-[200px]">
              <span className="text-white text-xs font-medium whitespace-nowrap">Health</span>
              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-150"
                  style={{ width: `${Math.max(0, (playerHealth / playerMaxHealth) * 100)}%` }}
                />
              </div>
              <span className="text-white text-xs tabular-nums">{playerHealth}/{playerMaxHealth}</span>
            </div>
          </div>
        )}
        {uiState === 'paused' && <PausedDialog />}
        {uiState === 'gameOver' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70">
            <div className="text-white text-2xl font-bold mb-2">Game Over</div>
            <p className="text-gray-300 text-sm mb-4">You ran out of health.</p>
            <button
              onClick={handleBackToMenu}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold rounded-lg transition-colors"
            >
              Return to Menu
            </button>
          </div>
        )}
        {(uiState === 'playing' || uiState === 'paused') && isTouchDevice() && (
          <VirtualControls onTouchInputChange={handleTouchInputChange} />
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
