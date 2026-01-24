interface MenuScreenProps {
  isPortraitMode: boolean
  totalLevels: number
  onStartGame: () => void
}

export function MenuScreen({ isPortraitMode, totalLevels, onStartGame }: MenuScreenProps) {
  if (isPortraitMode) {
    return (
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700 max-w-md mx-4">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">📱</div>
          <h2 className="text-3xl font-bold text-white mb-4">Rotate Your Device</h2>
          <p className="text-gray-300 text-lg mb-2">
            This game is designed for landscape mode
          </p>
          <p className="text-gray-400 text-sm">
            Please rotate your device to landscape orientation to play
          </p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin text-4xl">🔄</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700">
      <h2 className="text-3xl font-bold text-white mb-6 text-center">Racing Game</h2>
      <p className="text-gray-300 text-center mb-6">
        Race against AI opponents across {totalLevels} tracks!
      </p>
      <p className="text-gray-400 text-sm text-center mb-6">
        Controls: Arrow Keys (↑ Forward, ↓ Reverse, ← → Turn)<br />
        Mobile: Use on-screen D-pad
      </p>
      <button
        onClick={onStartGame}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded transition-colors text-xl"
      >
        Start Race
      </button>
    </div>
  )
}
