// Phase 17 — local scenario harness (see PLAN.md).
//
// Author a start state for manual testing: a floor, a hero loadout and an
// explicit monster set. Never shipped: `GameContext.scenario` is only written
// by the dev-only React panel (src/components/rogue0/ScenarioSetupPanel.tsx),
// which is gated behind isLocalViteDev().
//
// Two rules this module must not break:
//   1. Ids come from saveRegistry, reversed once. There is no second registry.
//   2. "Replace" means *skip* the default spawner (the scene does that); it
//      must never delete entities, because removal runs loot + the
//      reinforcement guard.
import type { Registry } from './saveCodec';
import type { Entity } from './entity';
import { identify, rememberIdentifiedWandTypes } from './entity';
import { saveRegistry } from './saveRegistry';
import BasicHero from './classes/basicHero';
import Monster from './monsters/monster';
import Ring from './items/ring';
import Wand from './items/wand';
import { TieredArmor, TieredWeapon } from './items/tieredEquipment';
import { rollCurseId } from './curses';
import { floorProgression } from './progression';
import dungeon from './dungeon';

export const SCENARIO_STORAGE_KEY = 'rogue0.scenario.v1';
export const MAX_SCENARIO_LEVEL = 10;
export const MAX_SCENARIO_ITEM_COUNT = 20;
export const MAX_SCENARIO_MONSTERS = 24;
const MAX_SCENARIO_UPGRADE = 10;

export type ScenarioItemSpec = {
  id: string;
  count?: number;
  equip?: boolean;
  cursed?: boolean;
  tier?: number;
  upgrade?: number;
  // Defaults to true: a granted item you already know is what you asked for.
  // Set false to keep the unidentified/potion-alias flow under test.
  identified?: boolean;
};

export type ScenarioMonsterSpec = {
  kind: string;
  count?: number;
  // Spawn near the hero instead of anywhere on this half of the floor.
  near?: boolean;
  // Start hunting instead of spending 8–24 ticks asleep.
  awake?: boolean;
};

export type Scenario = {
  floor: number;
  hero?: {
    class?: string;
    level?: number;
    healthPoints?: number;
    hunger?: number;
    gold?: number;
    talents?: Record<string, number>;
  };
  // Undefined keeps the class's starting gear; an array replaces it exactly.
  inventory?: ScenarioItemSpec[];
  monsters?: {
    mode?: 'replace' | 'append';
    list: ScenarioMonsterSpec[];
  };
};

export type ScenarioCategory =
  | 'hero' | 'weapon' | 'armor' | 'ring' | 'wand'
  | 'potion' | 'scroll' | 'food' | 'treasure' | 'monster';

export type ScenarioCatalogEntry = {
  id: string;
  label: string;
  category: ScenarioCategory;
};

export type ScenarioCtor = new (...args: any[]) => Entity;

type Catalog = {
  entries: ScenarioCatalogEntry[];
  byId: Map<string, ScenarioCtor>;
};

// These are registry keys too, but they are bases, not spawnable content.
const ABSTRACT: ReadonlySet<unknown> = new Set<unknown>([Monster, BasicHero, Ring, Wand]);

const CATEGORY_ORDER: ScenarioCategory[] = ['hero', 'monster', 'weapon', 'armor',
  'ring', 'wand', 'potion', 'scroll', 'food', 'treasure'];

// `X.prototype instanceof Base` is false when X *is* Base, and TieredWeapon /
// TieredArmor are concrete spawnable classes as well as bases.
function isOrExtends(ctor: ScenarioCtor, base: any): boolean {
  return ctor === base || ctor.prototype instanceof base;
}

