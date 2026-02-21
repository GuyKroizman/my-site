export function PausedDialog() {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-90 z-30 flex items-center justify-center px-4 py-6">
      <div className="max-w-4xl w-full grid grid-cols-[minmax(0,1fr)_auto] gap-4 sm:gap-6 items-center">
        <div className="min-w-0">
          <div className="text-6xl sm:text-8xl mb-4">📱</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Game Paused</h2>
          <p className="text-gray-300 text-base sm:text-lg mb-2">
            Please rotate your device to landscape mode
          </p>
          <p className="text-gray-400 text-sm sm:text-base">
            The game will automatically resume when you rotate back to landscape
          </p>
        </div>
        <div className="flex items-center justify-end">
          <div className="animate-spin text-4xl sm:text-5xl">🔄</div>
        </div>
      </div>
    </div>
  )
}
