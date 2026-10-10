import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import type { Game } from 'phaser'
import * as Phaser from 'phaser'
import { createRogue0Config } from '../games/rogue0/config'
import { UI } from '../games/rogue0/ui'
import {
  createGameContext,
  type EndResult,
  type GameContext,
} from '../games/rogue0/context'
import { toggleMuted, unlockAudio } from '../games/rogue0/audio'

const HERO_CLASSES = [
  { name: 'Warrior', desc: 'sword & steel' },
  { name: 'Dwarf', desc: 'axe & shield' },
  { name: 'Cleric', desc: 'heals over time' },
  { name: 'Elf', desc: 'swift archer' },
  { name: 'Wizard', desc: 'fire & lightning' },
] as const

const CONTROLS = [
  ['Move', 'Arrow keys / HJKL'],
  ['Attack', 'Walk into enemy'],
  ['Equip', '1–0'],
  ['Inspect', 'Hover or Inspect button'],
  ['Wait', 'Space'],
] as const

export default function Rogue0() {
  const phaserRef = useRef<Game | null>(null)
  const contextRef = useRef<GameContext | null>(null)
  const [heroClass, setHeroClass] = useState<string | null>(null)
  const [result, setResult] = useState<EndResult | null>(null)
  const [inspectMode, setInspectMode] = useState(false)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    if (!heroClass) return

    const context = createGameContext()
    context.heroClass = heroClass
    context.inspectMode = inspectMode
    context.onEnd = (r) => {
      phaserRef.current?.destroy(true)
      phaserRef.current = null
      setResult(r)
    }
    contextRef.current = context

    const game = new Phaser.Game(createRogue0Config(context))
    phaserRef.current = game

    const ui = new UI(context)
    game.scene.add('ui-scene', ui, true)

    return () => {
      phaserRef.current?.destroy(true)
      phaserRef.current = null
      contextRef.current = null
    }
  }, [heroClass])

  const startGame = (name: string) => {
    unlockAudio()
    setInspectMode(false)
    setHeroClass(name)
  }

  const toggleInspect = () => {
    const next = !inspectMode
    setInspectMode(next)
    if (contextRef.current) {
      contextRef.current.inspectMode = next
    }
  }

  const toggleMute = () => {
    setMuted(toggleMuted())
  }

  if (result) {
    return (
      <div className="rogue0-shell">
        <div className="rogue0-panel">
          <h1 className={`rogue0-title ${result.victory ? 'rogue0-win' : 'rogue0-lose'}`}>
            {result.victory ? 'You escaped!' : 'You died'}
          </h1>
          <p className="rogue0-subtitle">
            {result.victory
              ? 'The dungeon is behind you. Legendary.'
              : 'The dungeon claims another adventurer.'}
          </p>
          <p className="rogue0-stats">
            Floor {result.floor} · Kills {result.kills}
          </p>
          <div className="rogue0-actions">
            <button
              className="rogue0-btn"
              onClick={() => {
                setResult(null)
                setHeroClass(null)
              }}
            >
              Play again
            </button>
            <Link to="/" className="rogue0-btn">
              Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!heroClass) {
    return (
      <div className="rogue0-shell">
        <div className="rogue0-panel">
          <h1 className="rogue0-title">Rogue0</h1>
          <p className="rogue0-subtitle">Choose your hero</p>

          <div className="rogue0-classes">
            {HERO_CLASSES.map((c) => (
              <button
                key={c.name}
                className="rogue0-btn"
                onClick={() => startGame(c.name)}
              >
                <span className="rogue0-btn-name">{c.name}</span>
                <span className="rogue0-btn-desc">{c.desc}</span>
              </button>
            ))}
          </div>

          <div className="rogue0-instructions">
            <h2>How to play</h2>
            <ul>
              {CONTROLS.map(([action, keys]) => (
                <li key={action}>
                  <span className="rogue0-key">{action}</span>
                  <span>{keys}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="rogue0-foot">
            <Link to="/">← back to home</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rogue0-game">
      <div className="rogue0-game-head">
        <span className="rogue0-game-title">Rogue0</span>
        <div className="rogue0-game-actions">
          <button
            className={`rogue0-game-btn ${muted ? 'off' : ''}`}
            onClick={toggleMute}
            aria-pressed={muted}
          >
            {muted ? 'Sound: OFF' : 'Sound: ON'}
          </button>
          <button
            className={`rogue0-game-btn ${inspectMode ? 'is-on' : ''}`}
            onClick={toggleInspect}
            aria-pressed={inspectMode}
          >
            {inspectMode ? 'Inspect: ON' : 'Inspect'}
          </button>
          <Link to="/">← back</Link>
        </div>
      </div>

      <div className="rogue0-game-stage">
        <div id="phaser"></div>
      </div>

      <p className="rogue0-game-foot">
        Tiles from <a href="https://kenney.nl/">Kenney</a>
      </p>
    </div>
  )
}
