import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { TheMaskEngine } from '../games/theMask/TheMaskEngine'
import { MenuScreen, VirtualControls, PausedDialog } from '../games/theMask/components'
import type { TouchInputState } from '../games/theMask/types'

const SOUND_GAME_OVER = '/theMask/sound/dramatic-moment.mp3'

const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

const isPortrait = () => window.innerHeight > window.innerWidth
const isLandscape = () => window.innerWidth > window.innerHeight
const isMobileLandscape = () => isTouchDevice() && isLandscape()

type UIState = 'menu' | 'playing' | 'paused' | 'gameOver'

function GameOverOverlay({ onBackToMenu }: { onBackToMenu: () => void }) {
  useEffect(() => {
    const audio = new Audio(SOUND_GAME_OVER)
    audio.volume = 0.595
    audio.play().catch((err) => console.warn('Game over sound failed:', err))
  }, [])
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70">
      <div className="text-white text-2xl font-bold mb-2">Game Over</div>
      <p className="text-gray-300 text-sm mb-4">You ran out of health.</p>
      <button
        onClick={onBackToMenu}
        className="px-6 py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold rounded-lg transition-colors"
      >
        Return to Menu
      </button>
    </div>
  )
}

export default function TheMask() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameEngineRef = useRef<TheMaskEngine | null>(null)
  const [uiState, setUiState] = useState<UIState>('menu')
  const [isPortraitMode, setIsPortraitMode] = useState(isPortrait())
  const [hideHeader, setHideHeader] = useState(isMobileLandscape())

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
        {uiState === 'paused' && <PausedDialog />}
        {uiState === 'gameOver' && (
          <GameOverOverlay onBackToMenu={handleBackToMenu} />
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
