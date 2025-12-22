import { Link } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import type { Game } from 'phaser'
import * as Phaser from 'phaser'
import { HootGameScene } from '../games/hoot/HootScene'
import { hootContext } from '../games/hoot/context'

export default function Hoot() {
  const phaserRef = useRef<Game>()

  useEffect(() => {
    if (!phaserRef.current) {
      const container = document.getElementById('phaser');
      const containerWidth = container?.clientWidth || window.innerWidth;
      const containerHeight = container?.clientHeight || window.innerHeight;

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: "phaser",
        width: containerWidth,
        height: containerHeight,
        backgroundColor: "#2d2d2d",
        pixelArt: true,
        physics: {
          default: "arcade",
          arcade: {
            gravity: { x: 0, y: 0 }, // No gravity for top-down physics
            debug: false
          }
        },
        scene: [new HootGameScene(hootContext)]
      };

      const game = new Phaser.Game(config);
      phaserRef.current = game;
    }
  }, [])

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden">
      <div className="flex justify-between items-center p-4 bg-gray-800 text-white flex-shrink-0">
        <h1 className="text-2xl font-bold">Hoot - Shooting Game</h1>
        <Link to="/" className="text-xl text-blue-400 underline hover:text-blue-300">
          Back to Menu
        </Link>
      </div>
      <div id="phaser" className="flex-1 w-full h-full overflow-hidden"></div>
    </div>
  )
}
