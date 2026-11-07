// Phase 17 — local-only scenario setup screen (see PLAN.md).
// Rendered only from src/pages/Rogue0.tsx behind isLocalViteDev(); it writes a
// Scenario onto GameContext for scene0 to apply to the starting floor.
import { useMemo, useState } from 'react'
import {
  MAX_SCENARIO_ITEM_COUNT,
  MAX_SCENARIO_LEVEL,
  MAX_SCENARIO_MONSTERS,
  normalizeScenario,
  scenarioCatalog,
  type Scenario,
} from '../../games/rogue0/scenario'
import { CLASS_TALENTS } from '../../games/rogue0/classes/basicHero'
import { floorProgression, isBossFloor } from '../../games/rogue0/progression'
import { floorHasSecretRoom } from '../../games/rogue0/mapgen'
import { DEFAULT_HERO_CLASS } from '../../games/rogue0/classes'

type InventoryRow = {
  id: string
  count: number
  equip: boolean
  cursed: boolean
  upgrade: number
  tier?: number
}

type MonsterRow = {
  kind: string
  count: number
  near: boolean
  awake: boolean
}

type Form = {
  floor: number
  heroClass: string
  level: number
  healthPoints?: number
  hunger?: number
  gold?: number
  talents: Record<string, number>
  replaceGear: boolean
  inventory: InventoryRow[]
  monsterMode: 'replace' | 'append'
  monsters: MonsterRow[]
}

function defaultForm(): Form {
  return {
    floor: 1,
    heroClass: DEFAULT_HERO_CLASS,
    level: 1,
    talents: {},
    replaceGear: false,
    inventory: [],
    monsterMode: 'replace',
    monsters: [],
  }
}

function formFromScenario(scenario: Scenario): Form {
  const hero = scenario.hero ?? {}
  return {
    floor: scenario.floor,
    heroClass: hero.class ?? DEFAULT_HERO_CLASS,
    level: hero.level ?? 1,
    healthPoints: hero.healthPoints,
    hunger: hero.hunger,
    gold: hero.gold,
    talents: { ...(hero.talents ?? {}) },
    replaceGear: scenario.inventory !== undefined,
    inventory: (scenario.inventory ?? []).map(item => ({
      id: item.id,
      count: item.count ?? 1,
      equip: !!item.equip,
      cursed: !!item.cursed,
      upgrade: item.upgrade ?? 0,
      tier: item.tier,
    })),
    monsterMode: scenario.monsters?.mode ?? 'replace',
    monsters: (scenario.monsters?.list ?? []).map(monster => ({
      kind: monster.kind,
      count: monster.count ?? 1,
      near: !!monster.near,
      awake: !!monster.awake,
    })),
  }
}

function toScenario(form: Form): Scenario {
  const talents = Object.fromEntries(
    Object.entries(form.talents).filter(([, rank]) => rank > 0)
  )
  const scenario: Scenario = {
    floor: form.floor,
    hero: {
      class: form.heroClass,
      level: form.level,
      ...(form.healthPoints !== undefined ? { healthPoints: form.healthPoints } : {}),
      ...(form.hunger !== undefined ? { hunger: form.hunger } : {}),
      ...(form.gold !== undefined ? { gold: form.gold } : {}),
      ...(Object.keys(talents).length ? { talents } : {}),
    },
  }
  if (form.replaceGear) {
    scenario.inventory = form.inventory.map(row => ({
      id: row.id,
      count: row.count,
      ...(row.equip ? { equip: true } : {}),
      ...(row.cursed ? { cursed: true } : {}),
      ...(row.upgrade ? { upgrade: row.upgrade } : {}),
      ...(row.tier !== undefined && row.tier > 0 ? { tier: row.tier } : {}),
    }))
  }
  scenario.monsters = {
    mode: form.monsterMode,
    list: form.monsters.map(row => ({
      kind: row.kind,
      count: row.count,
      ...(row.near ? { near: true } : {}),
      ...(row.awake ? { awake: true } : {}),
    })),
  }
  return scenario
}

