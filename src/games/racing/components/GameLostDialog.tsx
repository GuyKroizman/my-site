import { LevelConfig } from '../levels'

interface GameLostDialogProps {
  currentLevel: LevelConfig
  onBackToMenu: () => void
}

export function GameLostDialog({ currentLevel, onBackToMenu }: GameLostDialogProps) {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-90 z-10 flex flex-col items-center justify-center px-4 py-6 overflow-y-auto">
      <div className="max-w-2xl w-full text-center">
        <div className="text-6xl sm:text-8xl mb-6">🏁</div>
        <h2 className="text-3xl sm:text-4xl font-bold text-red-400 mb-4">Race Over</h2>
        <p className="text-white text-xl sm:text-2xl mb-4">
          You didn't qualify on Track {currentLevel.id}.
        </p>
        <p className="text-gray-300 text-lg sm:text-xl mb-6">
          Better luck next time!
        </p>
        <button
          onClick={onBackToMenu}
          className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg sm:text-xl"
        >
          Back to Menu
        </button>
      </div>
    </div>
  )
}
