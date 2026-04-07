import { useState } from 'react'
import { RaceResult } from '../GameManager'
import { LevelConfig } from '../levels'
import { formatTime } from '../utils'

interface RaceCompleteDialogProps {
  raceResult: RaceResult
  currentLevel: LevelConfig
  isLastLevel: boolean
  onProceed: () => void
  onBackToMenu: () => void
  onDismissComplete?: () => void
}

export function RaceCompleteDialog({
  raceResult,
  currentLevel,
  isLastLevel,
  onProceed,
  onBackToMenu,
  onDismissComplete
}: RaceCompleteDialogProps) {
  const [dismissing, setDismissing] = useState(false)

  const getDisplayName = (name: string) => name === 'Player' ? 'You' : name
  const hasTask = raceResult.activeTaskText !== null

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
            {isLastLevel ? 'See Results' : 'Next Track'}
          </button>
        </div>
      </div>
    </div>
  )
}
