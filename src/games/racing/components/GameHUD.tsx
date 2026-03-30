interface GameHUDProps {
  playerLaps: number
  requiredLaps: number
}

export function GameHUD({ playerLaps, requiredLaps }: GameHUDProps) {
  return (
    <>
      {/* Lap counter */}
      <div className="absolute top-16 left-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded z-20">
        <div className="text-lg font-bold">Lap: {playerLaps} / {requiredLaps}</div>
      </div>
    </>
  )
}
