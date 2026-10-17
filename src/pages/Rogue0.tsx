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
  ['Melee attack', 'Walk into enemy'],
  ['Ranged attack', 'Equip bow/scroll, then click/tap enemy'],
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

    let cancelled = false
    // Canvas text must be measured after the web fonts load, not with the
    // fallback font (setText with an unchanged string does not repaint it).
    const start = async () => {
      await Promise.all([
        document.fonts.load('10px "Press Start 2P"'),
        document.fonts.load('16px "VT323"'),
      ]).catch(() => undefined)
      if (cancelled) return
      const config = createRogue0Config(context)
      const game = new Phaser.Game({
        ...config,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
        },
      })
      phaserRef.current = game
      game.scene.add('ui-scene', new UI(context), true)
    }
    void start()

    return () => {
      cancelled = true
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
          <div className="rogue0-stats">
            <span className="rogue0-stat">
              <span className="rogue0-stat-label">Floor</span>
              <span className="rogue0-stat-value">{result.floor}</span>
            </span>
            <span className="rogue0-stat">
              <span className="rogue0-stat-label">Kills</span>
              <span className="rogue0-stat-value">{result.kills}</span>
            </span>
          </div>
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
                  <span className="rogue0-ctl-action">{action}</span>
                  <span className="rogue0-ctl-keys">{keys}</span>
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