function categoryOf(ctor: ScenarioCtor): ScenarioCategory {
  const proto = ctor.prototype;
  if (proto instanceof Monster) return 'monster';
  if (proto instanceof BasicHero) return 'hero';
  if (proto instanceof Ring) return 'ring';
  if (proto instanceof Wand) return 'wand';
  if (/Potion/.test(ctor.name)) return 'potion';
  if (/Scroll/.test(ctor.name)) return 'scroll';
  if (isOrExtends(ctor, TieredArmor) || /^(Shield)$/.test(ctor.name)) return 'armor';
  if (/^(Ration)$/.test(ctor.name)) return 'food';
  if (/^(Gem|CursedGem|Gold|Chest|ChaliceOfBlood|FangOfTheBeast|Shoe)$/.test(ctor.name)) {
    return 'treasure';
  }
  return 'weapon';
}

// "PotionOfFrost" -> "Potion Of Frost"; "Quloptsh" stays as-is.
function labelFor(ctor: ScenarioCtor): string {
  return ctor.name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

let cached: Catalog | undefined;

// Class name is the dev id: unique across saveRegistry (verified by
// scripts/test-rogue0-scenario.mjs) and short enough to type in the panel or
// hand-edit in the JSON draft.
export function scenarioCatalog(registry: Registry = saveRegistry): Catalog {
  if (cached) return cached;
  const byId = new Map<string, ScenarioCtor>();
  const entries: ScenarioCatalogEntry[] = [];
  const seen = new Set<unknown>();
  for (const cls of Object.values(registry)) {
    if (seen.has(cls) || ABSTRACT.has(cls)) continue;
    seen.add(cls);
    const ctor = cls as unknown as ScenarioCtor;
    const id = ctor.name;
    if (!id || byId.has(id.toLowerCase())) continue;
    byId.set(id.toLowerCase(), ctor);
    entries.push({ id, label: labelFor(ctor), category: categoryOf(ctor) });
  }
  entries.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
    a.label.localeCompare(b.label));
  cached = { entries, byId };
  return cached;
}

export function resolveScenarioClass(id: string): ScenarioCtor | undefined {
  return scenarioCatalog().byId.get(String(id ?? '').trim().toLowerCase());
}

export function scenarioCategoryOf(ctor: ScenarioCtor): ScenarioCategory {
  return categoryOf(ctor);
}

function isMonsterCtor(ctor: ScenarioCtor): boolean {
  return ctor.prototype instanceof Monster;
}

function clampInt(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(value)));
}

function isObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Validates and cleans a panel draft or a hand-pasted JSON scenario. Errors are
// reported, never silently dropped: an unknown id is a typo, not a no-op.
export function normalizeScenario(input: unknown, maxFloor = 25): {
  scenario: Scenario;
  errors: string[];
} {
  const errors: string[] = [];
  const raw = isObject(input) ? input : {};
  if (!isObject(input)) errors.push('Scenario must be a JSON object.');

  const floor = Number.isInteger(raw.floor) ? Number(raw.floor) : 1;
  if (floor < 1 || floor > maxFloor) errors.push(`Floor must be between 1 and ${maxFloor}.`);

  const heroRaw = isObject(raw.hero) ? raw.hero : {};
  const hero: NonNullable<Scenario['hero']> = {};
  if (heroRaw.class !== undefined) {
    const ctor = resolveScenarioClass(String(heroRaw.class));
    if (!ctor || categoryOf(ctor) !== 'hero') errors.push(`Unknown hero class "${heroRaw.class}".`);
    else hero.class = ctor.name;
  }
  if (heroRaw.level !== undefined) {
    const level = Number(heroRaw.level);
    if (!Number.isInteger(level) || level < 1 || level > MAX_SCENARIO_LEVEL) {
      errors.push(`Hero level must be an integer between 1 and ${MAX_SCENARIO_LEVEL}.`);
    } else hero.level = level;
  }
  for (const key of ['healthPoints', 'hunger', 'gold'] as const) {
    if (heroRaw[key] === undefined) continue;
    const value = Number(heroRaw[key]);
    if (!Number.isFinite(value) || value < 0) errors.push(`Hero ${key} must be a non-negative number.`);
    else hero[key] = Math.floor(value);
  }
  if (isObject(heroRaw.talents)) {
    const talents: Record<string, number> = {};
    for (const [id, rank] of Object.entries(heroRaw.talents)) {
      const value = Number(rank);
      if (!Number.isInteger(value) || value < 0 || value > 2) {
        errors.push(`Talent "${id}" must be ranked 0–2.`);
        continue;
      }
      if (value > 0) talents[id] = value;
    }
    if (Object.keys(talents).length) hero.talents = talents;
  }

  let inventory: ScenarioItemSpec[] | undefined;
  if (raw.inventory !== undefined) {
    if (!Array.isArray(raw.inventory)) {
      errors.push('Inventory must be an array of item entries.');
    } else {
      inventory = [];
      for (const entry of raw.inventory) {
        if (!isObject(entry) || typeof entry.id !== 'string') {
          errors.push('Every inventory entry needs a string "id".');
          continue;
        }
        const ctor = resolveScenarioClass(entry.id);
        const category = ctor ? categoryOf(ctor) : undefined;
        if (!ctor || category === 'hero' || category === 'monster') {
          errors.push(`Unknown item "${entry.id}".`);
          continue;
        }
        const spec: ScenarioItemSpec = { id: ctor.name };
        if (entry.count !== undefined) {
          const count = Number(entry.count);
          if (!Number.isInteger(count) || count < 1 || count > MAX_SCENARIO_ITEM_COUNT) {
            errors.push(`Item "${ctor.name}" count must be 1–${MAX_SCENARIO_ITEM_COUNT}.`);
          } else spec.count = count;
        }
        if (entry.tier !== undefined) {
          const tier = Number(entry.tier);
          if (!Number.isInteger(tier) || tier < 1 || tier > 5) {
            errors.push(`Item "${ctor.name}" tier must be 1–5.`);
          } else spec.tier = tier;
        }
        if (entry.upgrade !== undefined) {
          const upgrade = Number(entry.upgrade);
          if (!Number.isInteger(upgrade) || upgrade < 0 || upgrade > MAX_SCENARIO_UPGRADE) {
            errors.push(`Item "${ctor.name}" upgrade must be 0–${MAX_SCENARIO_UPGRADE}.`);
          } else spec.upgrade = upgrade;
        }
        if (entry.equip !== undefined) spec.equip = !!entry.equip;
        if (entry.cursed !== undefined) spec.cursed = !!entry.cursed;
        if (entry.identified !== undefined) spec.identified = !!entry.identified;
        inventory.push(spec);
      }
    }
  }

  let monsters: Scenario['monsters'];
  if (raw.monsters !== undefined) {
    if (!isObject(raw.monsters)) {
      errors.push('Monsters must be an object with a "list".');
    } else {
      const mode = raw.monsters.mode;
      if (mode !== undefined && mode !== 'replace' && mode !== 'append') {
        errors.push('Monster mode must be "replace" or "append".');
      }
      const list: ScenarioMonsterSpec[] = [];
      let total = 0;
      const rawList = Array.isArray(raw.monsters.list) ? raw.monsters.list : [];
      if (raw.monsters.list !== undefined && !Array.isArray(raw.monsters.list)) {
        errors.push('Monster "list" must be an array.');
      }
      for (const entry of rawList) {
        if (!isObject(entry) || typeof entry.kind !== 'string') {
          errors.push('Every monster entry needs a string "kind".');
          continue;
        }
        const ctor = resolveScenarioClass(entry.kind);
        if (!ctor || !isMonsterCtor(ctor)) {
          errors.push(`Unknown monster "${entry.kind}".`);
          continue;
        }
        const count = entry.count === undefined ? 1 : Number(entry.count);
        if (!Number.isInteger(count) || count < 1 || count > MAX_SCENARIO_MONSTERS) {
          errors.push(`Monster "${ctor.name}" count must be 1–${MAX_SCENARIO_MONSTERS}.`);
          continue;
        }
        total += count;
        const spec: ScenarioMonsterSpec = { kind: ctor.name, count };
        if (entry.near !== undefined) spec.near = !!entry.near;
        if (entry.awake !== undefined) spec.awake = !!entry.awake;
        list.push(spec);
      }
      if (total > MAX_SCENARIO_MONSTERS) {
        errors.push(`At most ${MAX_SCENARIO_MONSTERS} monsters per scenario.`);
      }
      monsters = mode === 'append' ? { mode: 'append', list } : { list };
    }
  }

  return {
    scenario: {
      floor: clampInt(floor, 1, maxFloor),
      ...(Object.keys(hero).length ? { hero } : {}),
      ...(inventory ? { inventory } : {}),
      ...(monsters ? { monsters } : {}),
    },
    errors,
  };
}

