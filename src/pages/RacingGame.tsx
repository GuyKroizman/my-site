import { useEffect, useRef, useState, useCallback } from 'react'
import { FireWeaponUiState, RacingGameEngine } from '../games/racing/RacingGameEngine'
import { GameManager, RaceResult, GameState as ManagerGameState } from '../games/racing/GameManager'
import { LevelConfig } from '../games/racing/levels'
import { SoundGenerator } from '../games/racing/SoundGenerator'
import { VirtualDriveStick } from '../games/racing/VirtualDriveStick'
import { isMobileLandscape, isPortrait, isTouchDevice, isLandscape } from '../games/racing/device'
import type { TouchDriveState } from '../games/racing/input'
import type { UpgradeOption, UpgradeId } from '../games/racing/upgrades'
import {
  Header,
  MuteButton,
  RaceCompleteDialog,
  GameWonDialog,
  PausedDialog,
  MenuScreen,
  FinishLineConfetti,
  UpgradeSelectionScreen
} from '../games/racing/components'

type UIState = 'menu' | 'playing' | 'paused' | 'raceComplete' | 'upgradeSelection' | 'gameWon'

const EMPTY_FIRE_WEAPON_UI_STATE: FireWeaponUiState = {
  activeWeaponId: null,
  activeWeaponIcon: '',
  nextWeaponIcon: '',
  fireWeaponCount: 0,
  turboState: 'hidden',
  turboCooldownProgress: 1,
}

