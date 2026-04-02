import type { UpgradeOption, UpgradeId } from '../upgrades'

interface UpgradeSelectionScreenProps {
  options: UpgradeOption[]
  onSelect: (id: UpgradeId) => void
}

export function UpgradeSelectionScreen({ options, onSelect }: UpgradeSelectionScreenProps) {
  return (
    <div className="absolute inset-0 bg-black/90 z-10 flex items-center justify-center px-4 py-4">
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="max-w-3xl w-full">
        <h2 className="text-2xl font-bold text-white text-center mb-6">Choose Your Upgrade</h2>
        <div className="flex gap-4 items-stretch">
          {options.map((option, index) => (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className="flex-1 flex flex-col items-center text-center p-5 rounded-xl border-2 border-white/20 bg-white/5 hover:bg-white/15 hover:border-yellow-400/60 transition-all duration-200 cursor-pointer"
              style={{
                animation: `slideUp 0.5s ease-out ${index * 0.1}s both`,
              }}
            >
              <span className="text-5xl mb-3">{option.icon}</span>
              <span className="text-lg font-bold text-white mb-2">{option.name}</span>
              <span className="text-sm text-gray-300 leading-snug">{option.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