export type ScenarioMonsterPlacement = {
  cls: ScenarioCtor;
  near: boolean;
  awake: boolean;
};

// One placement per spawned monster, in list order. Unknown kinds are dropped
// here; normalizeScenario is what reports them.
export function expandScenarioMonsters(scenario: Scenario): ScenarioMonsterPlacement[] {
  const placements: ScenarioMonsterPlacement[] = [];
  for (const spec of scenario.monsters?.list ?? []) {
    const cls = resolveScenarioClass(spec.kind);
    if (!cls || !isMonsterCtor(cls)) continue;
    const count = clampInt(spec.count ?? 1, 1, MAX_SCENARIO_MONSTERS);
    for (let i = 0; i < count; i++) {
      placements.push({ cls, near: !!spec.near, awake: !!spec.awake });
    }
  }
  return placements.slice(0, MAX_SCENARIO_MONSTERS);
}

export function scenarioReplacesPopulation(scenario: Scenario): boolean {
  return (scenario.monsters?.mode ?? 'replace') === 'replace';
}

export function scenarioSummary(scenario: Scenario, monsters = 0): string {
  const parts = [`floor ${scenario.floor}`,
    scenario.hero?.class ?? 'hero'];
  if (scenario.hero?.level) parts.push(`level ${scenario.hero.level}`);
  if (scenario.inventory) {
    const kinds = scenario.inventory.length;
    parts.push(`${kinds} item${kinds === 1 ? '' : 's'}`);
  }
  parts.push(`${monsters} monster${monsters === 1 ? '' : 's'}`);
  return `Scenario starting: ${parts.join(' · ')}.`;
}

// Level goes through gainXp: it is the only path that also applies +5 HP,
// +1 ATK and the talent points a level grants.
export function applyScenarioHero(hero: BasicHero, scenario: Scenario): void {
  const spec = scenario.hero ?? {};
  const level = clampInt(spec.level ?? hero.level, 1, MAX_SCENARIO_LEVEL);
  let guard = 0;
  while (hero.level < level && guard++ < MAX_SCENARIO_LEVEL * 2) {
    hero.gainXp(hero.xpForNextLevel());
  }
  hero.xp = 0;
  const maxHealth = hero.maxHealthPoints;
  hero.healthPoints = clampInt(spec.healthPoints ?? maxHealth, 1, maxHealth);
  // 0 is allowed: starting at 0 Food is how the starvation path gets tested.
  if (spec.hunger !== undefined) hero.hunger = clampInt(spec.hunger, 0, hero.maxHunger);
  if (spec.gold !== undefined) hero.gold = Math.max(0, Math.floor(spec.gold));
  for (const [id, rank] of Object.entries(spec.talents ?? {})) {
    for (let i = 0; i < clampInt(rank, 0, 2); i++) hero.learnTalent(id);
  }
}

// Removes the starting gear a class constructor rolled, leaving the hero
// unarmed with an empty backpack. Unequip hooks run first so passives (rings,
// armor bonuses) are undone exactly as a normal unequip would.
function clearScenarioGear(hero: BasicHero): void {
  const dropped: Entity[] = [];
  for (const slot of ['weapon', 'armor', 'ring1', 'ring2', 'artifact'] as const) {
    const item = hero[slot];
    if (!item) continue;
    item.unequip?.();
    dropped.push(item);
    hero[slot] = undefined;
  }
  dropped.push(...hero.backpack);
  hero.backpack = [];
  hero.quickslots = hero.quickslots.map(() => undefined);
  if (dropped.length) {
    hero.context.entities = hero.context.entities.filter(entity => !dropped.includes(entity));
  }
}

