import { LevelConfig } from '../levels'
import { formatTime } from '../utils'

interface GameHUDProps {
  currentLevel: LevelConfig
  playerLaps: number
  requiredLaps: number
  raceTime: number
}

export function GameHUD({ currentLevel, playerLaps, requiredLaps, raceTime }: GameHUDProps) {
  return (
    <>
      {/* Level indicator */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded z-20">
        <div className="text-lg font-bold text-center">
          Track {currentLevel.id}: {currentLevel.name}
        </div>
      </div>
      
      {/* Lap counter */}
      <div className="absolute top-16 left-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded z-20">
        <div className="text-lg font-bold">Lap: {playerLaps} / {requiredLaps}</div>
      </div>
      
      {raceTime > 0 && (
        <div className="absolute top-16 right-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded z-20">
          <div className="text-lg font-bold">
            Time: {formatTime(raceTime)}s
          </div>
        </div>
      )}
    </>
  )
}