export default function RacingGame() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameEngineRef = useRef<RacingGameEngine | null>(null)
  const gameManagerRef = useRef<GameManager | null>(null)
  const confettiTriggeredRef = useRef(false)
  const raceLoadRequestRef = useRef(0)
  const [uiState, setUiState] = useState<UIState>('menu')
  const [dismissingLoseScreen, setDismissingLoseScreen] = useState(false)
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null)
  const [currentLevel, setCurrentLevel] = useState<LevelConfig | null>(null)
  const [totalLevels, setTotalLevels] = useState(0)
  const [hideHeader, setHideHeader] = useState(isMobileLandscape())
  const [isPortraitMode, setIsPortraitMode] = useState(isPortrait())
  const [isMuted, setIsMuted] = useState(SoundGenerator.getMuted())
  const [isExitingMenu, setIsExitingMenu] = useState(false)
  const [gameContainerVisible, setGameContainerVisible] = useState(true)
  const [confettiBurstId, setConfettiBurstId] = useState(0)
  const [confettiOrigin, setConfettiOrigin] = useState<{ x: number; y: number } | null>(null)
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeOption[]>([])
  const [fireWeaponUiState, setFireWeaponUiState] = useState<FireWeaponUiState>(EMPTY_FIRE_WEAPON_UI_STATE)
  const [isRaceLoading, setIsRaceLoading] = useState(false)

  // Initialize GameManager
  useEffect(() => {
    const manager = new GameManager({
      onStateChange: (state: ManagerGameState) => {
        setUiState(state as UIState)
      },
      onLevelChange: (level: LevelConfig) => {
        setCurrentLevel(level)
      },
      onRaceResult: (result: RaceResult) => {
        setRaceResult(result)
        if (!result.levelPassed && gameEngineRef.current) {
          gameEngineRef.current.playSadFinishSound()
        }
      },
      onGameComplete: (_won: boolean) => {
        // State is already set by onStateChange
      },
      onUpgradeSelection: (options: UpgradeOption[]) => {
        setUpgradeOptions(options)
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
      raceLoadRequestRef.current += 1
      if (gameEngineRef.current) {
        gameEngineRef.current.dispose()
        gameEngineRef.current = null
      }
    }
  }, [])

  const disposeGameEngine = useCallback(() => {
    raceLoadRequestRef.current += 1
    setIsRaceLoading(false)

    if (!gameEngineRef.current) {
      return
    }

    gameEngineRef.current.dispose()
    gameEngineRef.current = null
  }, [])

  const resetRaceUi = useCallback((options?: { clearRaceResult?: boolean }) => {
    if (options?.clearRaceResult) {
      setRaceResult(null)
    }

    setFireWeaponUiState(EMPTY_FIRE_WEAPON_UI_STATE)
    confettiTriggeredRef.current = false
    setConfettiOrigin(null)
  }, [])

  const createAndStartRace = useCallback(async (level: LevelConfig) => {
    // Ensure container exists
    if (!containerRef.current) {
      console.error('Container ref is not available')
      return
    }

    const requestId = ++raceLoadRequestRef.current
    setIsRaceLoading(true)

    // Reset confetti so it can trigger again when the first car finishes this level
    confettiTriggeredRef.current = false
    setConfettiOrigin(null)

    // Dispose existing engine if any
    if (gameEngineRef.current) {
      gameEngineRef.current.dispose()
      gameEngineRef.current = null
    }

    // Get player upgrades from game manager
    const upgrades = gameManagerRef.current?.getPlayerUpgrades()

    // Create game engine with level config and player upgrades
    try {
      await RacingGameEngine.preloadLevelAssets(level)
      if (raceLoadRequestRef.current !== requestId) {
        return
      }

      const engine = new RacingGameEngine(
        containerRef.current,
        {
          onRaceComplete: (results) => {
            if (gameManagerRef.current) {
              gameManagerRef.current.handleRaceComplete(results)
            }
          },
          onLapComplete: (laps) => {
            engine.spawnLapDigit(laps)
          },
          onTimerUpdate: () => {},
          onCarFinished: (_name, screenPos) => {
            if (confettiTriggeredRef.current) return
            confettiTriggeredRef.current = true
            setConfettiOrigin(screenPos)
            setConfettiBurstId((prev) => prev + 1)
          },
          onWeaponUiStateChange: (state) => {
            setFireWeaponUiState(state)
          }
        },
        level,
        upgrades
      )
      await engine.initialize()
      if (raceLoadRequestRef.current !== requestId) {
        engine.dispose()
        return
      }

      gameEngineRef.current = engine
      engine.startRace()
      if (isTouchDevice()) {
        engine.setTouchControls({ throttle: 1, steering: 0 })
      }

      // Set initial weapon UI state
      setFireWeaponUiState(engine.getFireWeaponUiState())
      setGameContainerVisible(true)
    } catch (error) {
      console.error('Error creating game engine:', error)
    } finally {
      if (raceLoadRequestRef.current === requestId) {
        setIsRaceLoading(false)
      }
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
      void createAndStartRace(currentLevel)
    }
  }, [uiState, currentLevel, createAndStartRace])

  // Fade in game container when transitioning from menu to playing
  useEffect(() => {
    if (uiState === 'playing' && !gameContainerVisible && !isRaceLoading) {
      const id = requestAnimationFrame(() => setGameContainerVisible(true))
      return () => cancelAnimationFrame(id)
    }
  }, [uiState, gameContainerVisible, isRaceLoading])

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
    setIsRaceLoading(true)
    gameManagerRef.current?.startGame()
    setIsExitingMenu(false)
  }

  const handleProceedAfterRace = () => {
    if (gameManagerRef.current) {
      gameManagerRef.current.proceedAfterRace()
    }
  }

  const handleUpgradeSelect = (upgradeId: UpgradeId) => {
    if (gameManagerRef.current) {
      gameManagerRef.current.selectUpgrade(upgradeId)
    }
  }

  const handleRotateWeapon = useCallback(() => {
    if (gameEngineRef.current) {
      gameEngineRef.current.rotateWeapon()
    }
  }, [])

  const handleBackToMenu = () => {
    disposeGameEngine()
    gameManagerRef.current?.returnToMenu()
    resetRaceUi({ clearRaceResult: true })
  }

  // Two-phase dismiss: switch to menu first (so it renders behind), keep overlay alive
  const handleLoseScreenBackToMenu = () => {
    setDismissingLoseScreen(true)
    disposeGameEngine()
    gameManagerRef.current?.returnToMenu()
    resetRaceUi()
  }

  const handleLoseScreenDismissComplete = () => {
    setDismissingLoseScreen(false)
    setRaceResult(null)
  }

  const handleTouchDriveChange = useCallback((state: TouchDriveState) => {
    if (gameEngineRef.current) {
      gameEngineRef.current.setTouchControls(state)
    }
  }, [])

  const handleTouchShoot = useCallback((shooting: boolean) => {
    if (gameEngineRef.current) {
      gameEngineRef.current.setTouchShoot(shooting)
    }
  }, [])

  const handleToggleMute = () => {
    const newMutedState = SoundGenerator.toggleMute()
    setIsMuted(newMutedState)
  }

  // Determine fire button visibility based on player upgrades
  const showFireButton = fireWeaponUiState.fireWeaponCount > 0

  return (
    <div className="w-full h-screen flex flex-col bg-gray-900 overflow-hidden">
      <Header hideHeader={hideHeader} />

      {/* Game container - always exists, menu overlays it */}
      <div
        ref={containerRef}
        className={`${uiState !== 'menu' && !isExitingMenu ? 'flex-1' : ''} w-full relative overflow-hidden transition-opacity duration-300 ease-out ${uiState === 'playing' && !gameContainerVisible && !isRaceLoading ? 'opacity-0' : 'opacity-100'}`}
      >
        <MuteButton isMuted={isMuted} onToggle={handleToggleMute} />

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

        {uiState === 'upgradeSelection' && (
          <UpgradeSelectionScreen
            options={upgradeOptions}
            onSelect={handleUpgradeSelect}
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
          <VirtualDriveStick
            onStateChange={handleTouchDriveChange}
            onShoot={handleTouchShoot}
            showFireButton={showFireButton}
            fireButtonIcon={fireWeaponUiState.activeWeaponIcon}
            activeWeaponId={fireWeaponUiState.activeWeaponId}
            turboState={fireWeaponUiState.turboState}
            turboCooldownProgress={fireWeaponUiState.turboCooldownProgress}
            onRotateWeapon={handleRotateWeapon}
            showRotateButton={fireWeaponUiState.fireWeaponCount > 1}
            rotateButtonIcon={fireWeaponUiState.nextWeaponIcon}
          />
        )}

        {uiState === 'playing' && isRaceLoading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-gray-900/90">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-white"></div>
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-gray-300">Loading race assets</p>
            </div>
          </div>
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
      <FinishLineConfetti triggerCount={confettiBurstId} origin={confettiOrigin} />
    </div>
  )
}