function instantiateScenarioItem(
  spec: ScenarioItemSpec,
  context: BasicHero['context'],
  floor: number
): Entity | undefined {
  const ctor = resolveScenarioClass(spec.id);
  if (!ctor) return undefined;
  const tiered = isOrExtends(ctor, TieredWeapon) || isOrExtends(ctor, TieredArmor);
  // Tier matters at construction time for tiered gear: the constructor derives
  // name, damage and protection from it.
  const item = tiered
    ? new ctor(context, undefined, undefined, clampInt(spec.tier ?? floorProgression(floor).tier, 1, 5))
    : new ctor(context);
  if (!tiered && spec.tier !== undefined) item.tier = clampInt(spec.tier, 1, 5);
  if (spec.cursed) {
    item.cursed = true;
    item.curseId = rollCurseId(item) ?? '';
  }
  // Mirrors entity.upgrade() without its per-level log chatter.
  for (let i = 0; i < clampInt(spec.upgrade ?? 0, 0, MAX_SCENARIO_UPGRADE); i++) {
    if (item.level >= item.maxLevel) break;
    item.level += 1;
    item.onUpgrade?.();
  }
  if (spec.identified !== false) {
    // identify() registers potion/scroll/wand knowledge; plain gear only needs
    // the flag (it would auto-identify on equip anyway).
    if (item.consumable || /^wand-/.test(item.textureKey ?? '')) identify(item);
    else item.identified = true;
  }
  return item;
}

// `inventory: undefined` keeps the class's starting gear. A listed inventory
// replaces it exactly, so a scenario can start naked or fully kitted.
export function applyScenarioInventory(
  hero: BasicHero,
  scenario: Scenario
): string[] {
  const warnings: string[] = [];
  if (scenario.inventory === undefined) return warnings;
  clearScenarioGear(hero);
  for (const spec of scenario.inventory) {
    const copies = clampInt(spec.count ?? 1, 1, MAX_SCENARIO_ITEM_COUNT);
    for (let i = 0; i < copies; i++) {
      const item = instantiateScenarioItem(spec, hero.context, scenario.floor);
      if (!item) {
        warnings.push(`Unknown item "${spec.id}" skipped.`);
        continue;
      }
      if (item.isContainer) {
        warnings.push(`${item.name} cannot start in a backpack.`);
        break;
      }
      if (!hero.addItem(item)) {
        warnings.push(`Backpack full: ${item.name} was not added.`);
        break;
      }
      if (spec.equip) hero.equipItem(item);
    }
  }
  return warnings;
}

// Same post-load fixups restoreRunState performs, so scenario gear behaves
// identically to resumed gear (wand charge scaling, ring passives).
export function finishScenarioInventory(context: BasicHero['context'], hero: BasicHero): void {
  const items = hero.getAllItems();
  rememberIdentifiedWandTypes(context, items);
  for (const item of items) {
    if (item instanceof Wand) item.reconcileChargeScaling();
  }
  for (const ring of [hero.ring1, hero.ring2]) {
    if (ring instanceof Ring) ring.onUpgrade();
  }
  if (!items.length) {
    dungeon.log(context, 'Scenario: you start with no equipment.');
  }
}

export function readScenarioDraft(): Scenario | undefined {
  try {
    const raw = localStorage.getItem(SCENARIO_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    const { scenario, errors } = normalizeScenario(parsed);
    return errors.length ? undefined : scenario;
  } catch {
    return undefined;
  }
}

export function writeScenarioDraft(scenario: Scenario): void {
  try {
    localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(scenario));
  } catch {
    // A dev draft is not worth reporting a storage failure for.
  }
}
