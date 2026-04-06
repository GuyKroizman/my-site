import { Link } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import type { Game } from 'phaser'
import * as Phaser from 'phaser'
import { createRogue0Config } from '../games/rogue0/config'
import { UI } from '../games/rogue0/ui'
import { createGameContext } from '../games/rogue0/context'

export default function Rogue0() {
  const phaserRef = useRef<Game | null>(null)
  
  useEffect(() => {
    if (!phaserRef.current) {
      const context = createGameContext()
      const game = new Phaser.Game(createRogue0Config(context));
      phaserRef.current = game

      const ui = new UI(context);
      game.scene.add('ui-scene', ui, true)
    }

    return () => {
      phaserRef.current?.destroy(true)
      phaserRef.current = null
    }
  }, [])

  return (
    <div>
      <h1>Rogue0</h1>
      <Link to="/" className="text-xl text-blue-600 underline">
        Back
      </Link>
      <div id="phaser"></div>
      <div>Tiles generously from <a href='https://kenney.nl/'>Kenney's</a> assets</div>
    </div>
  );
}
