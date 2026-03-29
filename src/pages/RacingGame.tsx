import { useEffect, useRef, useState, useCallback } from 'react'
import { RacingGameEngine } from '../games/racing/RacingGameEngine'
import { GameManager, RaceResult, GameState as ManagerGameState } from '../games/racing/GameManager'
import { LevelConfig } from '../games/racing/levels'
import { SoundGenerator } from '../games/racing/SoundGenerator'
import { VirtualDriveStick } from '../games/racing/VirtualDriveStick'
import type { TouchDriveState } from '../games/racing/input'
import {
  Header,
  MuteButton,
  GameHUD,
  RaceCompleteDialog,
  GameWonDialog,
  PausedDialog,
  MenuScreen,
  FinishLineConfetti
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


type UIState = 'menu' | 'playing' | 'paused' | 'raceComplete' | 'gameWon'

export default function RacingGame() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameEngineRef = useRef<RacingGameEngine | null>(null)
  const gameManagerRef = useRef<GameManager | null>(null)
  const [uiState, setUiState] = useState<UIState>('menu')
  const [dismissingLoseScreen, setDismissingLoseScreen] = useState(false)
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null)
  const [currentLevel, setCurrentLevel] = useState<LevelConfig | null>(null)
  const [totalLevels, setTotalLevels] = useState(0)
  const [playerLaps, setPlayerLaps] = useState(0)
  const [hideHeader, setHideHeader] = useState(isMobileLandscape())
  const [raceTime, setRaceTime] = useState(0)
  const [requiredLaps, setRequiredLaps] = useState(4)
  const [isPortraitMode, setIsPortraitMode] = useState(isPortrait())
  const [isMuted, setIsMuted] = useState(SoundGenerator.getMuted())
  const [isExitingMenu, setIsExitingMenu] = useState(false)
  const [gameContainerVisible, setGameContainerVisible] = useState(true)
  const [confettiCount, setConfettiCount] = useState(0)
  const [confettiOrigin, setConfettiOrigin] = useState<{ x: number; y: number } | null>(null)

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
        if (!result.levelPassed && gameEngineRef.current) {
          gameEngineRef.current.playSadFinishSound()
        }
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

    // Reset confetti so it can trigger again when the first car finishes this level
    setConfettiCount(0)
    setConfettiOrigin(null)

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
          },
          onCarFinished: (_name, screenPos) => {
            setConfettiCount((prev) => {
              if (prev === 0) {
                setConfettiOrigin(screenPos)
              }
              return prev === 0 ? 1 : prev
            })
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

  // Fade in game container when transitioning from menu to playing
  useEffect(() => {
    if (uiState === 'playing' && !gameContainerVisible) {
      const id = requestAnimationFrame(() => setGameContainerVisible(true))
      return () => cancelAnimationFrame(id)
    }
  }, [uiState, gameContainerVisible])

  const handleStartGame = () => {
    // Only allow starting game if in landscape mode
    if (isPortrait()) {
      return // Don't start if in portrait - rotate screen will be shown
    }
    setIsExitingMenu(true)
  }

  const handleMenuTransitionEnd = (e: React.TransitionEvent) => {
    if (e.propertyName !== 'opacity' || !isExitingMenu) return
    setGameContainerVisible(false)
    gameManagerRef.current?.startGame()
    setIsExitingMenu(false)
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
    setConfettiCount(0)
  }

  // Two-phase dismiss: switch to menu first (so it renders behind), keep overlay alive
  const handleLoseScreenBackToMenu = () => {
    setDismissingLoseScreen(true)
    // Dispose game engine and switch to menu state
    if (gameEngineRef.current) {
      gameEngineRef.current.dispose()
      gameEngineRef.current = null
    }
    if (gameManagerRef.current) {
      gameManagerRef.current.returnToMenu()
    }
    setPlayerLaps(0)
    setRaceTime(0)
    setConfettiCount(0)
  }

  const handleLoseScreenDismissComplete = () => {
    setDismissingLoseScreen(false)
    setRaceResult(null)
  }

  const handleTouchDriveChange = (state: TouchDriveState) => {
    if (gameEngineRef.current) {
      gameEngineRef.current.setTouchControls(state)
    }
  }

  const handleTouchShoot = useCallback((shooting: boolean) => {
    if (gameEngineRef.current) {
      gameEngineRef.current.setTouchShoot(shooting)
    }
  }, [])

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
        className={`${uiState !== 'menu' && !isExitingMenu ? 'flex-1' : ''} w-full relative overflow-hidden transition-opacity duration-300 ease-out ${uiState === 'playing' && !gameContainerVisible ? 'opacity-0' : 'opacity-100'}`}
      >
        <MuteButton isMuted={isMuted} onToggle={handleToggleMute} />

        {uiState === 'playing' && currentLevel && (
          <GameHUD
            playerLaps={playerLaps}
            requiredLaps={requiredLaps}
            raceTime={raceTime}
          />
        )}

        {(uiState === 'raceComplete' || dismissingLoseScreen) && raceResult && currentLevel && (
          <RaceCompleteDialog
            raceResult={raceResult}
            currentLevel={currentLevel}
            isLastLevel={gameManagerRef.current?.isLastLevel() ?? false}
            onProceed={handleProceedAfterRace}
            onBackToMenu={handleLoseScreenBackToMenu}
            onDismissComplete={handleLoseScreenDismissComplete}
          />
        )}

        {uiState === 'gameWon' && (
          <GameWonDialog
            totalLevels={totalLevels}
            onBackToMenu={handleBackToMenu}
          />
        )}

        {uiState === 'paused' && (
          <PausedDialog />
        )}

        {/* Virtual drive stick - only show when playing and on touch devices */}
        {uiState === 'playing' && isTouchDevice() && (
          <VirtualDriveStick onStateChange={handleTouchDriveChange} onShoot={handleTouchShoot} />
        )}
      </div>

      {/* Menu screen - shown when uiState is 'menu' or exiting (fade-out transition) */}
      {(uiState === 'menu' || isExitingMenu) && (
        <>
          <svg className="absolute w-0 h-0" aria-hidden="true">
            <defs>
              <filter id="racing-menu-pixelate" x="0" y="0">
                <feFlood x="0" y="0" width="48" height="48" />
                <feComposite width="48" height="48" />
                <feTile result="a" />
                <feComposite in="SourceGraphic" in2="a" operator="in" />
                <feMorphology operator="dilate" radius="6" />
              </filter>
            </defs>
          </svg>
          <div
            className={`flex-1 w-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 z-20 ${isExitingMenu ? 'opacity-0' : 'opacity-100'}`}
            style={{
              transition: 'opacity 800ms ease-out, filter 800ms ease-out',
              filter: isExitingMenu ? 'url(#racing-menu-pixelate)' : 'none',
            }}
            onTransitionEnd={handleMenuTransitionEnd}
          >
            <MenuScreen
              isPortraitMode={isPortraitMode}
              totalLevels={totalLevels}
              onStartGame={handleStartGame}
            />
          </div>
        </>
      )}
      {(uiState === 'playing' || uiState === 'raceComplete') && (
        <FinishLineConfetti triggerCount={confettiCount} origin={confettiOrigin} />
      )}
    </div>
  )
}
