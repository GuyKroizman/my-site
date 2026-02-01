interface MuteButtonProps {
  isMuted: boolean
  onToggle: () => void
}

export function MuteButton({ isMuted, onToggle }: MuteButtonProps) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 active:bg-gray-800 text-white rounded-lg transition-colors text-sm"
      aria-label={isMuted ? 'Unmute music' : 'Mute music'}
    >
      <span className="text-lg">{isMuted ? '🔇' : '🎵'}</span>
      <span>{isMuted ? 'Music Off' : 'Music On'}</span>
    </button>
  )
}
