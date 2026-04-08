import { useState } from 'react'
import { RaceResult } from '../GameManager'
import { LevelConfig } from '../levels'
import { formatTime } from '../utils'

interface RaceCompleteDialogProps {
  raceResult: RaceResult
  currentLevel: LevelConfig
  totalLevels: number
  isLastLevel: boolean
  onProceed: () => void
  onBackToMenu: () => void
  onDismissComplete?: () => void
}

export function RaceCompleteDialog({
  raceResult,
  currentLevel,
  totalLevels,
  isLastLevel,
  onProceed,
  onBackToMenu,
  onDismissComplete
}: RaceCompleteDialogProps) {
  const [dismissing, setDismissing] = useState(false)

  const getDisplayName = (name: string) => name === 'Player' ? 'You' : name
  const hasTask = raceResult.activeTaskText !== null
  const isFinalVictory = raceResult.levelPassed && isLastLevel

  const handleImmediateBackToMenu = () => {
    onBackToMenu()
  }

  const handleBackToMenu = () => {
    setDismissing(true)
    onBackToMenu()

    // After panels slide out, unmount
    setTimeout(() => {
      onDismissComplete?.()
    }, 500)
  }

  if (!raceResult.levelPassed) {
    return (
      <div
        className="absolute inset-0 z-10 flex items-center justify-center px-4 py-4 overflow-y-auto bg-black"
        style={{
          backgroundImage: 'url(/racing/woman_lost.png)',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <style>{`
          @keyframes slideFromLeft { from { opacity: 0; transform: translateX(-60px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes slideFromRight { from { opacity: 0; transform: translateX(60px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes slideOutLeft { to { opacity: 0; transform: translateX(-60px); } }
          @keyframes slideOutRight { to { opacity: 0; transform: translateX(60px); } }
        `}</style>
        <div className="absolute inset-0 bg-black/40" />
        <div className="max-w-4xl w-full grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-center relative">
          <div
            className="min-w-0 bg-black/60 backdrop-blur-sm rounded-lg p-4"
            style={{ animation: dismissing ? 'slideOutLeft 0.5s ease-in forwards' : 'slideFromLeft 0.6s ease-out 2s both' }}
          >
            <h2 className="text-xl font-bold text-white mb-1">Race Complete!</h2>
            <p className="text-gray-400 mb-3 text-base">
              Track {currentLevel.id}: {currentLevel.name}
            </p>

            {/* Race Results */}
            <div className="space-y-1 mb-3">
              <div className="text-lg text-yellow-400 font-semibold">
                1st: {getDisplayName(raceResult.winner)}
                {raceResult.times[raceResult.winner] !== undefined && (
                  <span className="text-sm text-yellow-300 ml-2">
                    ({formatTime(raceResult.times[raceResult.winner])}s)
                  </span>
                )}
              </div>
              {raceResult.second !== 'Unknown' && (
                <div className="text-base text-gray-300 font-semibold">
                  2nd: {getDisplayName(raceResult.second)}
                  {raceResult.times[raceResult.second] !== undefined && (
                    <span className="text-xs text-gray-200 ml-2">
                      ({formatTime(raceResult.times[raceResult.second])}s)
                    </span>
                  )}
                </div>
              )}
              {raceResult.third !== 'Unknown' && (
                <div className="text-base text-gray-400 font-semibold">
                  3rd: {getDisplayName(raceResult.third)}
                  {raceResult.times[raceResult.third] !== undefined && (
                    <span className="text-xs text-gray-300 ml-2">
                      ({formatTime(raceResult.times[raceResult.third])}s)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Player Result */}
            <div className="p-3 rounded-lg bg-red-900/70 backdrop-blur-sm">
              <p className="text-white font-bold text-base mb-1">
                You finished in position {raceResult.playerPosition}!
              </p>
              <p className="text-sm text-red-300">
                {`You needed top ${currentLevel.winCondition.maxPosition} to advance.`}
              </p>
              <p className="text-gray-300 text-sm mt-1">
                Better luck next time!
              </p>
            </div>

            <div className="mt-3 rounded-lg bg-black/40 p-3 text-sm text-gray-200">
              <p className="font-semibold text-yellow-300">Coins</p>
              <p>Placement reward: {raceResult.placementCoins}</p>
              <p>Time reward: {raceResult.timeCoins}</p>
              <p>Task reward: {raceResult.taskCoins}</p>
              <p className="mt-1 font-semibold text-white">Total coins: {raceResult.totalCoins}</p>
              {hasTask && (
                <p className="mt-1 text-gray-300">
                  Task: {raceResult.activeTaskText} ({raceResult.taskCompleted ? 'completed' : 'not completed'})
                </p>
              )}
            </div>
          </div>
          <div
            className="flex items-center justify-end bg-black/60 backdrop-blur-sm rounded-lg p-4"
            style={{ animation: dismissing ? 'slideOutRight 0.5s ease-in forwards' : 'slideFromRight 0.6s ease-out 2.3s both' }}
          >
            <button
              onClick={handleBackToMenu}
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-2 px-3 rounded-lg transition-colors text-base whitespace-nowrap"
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isFinalVictory) {
    return (
      <div
        className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-black px-4 py-4"
      >
        <div
          className="absolute inset-0 bg-no-repeat"
          style={{
            backgroundImage: 'url(/racing/great-success.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center calc(100% + 100px)'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/12 to-black/28" />
        <div className="relative w-full max-w-5xl text-white">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.9fr)] md:items-start">
            <div className="min-w-0">
              <div className="inline-block rounded-2xl bg-black/35 px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.28)]">
                <h2 className="text-2xl font-bold text-yellow-300 sm:text-3xl">Congratulations!</h2>
                <p className="mt-2 text-lg font-semibold text-white sm:text-xl">
                  You completed all {totalLevels} tracks!
                </p>
                <p className="mt-1 text-sm text-amber-100/90 sm:text-base">
                  You are a true racing champion.
                </p>
              </div>

              <div className="mt-4 max-w-xl rounded-2xl bg-black/28 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.24)]">
                <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Final Race</p>
                <p className="mt-1 text-base text-gray-100">
                  Track {currentLevel.id}: {currentLevel.name}
                </p>

                <div className="mt-3 space-y-1">
                  <div className="text-lg font-semibold text-yellow-300">
                    1st: {getDisplayName(raceResult.winner)}
                    {raceResult.times[raceResult.winner] !== undefined && (
                      <span className="ml-2 text-sm text-yellow-100">
                        ({formatTime(raceResult.times[raceResult.winner])}s)
                      </span>
                    )}
                  </div>
                  {raceResult.second !== 'Unknown' && (
                    <div className="text-base font-semibold text-gray-100">
                      2nd: {getDisplayName(raceResult.second)}
                      {raceResult.times[raceResult.second] !== undefined && (
                        <span className="ml-2 text-xs text-gray-200">
                          ({formatTime(raceResult.times[raceResult.second])}s)
                        </span>
                      )}
                    </div>
                  )}
                  {raceResult.third !== 'Unknown' && (
                    <div className="text-base font-semibold text-gray-200">
                      3rd: {getDisplayName(raceResult.third)}
                      {raceResult.times[raceResult.third] !== undefined && (
                        <span className="ml-2 text-xs text-gray-300">
                          ({formatTime(raceResult.times[raceResult.third])}s)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-xl bg-emerald-900/52 p-3">
                  <p className="text-base font-bold text-white">
                    You finished in position {raceResult.playerPosition}!
                  </p>
                  <p className="mt-1 text-sm text-emerald-100">Final track complete.</p>
                </div>
              </div>
            </div>

            <div className="min-w-0 md:pt-5">
              <div className="rounded-2xl bg-black/32 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.24)]">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">Rewards</p>
                <div className="mt-3 space-y-2 text-sm text-gray-100 sm:text-base">
                  <p>Placement reward: {raceResult.placementCoins}</p>
                  <p>Time reward: {raceResult.timeCoins}</p>
                  <p>Task reward: {raceResult.taskCoins}</p>
                  <p className="pt-1 text-lg font-semibold text-yellow-300">
                    Total coins: {raceResult.totalCoins}
                  </p>
                  {hasTask && (
                    <p className="text-sm text-gray-200">
                      Task: {raceResult.activeTaskText} ({raceResult.taskCompleted ? 'completed' : 'not completed'})
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex justify-start md:justify-end">
                <button
                  onClick={handleImmediateBackToMenu}
                  className="rounded-lg bg-green-600 px-4 py-3 text-base font-bold text-white shadow-lg transition-colors hover:bg-green-700 active:bg-green-800"
                >
                  Back to Menu
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 bg-black bg-opacity-90 z-10 flex items-center justify-center px-4 py-4 overflow-y-auto">
      <div className="max-w-4xl w-full grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-center">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white mb-1">Race Complete!</h2>
          <p className="text-gray-400 mb-3 text-base">
            Track {currentLevel.id}: {currentLevel.name}
          </p>

          {/* Race Results */}
          <div className="space-y-1 mb-3">
            <div className="text-lg text-yellow-400 font-semibold">
              1st: {getDisplayName(raceResult.winner)}
              {raceResult.times[raceResult.winner] !== undefined && (
                <span className="text-sm text-yellow-300 ml-2">
                  ({formatTime(raceResult.times[raceResult.winner])}s)
                </span>
              )}
            </div>
            {raceResult.second !== 'Unknown' && (
              <div className="text-base text-gray-300 font-semibold">
                2nd: {getDisplayName(raceResult.second)}
                {raceResult.times[raceResult.second] !== undefined && (
                  <span className="text-xs text-gray-200 ml-2">
                    ({formatTime(raceResult.times[raceResult.second])}s)
                  </span>
                )}
              </div>
            )}
            {raceResult.third !== 'Unknown' && (
              <div className="text-base text-gray-400 font-semibold">
                3rd: {getDisplayName(raceResult.third)}
                {raceResult.times[raceResult.third] !== undefined && (
                  <span className="text-xs text-gray-300 ml-2">
                    ({formatTime(raceResult.times[raceResult.third])}s)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Player Result */}
          <div className={`p-3 rounded-lg bg-green-900`}>
            <p className="text-white font-bold text-base mb-1">
              You finished in position {raceResult.playerPosition}!
            </p>
            <p className="text-sm text-green-300">
              {isLastLevel
                ? 'Final track complete!'
                : `Advancing to Track ${currentLevel.id + 1}...`}
            </p>
          </div>

          <div className="mt-3 rounded-lg bg-black/40 p-3 text-sm text-gray-200">
            <p className="font-semibold text-yellow-300">Coins</p>
            <p>Placement reward: {raceResult.placementCoins}</p>
            <p>Time reward: {raceResult.timeCoins}</p>
            <p>Task reward: {raceResult.taskCoins}</p>
            <p className="mt-1 font-semibold text-white">Total coins: {raceResult.totalCoins}</p>
            {hasTask && (
              <p className="mt-1 text-gray-300">
                Task: {raceResult.activeTaskText} ({raceResult.taskCompleted ? 'completed' : 'not completed'})
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end">
          <button
            onClick={onProceed}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-2 px-3 rounded-lg transition-colors text-base whitespace-nowrap"
          >
            Next Track
          </button>
        </div>
      </div>
    </div>
  )
}
