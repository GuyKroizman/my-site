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
  ['Move', 'Arrows / HJKL; diagonals: Home / PgUp / End / PgDn'],
  ['Melee attack', 'Walk into enemy'],
  ['Ranged attack', 'Equip bow/scroll, then click/tap enemy'],
  ['Inspect', 'Inspect button or x, then tap a tile'],
  ['Throw', 'Inventory → item → Throw → tap tile'],
  ['Wait', 'Space'],
] as const

const HELP_PAGES = [
  {
    title: 'Basics',
    body: `• Move with the Arrow keys or HJKL. Diagonals: Home (↖), Page Up (↗), End (↙), Page Down (↘). Click/tap a destination to walk the shortest available route.\n• Walk into an enemy to attack it (melee).\n• Space waits one turn.\n• Press i or b to open your backpack.\n• Press the Inspect button or x, then tap/click a tile to inspect it.`,
  },
  {
    title: 'Combat',
    body: `• Melee: walk into an enemy.\n• Ranged: equip a bow or wand, then click/tap an enemy.\n• Damage types: physical, fire, ice, shock, poison, magic.\n• Armor reduces physical damage; resistances reduce typed damage.\n• Surprise attacks (unseen) always hit and can cause bleeding.\n• Status effects: burning, poisoned, bleeding, frozen, weakened, crippled.\n• Regeneration and status effects follow elapsed game time; frozen skips an action.\n• Movement and attacks have separate speeds. Haste speeds up walking only.\n• Heavy weapons take longer to swing, giving enemies more time to act.\n• Time pauses while you choose an action; inspection and opening the backpack are free.`,
  },
  {
    title: 'Food & Hunger',
    body: `• Your Food meter drops by 0.25 per world-time unit (1 point every 4 normal moves).\n• Above 80 you are well-fed and slowly regain health.\n• Below 30 you get a warning that you are hungry.\n• At 0 you are starving: take 1 damage per round until you eat.\n• Eat Rations to restore hunger.`,
  },
  {
    title: 'Items & Equipment',
    body: `• Slots: weapon, armor, two rings, artifact — plus a 20-slot backpack.\n• Unidentified items show as ?potion, ?scroll, etc. Use them to learn what they are (or use a Scroll of Identify).\n• Cursed items cannot be unequipped until you Remove Curse (or use Holy Water).\n• Scrolls of Upgrade raise an item's level.\n• Wands have limited charges — a Scroll of Recharging refills them.\n• Rings grant passive bonuses.`,
  },
  {
    title: 'Skills',
    body: `• Each class has a passive and one active skill.\n• Press f to use your active skill.\n• Skills have a cooldown shown in your stats.\n• Warrior: Power Strike · Dwarf: Shield Bash · Cleric: Heal.\n• Elf: Multishot · Wizard: Nova.`,
  },
  {
    title: 'Terrain',
    body: `• Doors open when you walk into them (monsters open them too).\n• Traps are hidden until you step on them.\n• Grass burns; water douses fire; chasms cannot be crossed.\n• Stepping on a trap reveals and triggers it.`,
  },
  {
    title: 'Progress',
    body: `• Find the stairs and descend. Escape at the bottom floor.\n• Monsters drop gold and grant XP.\n• Leveling up raises max HP and attack.\n• Dying ends the run — plan food, health, and positioning.`,
  },
] as const

function HelpModal({
  page,
  onClose,
  onPrev,
  onNext,
}: {
  page: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const p = HELP_PAGES[page]
  return (
    <div className="rogue0-help-overlay" onClick={onClose}>
      <div className="rogue0-help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rogue0-help-head">
          <span className="rogue0-help-title">{p.title}</span>
          <button className="rogue0-help-close" onClick={onClose} aria-label="Close help">
            ✕
          </button>
        </div>
        <div className="rogue0-help-body">{p.body}</div>
        <div className="rogue0-help-nav">
          <button className="rogue0-help-btn" onClick={onPrev} disabled={page === 0}>
            ← Prev
          </button>
          <span className="rogue0-help-pages">
            {page + 1} / {HELP_PAGES.length}
          </span>
          <button
            className="rogue0-help-btn"
            onClick={onNext}
            disabled={page === HELP_PAGES.length - 1}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Rogue0() {
  const phaserRef = useRef<Game | null>(null)
  const contextRef = useRef<GameContext | null>(null)
  const [heroClass, setHeroClass] = useState<string | null>(null)
  const [result, setResult] = useState<EndResult | null>(null)
  const [inspectMode, setInspectMode] = useState(false)
  const [muted, setMuted] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpPage, setHelpPage] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!heroClass) return

    const context = createGameContext()
    context.heroClass = heroClass
    context.inspectMode = inspectMode
    context.onEnd = (r) => {
      phaserRef.current?.destroy(true)
      phaserRef.current = null
      setHelpOpen(false)
      setResult(r)
    }
    context.onInspectModeChange = (mode) => setInspectMode(mode)
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
          mode: Phaser.Scale.RESIZE,
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

  const toggleMute = () => {
    setMuted(toggleMuted())
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.()
      return
    }
    const el = document.documentElement
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => undefined)
    }
  }

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const openHelp = () => {
    if (contextRef.current) contextRef.current.helpOpen = true
    setHelpPage(0)
    setHelpOpen(true)
  }

  const helpModal = helpOpen ? (
    <HelpModal
      page={helpPage}
      onClose={() => {
        if (contextRef.current) contextRef.current.helpOpen = false
        setHelpOpen(false)
      }}
      onPrev={() => setHelpPage((p) => Math.max(0, p - 1))}
      onNext={() => setHelpPage((p) => Math.min(HELP_PAGES.length - 1, p + 1))}
    />
  ) : null

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
          <button className="rogue0-link-btn" onClick={openHelp}>Help</button>

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
        {helpModal}
      </div>
    )
  }

  return (
    <div className="rogue0-game">
      <div className="rogue0-game-head">
        <span className="rogue0-game-title">Rogue0</span>
        <div className="rogue0-game-actions">
          <button className="rogue0-game-btn" onClick={openHelp}>Help</button>
          <button
            className="rogue0-game-btn"
            onClick={toggleFullscreen}
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? 'Exit FS' : 'Fullscreen'}
          </button>
          <button
            className={`rogue0-game-btn ${muted ? 'off' : ''}`}
            onClick={toggleMute}
            aria-pressed={muted}
          >
            {muted ? 'Sound: OFF' : 'Sound: ON'}
          </button>
          <Link to="/">← back</Link>
        </div>
      </div>

      <div className="rogue0-game-stage">
        <div id="phaser"></div>
      </div>

      {helpModal}
    </div>
  )
}
