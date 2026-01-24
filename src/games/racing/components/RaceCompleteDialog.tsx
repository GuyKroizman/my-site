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
    <div className="absolute inset-0 bg-black bg-opacity-90 z-10 flex flex-col items-center justify-center px-4 py-6 overflow-y-auto">
      <div className="max-w-2xl w-full">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 text-center">Race Complete!</h2>
        <p className="text-gray-400 text-center mb-6 text-lg sm:text-xl">
          Track {currentLevel.id}: {currentLevel.name}
        </p>
        
        {/* Race Results */}
        <div className="space-y-3 mb-6">
          <div className="text-xl sm:text-2xl text-yellow-400 font-semibold text-center">
            1st: {raceResult.winner}
            {raceResult.times[raceResult.winner] !== undefined && (
              <span className="text-base sm:text-lg text-yellow-300 ml-2">
                ({formatTime(raceResult.times[raceResult.winner])}s)
              </span>
            )}
          </div>
          {raceResult.second !== 'Unknown' && (
            <div className="text-lg sm:text-xl text-gray-300 font-semibold text-center">
              2nd: {raceResult.second}
              {raceResult.times[raceResult.second] !== undefined && (
                <span className="text-sm sm:text-base text-gray-200 ml-2">
                  ({formatTime(raceResult.times[raceResult.second])}s)
                </span>
              )}
            </div>
          )}
          {raceResult.third !== 'Unknown' && (
            <div className="text-lg sm:text-xl text-gray-400 font-semibold text-center">
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
        <div className={`p-4 sm:p-6 rounded-lg mb-6 ${raceResult.levelPassed ? 'bg-green-900' : 'bg-red-900'}`}>
          <p className="text-white font-bold text-center text-lg sm:text-xl mb-2">
            You finished in position {raceResult.playerPosition}!
          </p>
          <p className={`text-center text-base sm:text-lg ${raceResult.levelPassed ? 'text-green-300' : 'text-red-300'}`}>
            {raceResult.levelPassed 
              ? (isLastLevel 
                  ? 'Final track complete!' 
                  : `Advancing to Track ${currentLevel.id + 1}...`)
              : `You needed top ${currentLevel.winCondition.maxPosition} to advance.`
            }
          </p>
        </div>

        <button
          onClick={onProceed}
          className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg sm:text-xl"
        >
          {raceResult.levelPassed 
            ? (isLastLevel ? 'See Results' : 'Next Track')
            : 'Continue'
          }
        </button>
      </div>
    </div>
  )
}
