interface MenuScreenProps {
  isPortraitMode: boolean
  onStartGame: () => void
}

export function MenuScreen({ isPortraitMode, onStartGame }: MenuScreenProps) {
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
    <div className="w-full h-full min-h-0 flex flex-col overflow-y-auto overflow-x-hidden">
      <div className="flex flex-col items-center justify-center px-4 py-4 flex-1 min-h-0">
        <div className="max-w-lg w-full my-auto">
          <div className="text-center mb-4 sm:mb-6">
            <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">🎭</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 sm:mb-4">The Mask</h2>
            <p className="text-gray-300 text-base sm:text-lg mb-3 sm:mb-6">
              3D top-down shooter. Push boxes, shoot, survive.
            </p>
            <div className="bg-gray-800 bg-opacity-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <p className="text-gray-300 text-xs sm:text-sm text-left">
                <span className="font-semibold">Controls:</span><br />
                <span className="text-gray-400">• Desktop: Arrow keys (or WASD) to move, Space to shoot</span><br />
                <span className="text-gray-400">• Mobile: Use on-screen D-pad and shoot button (landscape only)</span>
              </p>
            </div>
          </div>
          <button
            onClick={onStartGame}
            className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold py-3 sm:py-4 px-6 rounded-lg transition-colors text-base sm:text-xl"
          >
            Play
          </button>
        </div>
      </div>
    </div>
  )
}
