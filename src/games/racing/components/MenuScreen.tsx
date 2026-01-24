interface MenuScreenProps {
  isPortraitMode: boolean
  totalLevels: number
  onStartGame: () => void
}

export function MenuScreen({ isPortraitMode, totalLevels, onStartGame }: MenuScreenProps) {
  if (isPortraitMode) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center px-4 py-6">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl sm:text-8xl mb-6">📱</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Rotate Your Device</h2>
          <p className="text-gray-300 text-base sm:text-lg mb-2">
            This game is designed for landscape mode
          </p>
          <p className="text-gray-400 text-sm sm:text-base">
            Please rotate your device to landscape orientation to play
          </p>
          <div className="flex justify-center mt-6">
            <div className="animate-spin text-4xl">🔄</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-4 py-6">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="text-6xl sm:text-8xl mb-6">🏎️</div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Racing Game</h2>
          <p className="text-gray-300 text-lg sm:text-xl mb-6">
            Race against AI opponents across {totalLevels} tracks!
          </p>
          <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 mb-6">
            <p className="text-gray-300 text-sm sm:text-base text-left">
              <span className="font-semibold">Controls:</span><br />
              <span className="text-gray-400">• Desktop: Arrow Keys (↑ Forward, ↓ Reverse, ← → Turn)</span><br />
              <span className="text-gray-400">• Mobile: Use on-screen D-pad</span>
            </p>
          </div>
        </div>
        <button
          onClick={onStartGame}
          className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg sm:text-xl"
        >
          Start Race
        </button>
      </div>
    </div>
  )
}
