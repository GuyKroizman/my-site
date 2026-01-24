export function PausedDialog() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 z-30">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl min-w-[300px] max-w-md mx-4">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">📱</div>
          <h2 className="text-3xl font-bold text-white mb-4">Game Paused</h2>
          <p className="text-gray-300 text-lg mb-2">
            Please rotate your device to landscape mode
          </p>
          <p className="text-gray-400 text-sm">
            The game will automatically resume when you rotate back to landscape
          </p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin text-4xl">🔄</div>
        </div>
      </div>
    </div>
  )
}
