interface MenuScreenProps {
  isPortraitMode: boolean
  totalLevels: number
  onStartGame: () => void
}

export function MenuScreen({ isPortraitMode, totalLevels, onStartGame }: MenuScreenProps) {
  if (isPortraitMode) {
    return (
      <div className="w-full h-full flex items-center justify-center px-3 py-4">
        <div className="max-w-5xl w-full bg-gray-800 bg-opacity-30 rounded-xl border border-gray-700 p-4 sm:p-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 sm:gap-6 items-center">
            <div className="min-w-0">
              <div className="text-4xl sm:text-6xl mb-3">🏎️</div>
              <h2 className="text-2xl sm:text-4xl font-bold text-white mb-3">Racing Game</h2>
              <p className="text-gray-300 text-sm sm:text-xl mb-4">
                Race against AI opponents across {totalLevels} tracks!
              </p>
              <div className="bg-gray-900 bg-opacity-50 rounded-lg p-3 sm:p-4">
                <p className="text-gray-300 text-xs sm:text-base text-left">
                  <span className="font-semibold">Controls:</span><br />
                  <span className="text-gray-400">• Desktop: Arrow Keys (↑ Forward, ↓ Reverse, ← → Turn)</span><br />
                  <span className="text-gray-400">• Mobile: Use on-screen D-pad</span>
                </p>
              </div>
              <p className="mt-3 text-yellow-300 text-xs sm:text-sm">
                Rotate to landscape to enable Start Race.
              </p>
            </div>
            <div className="flex items-center justify-end">
              <button
                onClick={onStartGame}
                disabled={true}
                className="bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 sm:py-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-xl whitespace-nowrap"
              >
                Start Race
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-900 overflow-hidden relative">
      <style>{`
        @keyframes racingMenuKenBurns {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.38); }
        }
      `}</style>
      <div
        className="absolute inset-0 bg-center bg-contain bg-no-repeat"
        style={{
          backgroundImage: 'url(/racing/woman_and_dog_watching_sunset.png)',
          transformOrigin: 'center center',
          animation: 'racingMenuKenBurns 35s ease-in-out infinite',
        }}
      />
      <button
        onClick={onStartGame}
        className="relative z-10 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold py-3 px-4 sm:py-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-xl whitespace-nowrap shadow-lg opacity-70 hover:opacity-90 active:opacity-80"
      >
        Start Race
      </button>
    </div>
  )
}