function numberOrUndefined(raw: string): number | undefined {
  if (raw.trim() === '') return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? Math.floor(value) : undefined
}

function floorHint(floor: number, maxFloor: number): string {
  const band = floorProgression(floor)
  const perks = [
    band.strengthPotions ? 'strength potion' : '',
    band.upgradeScrolls ? 'upgrade scroll' : '',
    band.weapon ? 'guaranteed weapon' : '',
    band.armor ? 'guaranteed armor' : '',
  ].filter(Boolean)
  const notes = [`band ${band.tier} (tier ${band.tier} loot)`]
  if (perks.length) notes.push(perks.join(', '))
  if (floorHasSecretRoom(floor)) notes.push('secret gem room')
  if (isBossFloor(floor)) {
    notes.push(floor === maxFloor ? 'final floor — boss ends the run' : 'boss floor — stairs sealed')
  }
  if (floor > 15) notes.push('dark floor')
  return notes.join(' · ')
}

export default function ScenarioSetupPanel({
  initial,
  maxFloor,
  onStart,
  onCancel,
}: {
  initial?: Scenario
  maxFloor: number
  onStart: (scenario: Scenario) => void
  onCancel: () => void
}) {
  const catalog = useMemo(() => scenarioCatalog(), [])
  const [form, setForm] = useState<Form>(() => (initial ? formFromScenario(initial) : defaultForm()))
  const [errors, setErrors] = useState<string[]>([])
  const [itemFilter, setItemFilter] = useState('')
  const [newItemId, setNewItemId] = useState('')
  const [newMonsterKind, setNewMonsterKind] = useState('')
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')

  const patch = (change: Partial<Form>) => setForm(current => ({ ...current, ...change }))

  const items = catalog.entries.filter(entry => entry.category !== 'hero' && entry.category !== 'monster')
  const monsters = catalog.entries.filter(entry => entry.category === 'monster')
  const heroes = catalog.entries.filter(entry => entry.category === 'hero')
  const talents = CLASS_TALENTS[form.heroClass as keyof typeof CLASS_TALENTS] ?? []

  const filteredItems = items.filter(entry =>
    !itemFilter || `${entry.id} ${entry.label}`.toLowerCase().includes(itemFilter.toLowerCase())
  )

  const addItem = () => {
    const entry = items.find(candidate => candidate.id === newItemId)
    if (!entry) return
    patch({
      replaceGear: true,
      inventory: [...form.inventory, {
        id: entry.id, count: 1, equip: false, cursed: false, upgrade: 0,
        ...(/^Tiered/.test(entry.id) ? { tier: floorProgression(form.floor).tier } : {}),
      }],
    })
  }

  const updateItem = (index: number, change: Partial<InventoryRow>) =>
    patch({ inventory: form.inventory.map((row, i) => (i === index ? { ...row, ...change } : row)) })

  const addMonster = () => {
    const entry = monsters.find(candidate => candidate.id === newMonsterKind)
    if (!entry) return
    patch({ monsters: [...form.monsters, { kind: entry.id, count: 1, near: false, awake: false }] })
  }

  const updateMonster = (index: number, change: Partial<MonsterRow>) =>
    patch({ monsters: form.monsters.map((row, i) => (i === index ? { ...row, ...change } : row)) })

  const start = () => {
    const { scenario, errors: problems } = normalizeScenario(toScenario(form), maxFloor)
    setErrors(problems)
    if (!problems.length) onStart(scenario)
  }

  const loadJson = () => {
    try {
      const parsed = JSON.parse(jsonText)
      const { scenario, errors: problems } = normalizeScenario(parsed, maxFloor)
      if (problems.length) {
        setJsonError(problems.join(' '))
        return
      }
      setJsonError('')
      setErrors([])
      setForm(formFromScenario(scenario))
    } catch (error) {
      setJsonError(`Invalid JSON: ${(error as Error).message}`)
    }
  }

  return (
    <div className="rogue0-panel rogue0-dev-panel">
      <h1 className="rogue0-title">Scenario</h1>
      <p className="rogue0-subtitle">Local test start state</p>

      <div className="rogue0-dev-scroll">
      {errors.length > 0 && (
        <ul className="rogue0-dev-errors" role="alert">
          {errors.map(error => <li key={error}>{error}</li>)}
        </ul>
      )}

      <section className="rogue0-dev-section">
        <h2>Floor</h2>
        <div className="rogue0-dev-row">
          <input
            type="range"
            min={1}
            max={maxFloor}
            value={form.floor}
            aria-label="Starting floor"
            onChange={event => patch({ floor: Number(event.target.value) })}
          />
          <span className="rogue0-dev-value">Floor {form.floor}</span>
        </div>
        <p className="rogue0-dev-hint">{floorHint(form.floor, maxFloor)}</p>
      </section>

      <section className="rogue0-dev-section">
        <h2>Hero</h2>
        <div className="rogue0-dev-grid">
          <label>Class
            <select value={form.heroClass} onChange={event => patch({ heroClass: event.target.value, talents: {} })}>
              {heroes.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select>
          </label>
          <label>Level
            <input type="number" min={1} max={MAX_SCENARIO_LEVEL} value={form.level}
              onChange={event => patch({ level: Number(event.target.value) })} />
          </label>
          <label>HP
            <input type="number" min={1} placeholder="full" value={form.healthPoints ?? ''}
              onChange={event => patch({ healthPoints: numberOrUndefined(event.target.value) })} />
          </label>
          <label>Food
            <input type="number" min={0} max={100} placeholder="100" value={form.hunger ?? ''}
              onChange={event => patch({ hunger: numberOrUndefined(event.target.value) })} />
          </label>
          <label>Gold
            <input type="number" min={0} placeholder="0" value={form.gold ?? ''}
              onChange={event => patch({ gold: numberOrUndefined(event.target.value) })} />
          </label>
        </div>
        {talents.length > 0 && (
          <div className="rogue0-dev-row">
            {talents.map(talent => (
              <label key={talent.id} className="rogue0-dev-inline" title={talent.description}>
                {talent.name}
                <select value={form.talents[talent.id] ?? 0}
                  onChange={event => patch({
                    talents: { ...form.talents, [talent.id]: Number(event.target.value) },
                  })}>
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="rogue0-dev-section">
        <h2>Inventory</h2>
        <label className="rogue0-dev-inline">
          <input type="checkbox" checked={form.replaceGear}
            onChange={event => patch({ replaceGear: event.target.checked })} />
          Replace the class&apos;s starting gear with this list
        </label>
        {form.replaceGear ? (
          <>
            <div className="rogue0-dev-row">
              <input className="rogue0-dev-search" placeholder="filter items" value={itemFilter}
                onChange={event => setItemFilter(event.target.value)} />
              <select value={newItemId} onChange={event => setNewItemId(event.target.value)}>
                <option value="">— pick an item —</option>
                {filteredItems.map(entry => (
                  <option key={entry.id} value={entry.id}>{entry.category} · {entry.label}</option>
                ))}
              </select>
              <button className="rogue0-link-btn" onClick={addItem}>Add</button>
            </div>
            {form.inventory.length === 0 && <p className="rogue0-dev-hint">Empty backpack and no equipment.</p>}
            {form.inventory.map((row, index) => (
              <div className="rogue0-dev-list-row" key={`${row.id}-${index}`}>
                <span className="rogue0-dev-name">{row.id}</span>
                <label className="rogue0-dev-inline">×
                  <input type="number" min={1} max={MAX_SCENARIO_ITEM_COUNT} value={row.count}
                    onChange={event => updateItem(index, { count: Number(event.target.value) })} />
                </label>
                {/^Tiered/.test(row.id) && (
                  <label className="rogue0-dev-inline">tier
                    <input type="number" min={1} max={5} value={row.tier ?? 0}
                      onChange={event => updateItem(index, { tier: Number(event.target.value) })} />
                  </label>
                )}
                <label className="rogue0-dev-inline">+
                  <input type="number" min={0} max={10} value={row.upgrade}
                    onChange={event => updateItem(index, { upgrade: Number(event.target.value) })} />
                </label>
                <label className="rogue0-dev-inline">
                  <input type="checkbox" checked={row.equip}
                    onChange={event => updateItem(index, { equip: event.target.checked })} />
                  equip
                </label>
                <label className="rogue0-dev-inline">
                  <input type="checkbox" checked={row.cursed}
                    onChange={event => updateItem(index, { cursed: event.target.checked })} />
                  cursed
                </label>
                <button className="rogue0-link-btn"
                  onClick={() => patch({ inventory: form.inventory.filter((_, i) => i !== index) })}>
                  remove
                </button>
              </div>
            ))}
          </>
        ) : (
          <p className="rogue0-dev-hint">Keeping the {form.heroClass}&apos;s starting gear.</p>
        )}
      </section>

      <section className="rogue0-dev-section">
        <h2>Monsters</h2>
        <div className="rogue0-dev-row">
          <label className="rogue0-dev-inline">
            <input type="radio" checked={form.monsterMode === 'replace'}
              onChange={() => patch({ monsterMode: 'replace' })} />
            replace the floor population
          </label>
          <label className="rogue0-dev-inline">
            <input type="radio" checked={form.monsterMode === 'append'}
              onChange={() => patch({ monsterMode: 'append' })} />
            add to the normal population
          </label>
        </div>
        <div className="rogue0-dev-row">
          <select value={newMonsterKind} onChange={event => setNewMonsterKind(event.target.value)}>
            <option value="">— pick a monster —</option>
            {monsters.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
          </select>
          <button className="rogue0-link-btn" onClick={addMonster}>Add</button>
        </div>
        {form.monsterMode === 'replace' && form.monsters.length === 0 && (
          <p className="rogue0-dev-hint">Empty floor — nothing to fight, and no reinforcement wave.</p>
        )}
        {form.monsters.map((row, index) => (
          <div className="rogue0-dev-list-row" key={`${row.kind}-${index}`}>
            <span className="rogue0-dev-name">{row.kind}</span>
            <label className="rogue0-dev-inline">×
              <input type="number" min={1} max={MAX_SCENARIO_MONSTERS} value={row.count}
                onChange={event => updateMonster(index, { count: Number(event.target.value) })} />
            </label>
            <label className="rogue0-dev-inline">
              <input type="checkbox" checked={row.near}
                onChange={event => updateMonster(index, { near: event.target.checked })} />
              near hero
            </label>
            <label className="rogue0-dev-inline">
              <input type="checkbox" checked={row.awake}
                onChange={event => updateMonster(index, { awake: event.target.checked })} />
              awake
            </label>
            <button className="rogue0-link-btn"
              onClick={() => patch({ monsters: form.monsters.filter((_, i) => i !== index) })}>
              remove
            </button>
          </div>
        ))}
      </section>

      <details className="rogue0-dev-json">
        <summary>Scenario JSON</summary>
        <textarea rows={10} value={jsonText} onChange={event => setJsonText(event.target.value)}
          placeholder="Paste a scenario object here" />
        <div className="rogue0-dev-row">
          <button className="rogue0-link-btn" onClick={() => setJsonText(JSON.stringify(toScenario(form), null, 2))}>
            Fill from form
          </button>
          <button className="rogue0-link-btn" onClick={loadJson}>Load into form</button>
        </div>
        {jsonError && <p className="rogue0-dev-errors">{jsonError}</p>}
      </details>
      </div>

      <div className="rogue0-dev-footer">
      <p className="rogue0-dev-hint">Starting a scenario overwrites your saved run. Local dev only.</p>
      <div className="rogue0-actions">
        <button className="rogue0-btn" onClick={start}>
          <span className="rogue0-btn-name">Start scenario</span>
          <span className="rogue0-btn-desc">floor {form.floor} · {form.heroClass}</span>
        </button>
        <button className="rogue0-btn" onClick={onCancel}>Cancel</button>
      </div>
      </div>
    </div>
  )
}
