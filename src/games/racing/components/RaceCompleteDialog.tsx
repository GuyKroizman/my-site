import { RaceResult } from '../GameManager'
import { LevelConfig } from '../levels'
import { formatTime } from '../utils'

interface RaceCompleteDialogProps {
  raceResult: RaceResult
  currentLevel: LevelConfig
  isLastLevel: boolean
  onProceed: () => void
  onBackToMenu: () => void
}

export function RaceCompleteDialog({
  raceResult,
  currentLevel,
  isLastLevel,
  onProceed,
  onBackToMenu
}: RaceCompleteDialogProps) {
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
              1st: {raceResult.winner}
              {raceResult.times[raceResult.winner] !== undefined && (
                <span className="text-sm text-yellow-300 ml-2">
                  ({formatTime(raceResult.times[raceResult.winner])}s)
                </span>
              )}
            </div>
            {raceResult.second !== 'Unknown' && (
              <div className="text-base text-gray-300 font-semibold">
                2nd: {raceResult.second}
                {raceResult.times[raceResult.second] !== undefined && (
                  <span className="text-xs text-gray-200 ml-2">
                    ({formatTime(raceResult.times[raceResult.second])}s)
                  </span>
                )}
              </div>
            )}
            {raceResult.third !== 'Unknown' && (
              <div className="text-base text-gray-400 font-semibold">
                3rd: {raceResult.third}
                {raceResult.times[raceResult.third] !== undefined && (
                  <span className="text-xs text-gray-300 ml-2">
                    ({formatTime(raceResult.times[raceResult.third])}s)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Player Result */}
          <div className={`p-3 rounded-lg ${raceResult.levelPassed ? 'bg-green-900' : 'bg-red-900'}`}>
            <p className="text-white font-bold text-base mb-1">
              You finished in position {raceResult.playerPosition}!
            </p>
            <p className={`text-sm ${raceResult.levelPassed ? 'text-green-300' : 'text-red-300'}`}>
              {raceResult.levelPassed
                ? (isLastLevel
                    ? 'Final track complete!'
                    : `Advancing to Track ${currentLevel.id + 1}...`)
                : `You needed top ${currentLevel.winCondition.maxPosition} to advance.`
              }
            </p>
            {!raceResult.levelPassed && (
              <p className="text-gray-300 text-sm mt-1">
                Better luck next time!
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end">
          <button
            onClick={raceResult.levelPassed ? onProceed : onBackToMenu}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-2 px-3 rounded-lg transition-colors text-base whitespace-nowrap"
          >
            {raceResult.levelPassed
              ? (isLastLevel ? 'See Results' : 'Next Track')
              : 'Back to Menu'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
