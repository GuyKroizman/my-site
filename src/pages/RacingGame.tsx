import { Link } from 'react-router-dom'
import { useEffect, useRef, useState, useCallback } from 'react'
import { RacingGameEngine } from '../games/racing/RacingGameEngine'
import { VirtualDpad, DpadState } from '../games/racing/VirtualDpad'
import { GameManager, RaceResult, GameState as ManagerGameState } from '../games/racing/GameManager'
import { LevelConfig } from '../games/racing/levels'

// Check if device supports touch
const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

// Check if mobile device in landscape mode
const isMobileLandscape = () => {
  return isTouchDevice() && window.innerWidth > window.innerHeight
}

// Format time as seconds.tenths
const formatTime = (time: number): string => {
  const seconds = Math.floor(time)
  const tenths = Math.floor((time - seconds) * 10)
  return `${seconds}.${tenths}`
}

type UIState = 'menu' | 'playing' | 'raceComplete' | 'gameWon' | 'gameLost'

export default function RacingGame() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameEngineRef = useRef<RacingGameEngine | null>(null)
  const gameManagerRef = useRef<GameManager | null>(null)
  const [uiState, setUiState] = useState<UIState>('menu')
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null)
  const [currentLevel, setCurrentLevel] = useState<LevelConfig | null>(null)
  const [totalLevels, setTotalLevels] = useState(0)
  const [playerLaps, setPlayerLaps] = useState(0)
  const [hideHeader, setHideHeader] = useState(isMobileLandscape())
  const [raceTime, setRaceTime] = useState(0)
  const [requiredLaps, setRequiredLaps] = useState(4)

  // Initialize GameManager
  useEffect(() => {
    const manager = new GameManager({
      onStateChange: (state: ManagerGameState) => {
        setUiState(state as UIState)
      },
      onLevelChange: (level: LevelConfig) => {
        setCurrentLevel(level)
        setRequiredLaps(level.requiredLaps)
      },
      onRaceResult: (result: RaceResult) => {
        setRaceResult(result)
      },
      onGameComplete: (_won: boolean) => {
        // State is already set by onStateChange
      }
    })
    gameManagerRef.current = manager
    setTotalLevels(manager.getTotalLevels())

    return () => {
      gameManagerRef.current = null
    }
  }, [])

  // Track orientation changes to hide/show header
  useEffect(() => {
    const handleOrientationChange = () => {
      setHideHeader(isMobileLandscape())
    }
    
    window.addEventListener('resize', handleOrientationChange)
    window.addEventListener('orientationchange', handleOrientationChange)
    
    return () => {
      window.removeEventListener('resize', handleOrientationChange)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameEngineRef.current) {
        gameEngineRef.current.dispose()
        gameEngineRef.current = null
      }
    }
  }, [])

  const createAndStartRace = useCallback((level: LevelConfig) => {
    // Ensure container exists
    if (!containerRef.current) {
      console.error('Container ref is not available')
      return
    }

    // Dispose existing engine if any
    if (gameEngineRef.current) {
      gameEngineRef.current.dispose()
      gameEngineRef.current = null
    }

    // Create game engine with level config
    try {
      const engine = new RacingGameEngine(
        containerRef.current,
        {
          onRaceComplete: (results) => {
            if (gameManagerRef.current) {
              gameManagerRef.current.handleRaceComplete(results)
            }
          },
          onLapUpdate: (laps) => {
            setPlayerLaps(laps)
          },
          onTimerUpdate: (time) => {
            setRaceTime(time)
          }
        },
        level
      )
      gameEngineRef.current = engine
      engine.startRace()
    } catch (error) {
      console.error('Error creating game engine:', error)
    }
  }, [])

  // Start race when level changes and we're in playing state
  useEffect(() => {
    if (uiState === 'playing' && currentLevel) {
      createAndStartRace(currentLevel)
    }
  }, [uiState, currentLevel, createAndStartRace])

  const handleStartGame = () => {
    if (gameManagerRef.current) {
      gameManagerRef.current.startGame()
    }
  }

  const handleProceedAfterRace = () => {
    if (gameManagerRef.current) {
      gameManagerRef.current.proceedAfterRace()
    }
  }

  const handleBackToMenu = () => {
    // Dispose game engine when returning to menu
    if (gameEngineRef.current) {
      gameEngineRef.current.dispose()
      gameEngineRef.current = null
    }
    if (gameManagerRef.current) {
      gameManagerRef.current.returnToMenu()
    }
    setRaceResult(null)
    setPlayerLaps(0)
    setRaceTime(0)
  }

  const handleDpadStateChange = (state: DpadState) => {
    if (gameEngineRef.current) {
      gameEngineRef.current.setTouchControls(state)
    }
  }

  return (
    <div className="w-full h-screen flex flex-col bg-gray-900 overflow-hidden">
      {!hideHeader && (
        <div className="flex justify-between items-center p-4 bg-gray-800 text-white flex-shrink-0 z-30">
          <h1 className="text-2xl font-bold">Racing Game</h1>
          <Link to="/" className="text-xl text-blue-400 underline hover:text-blue-300">
            Back to Menu
          </Link>
        </div>
      )}

      {/* Game container - always exists, menu overlays it */}
      <div
        ref={containerRef}
        className="flex-1 w-full relative overflow-hidden"
      >
        {uiState === 'playing' && currentLevel && (
          <>
            {/* Level indicator */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded z-20">
              <div className="text-lg font-bold text-center">
                Track {currentLevel.id}: {currentLevel.name}
              </div>
            </div>
            {/* Lap counter */}
            <div className="absolute top-16 left-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded z-20">
              <div className="text-lg font-bold">Lap: {playerLaps} / {requiredLaps}</div>
            </div>
            {raceTime > 0 && (
              <div className="absolute top-16 right-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded z-20">
                <div className="text-lg font-bold">
                  Time: {formatTime(raceTime)}s
                </div>
              </div>
            )}
          </>
        )}

        {/* Race Complete Dialog */}
        {uiState === 'raceComplete' && raceResult && currentLevel && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl min-w-[400px]">
              <h2 className="text-3xl font-bold text-white mb-2 text-center">Race Complete!</h2>
              <p className="text-gray-400 text-center mb-4">
                Track {currentLevel.id}: {currentLevel.name}
              </p>
              
              {/* Race Results */}
              <div className="space-y-3 mb-4">
                <div className="text-xl text-yellow-400 font-semibold">
                  1st: {raceResult.winner}
                  {raceResult.times[raceResult.winner] !== undefined && (
                    <span className="text-base text-yellow-300 ml-2">
                      ({formatTime(raceResult.times[raceResult.winner])}s)
                    </span>
                  )}
                </div>
                {raceResult.second !== 'Unknown' && (
                  <div className="text-lg text-gray-300 font-semibold">
                    2nd: {raceResult.second}
                    {raceResult.times[raceResult.second] !== undefined && (
                      <span className="text-sm text-gray-200 ml-2">
                        ({formatTime(raceResult.times[raceResult.second])}s)
                      </span>
                    )}
                  </div>
                )}
                {raceResult.third !== 'Unknown' && (
                  <div className="text-lg text-gray-400 font-semibold">
                    3rd: {raceResult.third}
                    {raceResult.times[raceResult.third] !== undefined && (
                      <span className="text-sm text-gray-300 ml-2">
                        ({formatTime(raceResult.times[raceResult.third])}s)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Player Result */}
              <div className={`p-4 rounded mb-4 ${raceResult.levelPassed ? 'bg-green-900' : 'bg-red-900'}`}>
                <p className="text-white font-bold text-center">
                  You finished in position {raceResult.playerPosition}!
                </p>
                <p className={`text-center ${raceResult.levelPassed ? 'text-green-300' : 'text-red-300'}`}>
                  {raceResult.levelPassed 
                    ? (gameManagerRef.current?.isLastLevel() 
                        ? 'Final track complete!' 
                        : `Advancing to Track ${currentLevel.id + 1}...`)
                    : `You needed top ${currentLevel.winCondition.maxPosition} to advance.`
                  }
                </p>
              </div>

              <button
                onClick={handleProceedAfterRace}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded transition-colors"
              >
                {raceResult.levelPassed 
                  ? (gameManagerRef.current?.isLastLevel() ? 'See Results' : 'Next Track')
                  : 'Continue'
                }
              </button>
            </div>
          </div>
        )}

        {/* Game Won Dialog */}
        {uiState === 'gameWon' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl min-w-[400px]">
              <h2 className="text-3xl font-bold text-yellow-400 mb-4 text-center">Congratulations!</h2>
              <p className="text-white text-xl text-center mb-6">
                You completed all {totalLevels} tracks!
              </p>
              <p className="text-gray-300 text-center mb-6">
                You are a true racing champion!
              </p>
              <button
                onClick={handleBackToMenu}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </div>
        )}

        {/* Game Lost Dialog */}
        {uiState === 'gameLost' && currentLevel && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl min-w-[400px]">
              <h2 className="text-3xl font-bold text-red-400 mb-4 text-center">Race Over</h2>
              <p className="text-white text-xl text-center mb-6">
                You didn't qualify on Track {currentLevel.id}.
              </p>
              <p className="text-gray-300 text-center mb-6">
                Better luck next time!
              </p>
              <button
                onClick={handleBackToMenu}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </div>
        )}

        {/* Virtual D-pad - only show when playing and on touch devices */}
        {uiState === 'playing' && isTouchDevice() && (
          <VirtualDpad onStateChange={handleDpadStateChange} />
        )}
      </div>

      {/* Menu screen - shown when uiState is 'menu' */}
      {uiState === 'menu' && (
        <div className="flex-1 w-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 z-20">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700">
            <h2 className="text-3xl font-bold text-white mb-6 text-center">Racing Game</h2>
            <p className="text-gray-300 text-center mb-6">
              Race against AI opponents across {totalLevels} tracks!
            </p>
            <p className="text-gray-400 text-sm text-center mb-6">
              Controls: Arrow Keys (↑ Forward, ↓ Reverse, ← → Turn)<br />
              Mobile: Use on-screen D-pad
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
