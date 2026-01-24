import { useEffect, useRef, useState, useCallback } from 'react'
import { RacingGameEngine } from '../games/racing/RacingGameEngine'
import { VirtualDpad, DpadState } from '../games/racing/VirtualDpad'
import { GameManager, RaceResult, GameState as ManagerGameState } from '../games/racing/GameManager'
import { LevelConfig } from '../games/racing/levels'
import { SoundGenerator } from '../games/racing/SoundGenerator'
import {
  Header,
  MuteButton,
  GameHUD,
  RaceCompleteDialog,
  GameWonDialog,
  GameLostDialog,
  PausedDialog,
  MenuScreen
} from '../games/racing/components'

// Check if device supports touch
const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

// Check if mobile device in landscape mode
const isMobileLandscape = () => {
  return isTouchDevice() && window.innerWidth > window.innerHeight
}

// Check if device is in portrait mode
const isPortrait = () => {
  return window.innerHeight > window.innerWidth
}

// Check if device is in landscape mode
const isLandscape = () => {
  return window.innerWidth > window.innerHeight
}


type UIState = 'menu' | 'playing' | 'paused' | 'raceComplete' | 'gameWon' | 'gameLost'

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
  const [isPortraitMode, setIsPortraitMode] = useState(isPortrait())
  const [isMuted, setIsMuted] = useState(SoundGenerator.getMuted())

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

  // Track orientation changes to hide/show header and handle game pause/resume
  useEffect(() => {
    const handleOrientationChange = () => {
      const portrait = isPortrait()
      const landscape = isLandscape()
      setIsPortraitMode(portrait)
      setHideHeader(isMobileLandscape())
      
      // If game is playing and rotates to portrait, pause it
      if (uiState === 'playing' && portrait && gameEngineRef.current && gameManagerRef.current) {
        gameEngineRef.current.pause()
        gameManagerRef.current.pause()
      }
      
      // If game is paused and rotates to landscape, resume it
      if (uiState === 'paused' && landscape && gameEngineRef.current && gameManagerRef.current) {
        gameEngineRef.current.resume()
        gameManagerRef.current.resume()
      }
    }
    
    window.addEventListener('resize', handleOrientationChange)
    window.addEventListener('orientationchange', handleOrientationChange)
    
    return () => {
      window.removeEventListener('resize', handleOrientationChange)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [uiState])

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
      // Only start race if in landscape mode
      if (isPortrait()) {
        // If in portrait, pause the game instead
        if (gameManagerRef.current) {
          gameManagerRef.current.pause()
        }
        return
      }
      createAndStartRace(currentLevel)
    }
  }, [uiState, currentLevel, createAndStartRace])

  const handleStartGame = () => {
    // Only allow starting game if in landscape mode
    if (isPortrait()) {
      return // Don't start if in portrait - rotate screen will be shown
    }
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

  const handleToggleMute = () => {
    const newMutedState = SoundGenerator.toggleMute()
    setIsMuted(newMutedState)
  }

  return (
    <div className="w-full h-screen flex flex-col bg-gray-900 overflow-hidden">
      <Header hideHeader={hideHeader} />

      {/* Game container - always exists, menu overlays it */}
      <div
        ref={containerRef}
        className="flex-1 w-full relative overflow-hidden"
      >
        <MuteButton isMuted={isMuted} onToggle={handleToggleMute} />

        {uiState === 'playing' && currentLevel && (
          <GameHUD
            currentLevel={currentLevel}
            playerLaps={playerLaps}
            requiredLaps={requiredLaps}
            raceTime={raceTime}
          />
        )}

        {uiState === 'raceComplete' && raceResult && currentLevel && (
          <RaceCompleteDialog
            raceResult={raceResult}
            currentLevel={currentLevel}
            isLastLevel={gameManagerRef.current?.isLastLevel() ?? false}
            onProceed={handleProceedAfterRace}
          />
        )}

        {uiState === 'gameWon' && (
          <GameWonDialog
            totalLevels={totalLevels}
            onBackToMenu={handleBackToMenu}
          />
        )}

        {uiState === 'gameLost' && currentLevel && (
          <GameLostDialog
            currentLevel={currentLevel}
            onBackToMenu={handleBackToMenu}
          />
        )}

        {uiState === 'paused' && (
          <PausedDialog />
        )}

        {/* Virtual D-pad - only show when playing and on touch devices */}
        {uiState === 'playing' && isTouchDevice() && (
          <VirtualDpad onStateChange={handleDpadStateChange} />
        )}
      </div>

      {/* Menu screen - shown when uiState is 'menu' */}
      {uiState === 'menu' && (
        <div className="flex-1 w-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 z-20">
          <MenuScreen
            isPortraitMode={isPortraitMode}
            totalLevels={totalLevels}
            onStartGame={handleStartGame}
          />
        </div>
      )}
    </div>
  )
}
