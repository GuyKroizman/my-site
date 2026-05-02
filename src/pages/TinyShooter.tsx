import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { TinyShooterEngine } from '../games/tinyShooter/TinyShooterEngine'
import { isTouchDevice } from '../games/racing/device'
import type { RadarSnapshot, TinyShooterGameState } from '../games/tinyShooter/gameTypes'

type UIState = 'menu' | 'playing'

const EMPTY_RADAR_SNAPSHOT: RadarSnapshot = {
  range: 0,
  blips: [],
}

const RADAR_DIAMETER = 136
const RADAR_RADIUS = RADAR_DIAMETER / 2
const RADAR_CENTER = RADAR_DIAMETER / 2
const PLAYER_DOT_RADIUS = 4
const TARGET_DOT_RADIUS = 4
const RADAR_RING_STROKE_WIDTH = 2
const RADAR_GRID_OPACITY = 0.28

const INITIAL_GAME_STATE: TinyShooterGameState = {
  phase: 'playing',
  health: 100,
  objectiveHealth: 120,
  objectiveMaxHealth: 120,
  gameOverReason: null,
  pointerLocked: false,
  gamepadStatus: {
    connected: false,
    active: false,
    id: null,
  },
  currentLevelId: 'diamond-core',
  currentLevelName: 'Diamond Core',
  levelComplete: false,
  victory: false,
}

interface TinyShooterRadarProps {
  gameEngineRef: { current: TinyShooterEngine | null }
  isVisible: boolean
}

