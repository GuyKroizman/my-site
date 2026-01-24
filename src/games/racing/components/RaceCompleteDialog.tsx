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
              ? (isLastLevel 
                  ? 'Final track complete!' 
                  : `Advancing to Track ${currentLevel.id + 1}...`)
              : `You needed top ${currentLevel.winCondition.maxPosition} to advance.`
            }
          </p>
        </div>

        <button
          onClick={onProceed}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded transition-colors"
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
