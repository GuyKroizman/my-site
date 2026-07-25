import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import type { Game } from 'phaser'
import * as Phaser from 'phaser'
import { BootScene } from '../games/gmtk2026/scenes/BootScene'
import { GameScene } from '../games/gmtk2026/scenes/GameScene'

function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

export default function Gmtk2026() {
  const phaserRef = useRef<Game>()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(isMobileDevice())
  }, [])

  useEffect(() => {
    if (isMobile) return
    if (!phaserRef.current) {
      const search = new URLSearchParams(window.location.search)
      const startStage = search.get('stage') as
        | 'baby'
        | 'young-adult'
        | 'adult'
        | 'adult-plus'
        | 'middle-aged'
        | 'middle-ager'
        | 'elderly'
        | null
      const startXParam = search.get('x')
      const startX = startXParam ? Number(startXParam) : undefined
      ;(window as any).__GMTK2026_DEBUG = { startStage, startX }

      const container = document.getElementById('gmtk2026-phaser')
      const containerWidth = container?.clientWidth || window.innerWidth
      const containerHeight = container?.clientHeight || window.innerHeight

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: 'gmtk2026-phaser',
        width: containerWidth,
        height: containerHeight,
        backgroundColor: '#87ceeb',
        pixelArt: true,
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 800 },
            debug: false,
          },
        },
        scene: [BootScene, GameScene],
      }

      const game = new Phaser.Game(config)
      phaserRef.current = game
      ;(window as any).game = game
    }
  }, [isMobile])

  useEffect(() => {
    return () => {
      if (phaserRef.current) {
        phaserRef.current.destroy(true)
        phaserRef.current = undefined
      }
    }
  }, [])

  if (isMobile) {
    return (
      <div className="w-full h-screen flex flex-col overflow-hidden bg-gray-800">
        <div className="flex justify-between items-center p-4 bg-gray-800 text-white flex-shrink-0">
          <h1 className="text-2xl font-bold">Seasons of Life</h1>
          <Link to="/" className="text-xl text-blue-400 underline hover:text-blue-300">
            Back to Menu
          </Link>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-white text-center px-6">
          <p className="text-xl mb-4">This game is desktop-only.</p>
          <p className="text-gray-400">Please play on a computer for the best experience.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden">
      <div className="flex justify-between items-center p-4 bg-gray-800 text-white flex-shrink-0">
        <h1 className="text-2xl font-bold">Seasons of Life</h1>
        <Link to="/" className="text-xl text-blue-400 underline hover:text-blue-300">
          Back to Menu
        </Link>
      </div>
      <div id="gmtk2026-phaser" className="flex-1 w-full h-full overflow-hidden"></div>
    </div>
  )
}
