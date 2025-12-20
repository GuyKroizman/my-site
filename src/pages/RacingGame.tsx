import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { RacingGameEngine } from '../games/racing/RacingGameEngine'

type GameState = 'menu' | 'playing' | 'gameOver'

export default function RacingGame() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameEngineRef = useRef<RacingGameEngine | null>(null)
  const [gameState, setGameState] = useState<GameState>('menu')
  const [raceResults, setRaceResults] = useState<{ winner: string; second: string; third: string } | null>(null)
  const [playerLaps, setPlayerLaps] = useState(0)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameEngineRef.current) {
        gameEngineRef.current.dispose()
        gameEngineRef.current = null
      }
    }
  }, [])

  const handleStartGame = () => {
    // Ensure container exists
    if (!containerRef.current) {
      console.error('Container ref is not available')
      return
    }
    
    // Create game engine when starting the race
    if (!gameEngineRef.current) {
      try {
        const engine = new RacingGameEngine(containerRef.current, {
          onRaceComplete: (results) => {
            setRaceResults(results)
            setGameState('gameOver')
          },
          onLapUpdate: (laps) => {
            setPlayerLaps(laps)
          }
        })
        gameEngineRef.current = engine
      } catch (error) {
        console.error('Error creating game engine:', error)
        return
      }
    }
    
    // Start the race
    gameEngineRef.current.startRace()
    setGameState('playing')
  }

  const handleBackToMenu = () => {
    // Dispose game engine when returning to menu
    if (gameEngineRef.current) {
      gameEngineRef.current.dispose()
      gameEngineRef.current = null
    }
    setGameState('menu')
    setRaceResults(null)
    setPlayerLaps(0)
  }

  return (
    <div className="w-full h-screen flex flex-col bg-gray-900 overflow-hidden">
      <div className="flex justify-between items-center p-4 bg-gray-800 text-white flex-shrink-0">
        <h1 className="text-2xl font-bold">Racing Game</h1>
        <Link to="/" className="text-xl text-blue-400 underline hover:text-blue-300">
          Back to Menu
        </Link>
      </div>
      
      {/* Game container - always exists, menu overlays it */}
      <div 
        ref={containerRef} 
        className="flex-1 w-full relative overflow-hidden"
      >
        {gameState === 'playing' && (
          <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded z-20">
            <div className="text-lg font-bold">Lap: {playerLaps} / 4</div>
          </div>
        )}

        {gameState === 'gameOver' && raceResults && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl min-w-[400px]">
              <h2 className="text-3xl font-bold text-white mb-6 text-center">Race Complete!</h2>
              <div className="space-y-4 mb-6">
                <div className="text-xl text-yellow-400 font-semibold">
                  🥇 Winner: {raceResults.winner}
                </div>
                <div className="text-lg text-gray-300 font-semibold">
                  🥈 2nd Place: {raceResults.second}
                </div>
                <div className="text-lg text-gray-400 font-semibold">
                  🥉 3rd Place: {raceResults.third}
                </div>
              </div>
              <button
                onClick={handleBackToMenu}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Menu screen - shown when gameState is 'menu' */}
      {gameState === 'menu' && (
        <div className="flex-1 w-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 absolute inset-0 z-30">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700">
            <h2 className="text-3xl font-bold text-white mb-6 text-center">Racing Game</h2>
            <p className="text-gray-300 text-center mb-6">
              Race against AI opponents! Complete 4 laps to win.
            </p>
            <p className="text-gray-400 text-sm text-center mb-6">
              Controls: Arrow Keys (↑ Forward, ↓ Reverse, ← → Turn)
            </p>
            <button
              onClick={handleStartGame}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded transition-colors text-xl"
            >
              Start Race
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
