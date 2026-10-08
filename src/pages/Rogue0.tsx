import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import type { Game } from 'phaser'
import * as Phaser from 'phaser'
import { createRogue0Config } from '../games/rogue0/config'
import { UI } from '../games/rogue0/ui'
import { createGameContext, type EndResult } from '../games/rogue0/context'

const HERO_CLASSES = ['Warrior', 'Dwarf', 'Cleric', 'Elf', 'Wizard'] as const

export default function Rogue0() {
  const phaserRef = useRef<Game | null>(null)
  const [heroClass, setHeroClass] = useState<string | null>(null)
  const [result, setResult] = useState<EndResult | null>(null)

  useEffect(() => {
    if (!heroClass) return

    const context = createGameContext()
    context.heroClass = heroClass
    context.onEnd = (r) => {
      phaserRef.current?.destroy(true)
      phaserRef.current = null
      setResult(r)
    }

    const game = new Phaser.Game(createRogue0Config(context))
    phaserRef.current = game

    const ui = new UI(context)
    game.scene.add('ui-scene', ui, true)

    return () => {
      phaserRef.current?.destroy(true)
      phaserRef.current = null
    }
  }, [heroClass])

  if (result) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">
          {result.victory ? 'You escaped the dungeon!' : 'You died'}
        </h1>
        <p className="text-xl mb-2">
          {result.victory
            ? 'You made it out alive. Legendary.'
            : 'The dungeon claims another adventurer.'}
        </p>
        <p className="mb-4">
          Floor reached: {result.floor} · Kills: {result.kills}
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => {
              setResult(null)
              setHeroClass(null)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Play again
          </button>
          <Link to="/" className="px-4 py-2 border rounded">
            Back home
          </Link>
        </div>
      </div>
    )
  }

  if (!heroClass) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-2">Rogue0</h1>
        <p className="mb-4">Choose your hero:</p>
        <div className="flex flex-wrap gap-4">
          {HERO_CLASSES.map((c) => (
            <button
              key={c}
              onClick={() => setHeroClass(c)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {c}
            </button>
          ))}
        </div>
        <Link to="/" className="inline-block mt-6 text-blue-600 underline">
          Back
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1>Rogue0</h1>
      <Link to="/" className="text-xl text-blue-600 underline">
        Back
      </Link>
      <div id="phaser"></div>
      <div>
        Tiles generously from <a href='https://kenney.nl/'>Kenney's</a> assets
      </div>
    </div>
  )
}
