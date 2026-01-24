interface GameWonDialogProps {
  totalLevels: number
  onBackToMenu: () => void
}

export function GameWonDialog({ totalLevels, onBackToMenu }: GameWonDialogProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl min-w-[400px]">
        <h2 className="text-3xl font-bold text-yellow-400 mb-4 text-center">Congratulations!</h2>
        <p className="text-white text-xl text-center mb-6">
          You completed all {totalLevels} tracks!
        </p>
        <p className="text-gray-300 text-center mb-6">
          You are a true racing champion!
        </p>
        <button
          onClick={onBackToMenu}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded transition-colors"
        >
          Back to Menu
        </button>
      </div>
    </div>
  )
}
