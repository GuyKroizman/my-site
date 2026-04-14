import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { TinyShooterEngine } from '../games/tinyShooter/TinyShooterEngine'

type UIState = 'menu' | 'playing'

export default function TinyShooter() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameEngineRef = useRef<TinyShooterEngine | null>(null)
  const [uiState, setUiState] = useState<UIState>('menu')
  const [pointerLocked, setPointerLocked] = useState(false)

  useEffect(() => {
    return () => {
      if (gameEngineRef.current) {
        gameEngineRef.current.dispose()
        gameEngineRef.current = null
      }
    }
  }, [])

  // Create the engine after the DOM has updated and the container has flex-1 sizing
  useEffect(() => {
    if (uiState !== 'playing' || gameEngineRef.current || !containerRef.current) return
    const engine = new TinyShooterEngine(containerRef.current, {
      onPointerLockChange: (locked) => setPointerLocked(locked),
    })
    gameEngineRef.current = engine
  }, [uiState])

  const startGame = useCallback(() => {
    if (!containerRef.current) return
    if (gameEngineRef.current) {
      gameEngineRef.current.dispose()
      gameEngineRef.current = null
    }
    setUiState('playing')
  }, [])

  const handleBackToMenu = () => {
    if (gameEngineRef.current) {
      gameEngineRef.current.dispose()
      gameEngineRef.current = null
    }
    setPointerLocked(false)
    setUiState('menu')
  }

  return (
    <div className="w-full h-screen flex flex-col bg-gray-900 overflow-hidden">
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-800/80 text-white z-30">
        <h1 className="text-lg font-semibold">Tiny Shooter</h1>
        {uiState === 'playing' ? (
          <button
            onClick={handleBackToMenu}
            className="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-sm"
          >
            Menu
          </button>
        ) : (
          <Link to="/" className="text-base text-blue-400 underline hover:text-blue-300">
            Back to Home
          </Link>
        )}
      </header>

      <div
        ref={containerRef}
        className={`${uiState === 'playing' ? 'flex-1' : ''} w-full relative overflow-hidden min-h-0`}
      >
        {uiState === 'playing' && (
          <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
            <span
              className="text-white text-2xl font-bold opacity-70 select-none"
              style={{ textShadow: '1px 1px 2px black, -1px -1px 2px black' }}
            >
              X
            </span>
          </div>
        )}
        {uiState === 'playing' && !pointerLocked && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 pointer-events-none">
            <p className="text-white text-lg">Click to lock mouse</p>
          </div>
        )}
      </div>

      {uiState === 'menu' && (
        <div className="flex-1 min-h-0 w-full flex flex-col bg-gradient-to-br from-gray-800 to-gray-900 z-20">
          <div className="flex-1 flex flex-col items-center justify-center">
            <h2 className="text-3xl font-bold text-white mb-2">Tiny Shooter</h2>
            <p className="text-gray-300 text-sm mb-6">FPS sandbox &mdash; walk around and shoot cylinders</p>
            <div className="bg-gray-700/50 rounded-lg p-4 mb-6 text-gray-300 text-sm">
              <p className="font-semibold mb-1">Controls</p>
              <p>WASD &mdash; Move</p>
              <p>Mouse &mdash; Look around</p>
              <p>Left click &mdash; Shoot</p>
              <p>Escape &mdash; Release mouse</p>
            </div>
            <button
              onClick={startGame}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-lg transition-colors text-lg"
            >
              Play
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
