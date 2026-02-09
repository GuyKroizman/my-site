import { MuteButton } from './MuteButton'

interface MenuScreenProps {
  isPortraitMode: boolean
  onStartGame: () => void
  isMusicMuted: boolean
  onToggleMute: () => void
}

export function MenuScreen({ isPortraitMode, onStartGame, isMusicMuted, onToggleMute }: MenuScreenProps) {
  if (isPortraitMode) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center px-3 py-4">
        <div className="max-w-md w-full text-center">
          <div className="text-4xl sm:text-5xl mb-3">📱</div>
          <h2 className="text-lg sm:text-xl font-bold text-white mb-2">Rotate Your Device</h2>
          <p className="text-gray-300 text-xs sm:text-sm mb-1">
            This game is designed for landscape mode
          </p>
          <p className="text-gray-400 text-xs mb-2">
            Please rotate your device to landscape orientation to play
          </p>
          <div className="flex justify-center mt-3">
            <div className="animate-spin text-2xl">🔄</div>
          </div>
          <div className="mt-4">
            <MuteButton isMuted={isMusicMuted} onToggle={onToggleMute} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full min-h-0 flex flex-col overflow-y-auto overflow-x-hidden">
      <div className="flex flex-col items-center justify-center px-3 py-2 flex-1 min-h-0">
        <div className="max-w-lg w-full my-auto">
          <div className="text-center mb-2 sm:mb-3">
            <div className="text-3xl sm:text-4xl mb-1 sm:mb-2">🎭</div>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-1 sm:mb-2">The Mask</h2>
            <p className="text-gray-300 text-xs sm:text-sm mb-2 sm:mb-3">
              Mobile game made in 32 hours for Global Game Jam 2026. 3D top-down shooter — push boxes, shoot, survive.
            </p>
            <div className="bg-gray-800 bg-opacity-50 rounded-lg p-2 sm:p-3 mb-2 sm:mb-3">
              <p className="text-gray-300 text-[10px] sm:text-xs text-left leading-tight">
                <span className="font-semibold">Controls:</span><br />
                <span className="text-gray-400">Left joystick = move, right joystick = aim & shoot</span>
              </p>
            </div>
          </div>
          <button
            onClick={onStartGame}
            className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold py-2 sm:py-2.5 px-4 rounded-lg transition-colors text-sm"
          >
            Play
          </button>
          <div className="mt-3 flex justify-center">
            <MuteButton isMuted={isMusicMuted} onToggle={onToggleMute} />
          </div>
        </div>
      </div>
    </div>
  )
}
