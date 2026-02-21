interface GameWonDialogProps {
  totalLevels: number
  onBackToMenu: () => void
}

export function GameWonDialog({ totalLevels, onBackToMenu }: GameWonDialogProps) {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-90 z-10 flex items-center justify-center px-4 py-6 overflow-y-auto">
      <div className="max-w-4xl w-full grid grid-cols-[minmax(0,1fr)_auto] gap-4 sm:gap-6 items-center">
        <div className="min-w-0">
          <div className="text-6xl sm:text-8xl mb-4">🏆</div>
          <h2 className="text-3xl sm:text-4xl font-bold text-yellow-400 mb-4">Congratulations!</h2>
          <p className="text-white text-xl sm:text-2xl mb-4">
            You completed all {totalLevels} tracks!
          </p>
          <p className="text-gray-300 text-lg sm:text-xl">
            You are a true racing champion!
          </p>
        </div>
        <div className="flex items-center justify-end">
          <button
            onClick={onBackToMenu}
            className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold py-3 px-4 sm:py-4 sm:px-6 rounded-lg transition-colors text-lg sm:text-xl whitespace-nowrap"
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  )
}
