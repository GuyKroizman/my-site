import { LevelConfig } from '../levels'

interface GameLostDialogProps {
  currentLevel: LevelConfig
  onBackToMenu: () => void
}

export function GameLostDialog({ currentLevel, onBackToMenu }: GameLostDialogProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl min-w-[400px]">
        <h2 className="text-3xl font-bold text-red-400 mb-4 text-center">Race Over</h2>
        <p className="text-white text-xl text-center mb-6">
          You didn't qualify on Track {currentLevel.id}.
        </p>
        <p className="text-gray-300 text-center mb-6">
          Better luck next time!
        </p>
        <button
          onClick={onBackToMenu}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded transition-colors"
        >
          Back to Menu
        </button>
      </div>
    </div>
  )
}