function TinyShooterRadar({ gameEngineRef, isVisible }: TinyShooterRadarProps) {
  const [radarSnapshot, setRadarSnapshot] = useState<RadarSnapshot>(EMPTY_RADAR_SNAPSHOT)

  useEffect(() => {
    if (!isVisible) {
      setRadarSnapshot(EMPTY_RADAR_SNAPSHOT)
      return
    }

    let animationFrameId = 0

    const updateRadarSnapshot = () => {
      const engine = gameEngineRef.current
      if (engine) {
        setRadarSnapshot(engine.getRadarSnapshot())
      }
      animationFrameId = requestAnimationFrame(updateRadarSnapshot)
    }

    updateRadarSnapshot()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [gameEngineRef, isVisible])

  if (!isVisible) {
    return null
  }

  return (
    <div className="absolute top-5 right-5 z-10 pointer-events-none select-none">
      <svg
        width={RADAR_DIAMETER}
        height={RADAR_DIAMETER}
        viewBox={`0 0 ${RADAR_DIAMETER} ${RADAR_DIAMETER}`}
        aria-label="Radar"
      >
        <circle
          cx={RADAR_CENTER}
          cy={RADAR_CENTER}
          r={RADAR_RADIUS - RADAR_RING_STROKE_WIDTH}
          fill="rgba(10, 16, 12, 0.72)"
          stroke="rgba(180, 255, 210, 0.82)"
          strokeWidth={RADAR_RING_STROKE_WIDTH}
        />
        <circle
          cx={RADAR_CENTER}
          cy={RADAR_CENTER}
          r={(RADAR_RADIUS - RADAR_RING_STROKE_WIDTH) * 0.66}
          fill="none"
          stroke={`rgba(180, 255, 210, ${RADAR_GRID_OPACITY})`}
          strokeWidth="1"
        />
        <line
          x1={RADAR_CENTER}
          y1={RADAR_RING_STROKE_WIDTH + 8}
          x2={RADAR_CENTER}
          y2={RADAR_DIAMETER - RADAR_RING_STROKE_WIDTH - 8}
          stroke={`rgba(180, 255, 210, ${RADAR_GRID_OPACITY})`}
          strokeWidth="1"
        />
        <line
          x1={RADAR_RING_STROKE_WIDTH + 8}
          y1={RADAR_CENTER}
          x2={RADAR_DIAMETER - RADAR_RING_STROKE_WIDTH - 8}
          y2={RADAR_CENTER}
          stroke={`rgba(180, 255, 210, ${RADAR_GRID_OPACITY})`}
          strokeWidth="1"
        />
        {radarSnapshot.blips.map((blip, index) => (
          <circle
            key={`${blip.kind}-${index}`}
            cx={RADAR_CENTER + blip.x * (RADAR_RADIUS - 12)}
            cy={RADAR_CENTER + blip.y * (RADAR_RADIUS - 12)}
            r={TARGET_DOT_RADIUS}
            fill={blip.kind === 'objective' ? '#22c55e' : '#ef4444'}
          />
        ))}
        <circle
          cx={RADAR_CENTER}
          cy={RADAR_CENTER}
          r={PLAYER_DOT_RADIUS}
          fill="#050505"
          stroke="rgba(255, 255, 255, 0.88)"
          strokeWidth="1"
        />
      </svg>
    </div>
  )
}

export default function TinyShooter() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameEngineRef = useRef<TinyShooterEngine | null>(null)
  const [uiState, setUiState] = useState<UIState>('menu')
  const [mobileDevice, setMobileDevice] = useState(false)
  const [gameState, setGameState] = useState<TinyShooterGameState>(INITIAL_GAME_STATE)

  useEffect(() => {
    setMobileDevice(isTouchDevice())
  }, [])

  useEffect(() => {
    return () => {
      if (gameEngineRef.current) {
        gameEngineRef.current.dispose()
        gameEngineRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (uiState !== 'playing' || gameEngineRef.current || !containerRef.current) return
    const engine = new TinyShooterEngine(containerRef.current, {
      onStateChange: (nextState) => setGameState(nextState),
    })
    gameEngineRef.current = engine
  }, [uiState])

  const startGame = () => {
    if (!containerRef.current) return
    if (gameEngineRef.current) {
      gameEngineRef.current.dispose()
      gameEngineRef.current = null
    }
    setGameState(INITIAL_GAME_STATE)
    setUiState('playing')
  }

  const handleBackToMenu = () => {
    if (gameEngineRef.current) {
      gameEngineRef.current.dispose()
      gameEngineRef.current = null
    }
    setGameState(INITIAL_GAME_STATE)
    setUiState('menu')
  }

  const objectivePercent =
    (gameState.objectiveHealth / Math.max(gameState.objectiveMaxHealth, 1)) * 100

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
          <>
            <TinyShooterRadar gameEngineRef={gameEngineRef} isVisible />
            <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
              <span
                className="text-white text-2xl font-bold opacity-70 select-none"
                style={{ textShadow: '1px 1px 2px black, -1px -1px 2px black' }}
              >
                X
              </span>
            </div>
            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex flex-col items-center gap-1">
              <span
                className="text-cyan-100 text-sm font-bold select-none uppercase tracking-[0.2em]"
                style={{ textShadow: '1px 1px 2px black' }}
              >
                Diamond
              </span>
              <div className="w-56 h-3 bg-slate-950/80 rounded-full overflow-hidden border border-cyan-300/40">
                <div
                  className="h-full transition-all duration-150 rounded-full"
                  style={{
                    width: `${objectivePercent}%`,
                    background:
                      gameState.objectiveHealth > gameState.objectiveMaxHealth * 0.55
                        ? 'linear-gradient(90deg, #22d3ee, #67e8f9)'
                        : gameState.objectiveHealth > gameState.objectiveMaxHealth * 0.25
                          ? 'linear-gradient(90deg, #f59e0b, #fcd34d)'
                          : 'linear-gradient(90deg, #ef4444, #f87171)',
                  }}
                />
              </div>
            </div>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex flex-col items-center gap-1">
              <span
                className="text-white text-sm font-bold select-none"
                style={{ textShadow: '1px 1px 2px black' }}
              >
                HP {gameState.health}
              </span>
              <div className="w-48 h-3 bg-gray-800/80 rounded-full overflow-hidden border border-gray-600">
                <div
                  className="h-full transition-all duration-150 rounded-full"
                  style={{
                    width: `${gameState.health}%`,
                    backgroundColor:
                      gameState.health > 60 ? '#22c55e' : gameState.health > 30 ? '#eab308' : '#ef4444',
                  }}
                />
              </div>
              <span
                className="text-xs text-gray-200 select-none"
                style={{ textShadow: '1px 1px 2px black' }}
              >
                {gameState.currentLevelName}
              </span>
            </div>
          </>
        )}
        {uiState === 'playing' && mobileDevice && !gameState.gamepadStatus.active && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 px-6">
            <div className="max-w-sm rounded-xl border border-white/20 bg-gray-900/90 p-5 text-center text-white shadow-2xl">
              <p className="text-lg font-semibold">Controller required</p>
              <p className="mt-2 text-sm text-gray-300">
                Pair the 8BitDo Lite 2 in Android using D mode, then press any button if it is already connected.
              </p>
              {gameState.gamepadStatus.id && (
                <p className="mt-3 text-xs text-gray-400">
                  Detected: {gameState.gamepadStatus.id}
                </p>
              )}
            </div>
          </div>
        )}
        {uiState === 'playing' && !mobileDevice && !gameState.pointerLocked && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 pointer-events-none">
            <p className="text-white text-lg">Click to lock mouse</p>
          </div>
        )}
        {uiState === 'playing' && gameState.levelComplete && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 pointer-events-none">
            <p className="text-white text-2xl font-bold">Level Cleared</p>
          </div>
        )}
        {uiState === 'playing' && gameState.victory && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 pointer-events-none">
            <div className="rounded-xl border border-white/20 bg-black/50 px-6 py-4 text-center text-white">
              <p className="text-3xl font-bold">Victory</p>
              <p className="mt-2 text-sm text-gray-200">The diamond survived.</p>
            </div>
          </div>
        )}
        {uiState === 'playing' && gameState.phase === 'game-over' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 pointer-events-none">
            <div className="rounded-xl border border-white/20 bg-black/55 px-6 py-4 text-center text-white">
              <p className="text-3xl font-bold">
                {gameState.gameOverReason === 'objective-destroyed' ? 'Core Lost' : 'Game Over'}
              </p>
              <p className="mt-2 text-sm text-gray-200">
                {gameState.gameOverReason === 'objective-destroyed'
                  ? 'The diamond was destroyed.'
                  : 'You were destroyed.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {uiState === 'menu' && (
        <div className="flex-1 min-h-0 w-full flex flex-col bg-gradient-to-br from-gray-800 to-gray-900 z-20">
          <div className="flex-1 flex flex-col items-center justify-center">
            <h2 className="text-3xl font-bold text-white mb-2">Tiny Shooter</h2>
            <p className="text-gray-300 text-sm mb-6">Defend the center diamond from endless spawned robots</p>
            <div className="bg-gray-700/50 rounded-lg p-4 mb-6 text-gray-300 text-sm">
              <p className="font-semibold mb-1">Controls</p>
              {mobileDevice ? (
                <>
                  <p>Android controller mode</p>
                  <p>Left stick &mdash; Move</p>
                  <p>Right stick &mdash; Look around</p>
                  <p>RT or RB &mdash; Shoot</p>
                  <p>Best in landscape with 8BitDo Lite 2 in D mode</p>
                </>
              ) : (
                <>
                  <p>WASD &mdash; Move</p>
                  <p>Z / C &mdash; Strafe left / right</p>
                  <p>X &mdash; Move forward</p>
                  <p>Mouse &mdash; Look around</p>
                  <p>Left click &mdash; Shoot</p>
                  <p>Escape &mdash; Release mouse</p>
                </>
              )}
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
