import { RaceResult } from '../GameManager'
import { LevelConfig } from '../levels'
import { formatTime } from '../utils'

interface RaceCompleteDialogProps {
  raceResult: RaceResult
  currentLevel: LevelConfig
  isLastLevel: boolean
  onProceed: () => void
}

export function RaceCompleteDialog({
  raceResult,
  currentLevel,
  isLastLevel,
  onProceed
}: RaceCompleteDialogProps) {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-90 z-10 flex items-center justify-center px-4 py-6 overflow-y-auto">
      <div className="max-w-4xl w-full grid grid-cols-[minmax(0,1fr)_auto] gap-4 sm:gap-6 items-center">
        <div className="min-w-0">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2">Race Complete!</h2>
          <p className="text-gray-400 mb-6 text-lg sm:text-xl">
            Track {currentLevel.id}: {currentLevel.name}
          </p>

          {/* Race Results */}
          <div className="space-y-3 mb-6">
            <div className="text-xl sm:text-2xl text-yellow-400 font-semibold">
              1st: {raceResult.winner}
              {raceResult.times[raceResult.winner] !== undefined && (
                <span className="text-base sm:text-lg text-yellow-300 ml-2">
                  ({formatTime(raceResult.times[raceResult.winner])}s)
                </span>
              )}
            </div>
            {raceResult.second !== 'Unknown' && (
              <div className="text-lg sm:text-xl text-gray-300 font-semibold">
                2nd: {raceResult.second}
                {raceResult.times[raceResult.second] !== undefined && (
                  <span className="text-sm sm:text-base text-gray-200 ml-2">
                    ({formatTime(raceResult.times[raceResult.second])}s)
                  </span>
                )}
              </div>
            )}
            {raceResult.third !== 'Unknown' && (
              <div className="text-lg sm:text-xl text-gray-400 font-semibold">
                3rd: {raceResult.third}
                {raceResult.times[raceResult.third] !== undefined && (
                  <span className="text-sm sm:text-base text-gray-300 ml-2">
                    ({formatTime(raceResult.times[raceResult.third])}s)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Player Result */}
          <div className={`p-4 sm:p-6 rounded-lg ${raceResult.levelPassed ? 'bg-green-900' : 'bg-red-900'}`}>
            <p className="text-white font-bold text-lg sm:text-xl mb-2">
              You finished in position {raceResult.playerPosition}!
            </p>
            <p className={`text-base sm:text-lg ${raceResult.levelPassed ? 'text-green-300' : 'text-red-300'}`}>
              {raceResult.levelPassed
                ? (isLastLevel
                    ? 'Final track complete!'
                    : `Advancing to Track ${currentLevel.id + 1}...`)
                : `You needed top ${currentLevel.winCondition.maxPosition} to advance.`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <button
            onClick={onProceed}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 px-4 sm:py-4 sm:px-6 rounded-lg transition-colors text-lg sm:text-xl whitespace-nowrap"
          >
            {raceResult.levelPassed
              ? (isLastLevel ? 'See Results' : 'Next Track')
              : 'Continue'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
